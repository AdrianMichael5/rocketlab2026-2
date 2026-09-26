import { describe, expect, it, vi } from 'vitest'
import { ApiError, DEFAULT_API_URL, buildUrl, getApiBaseUrl, request } from './client'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function mockFetch(response: Response | Error | DOMException) {
  // No jsdom, DOMException não herda de Error: por isso o teste é por Response.
  const fetchMock = vi.fn(() =>
    response instanceof Response ? Promise.resolve(response) : Promise.reject(response),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('a promise deveria ter falhado')
}

describe('getApiBaseUrl', () => {
  it('usa o padrão local quando VITE_API_URL não está definida', () => {
    vi.stubEnv('VITE_API_URL', '')

    expect(getApiBaseUrl()).toBe(DEFAULT_API_URL)
    expect(DEFAULT_API_URL).toBe('http://localhost:8000/api/v1')
  })

  it('usa VITE_API_URL sem a barra final', () => {
    vi.stubEnv('VITE_API_URL', 'https://api.exemplo.com/api/v1/')

    expect(getApiBaseUrl()).toBe('https://api.exemplo.com/api/v1')
  })
})

describe('buildUrl', () => {
  it('junta a base, o caminho e os parâmetros', () => {
    vi.stubEnv('VITE_API_URL', 'http://api.test/v1')

    expect(buildUrl('/movies', { q: 'chefão', page: 2, ordem: 'nota' })).toBe(
      'http://api.test/v1/movies?q=chef%C3%A3o&page=2&ordem=nota',
    )
  })

  it('ignora parâmetros vazios, nulos ou indefinidos', () => {
    vi.stubEnv('VITE_API_URL', 'http://api.test/v1')

    expect(buildUrl('/movies', { q: '', genero: undefined, ano: null, page: 1 })).toBe(
      'http://api.test/v1/movies?page=1',
    )
  })

  it('só aceita valores simples como parâmetro (checado pelo tsc)', () => {
    vi.stubEnv('VITE_API_URL', 'http://api.test/v1')

    // @ts-expect-error objetos aninhados virariam "[object Object]" na URL
    const url = buildUrl('/movies', { filtro: { ano: 1999 } })

    expect(url).toContain('/movies')
  })

  it('não adiciona "?" quando não há parâmetros', () => {
    vi.stubEnv('VITE_API_URL', 'http://api.test/v1')

    expect(buildUrl('/movies')).toBe('http://api.test/v1/movies')
  })
})

describe('request', () => {
  it('faz GET e devolve o JSON', async () => {
    vi.stubEnv('VITE_API_URL', 'http://api.test/v1')
    const fetchMock = mockFetch(jsonResponse(200, { ok: true }))

    const data = await request<{ ok: boolean }>('/movies/m1')

    expect(data).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/v1/movies/m1',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('envia o corpo como JSON com Content-Type', async () => {
    vi.stubEnv('VITE_API_URL', 'http://api.test/v1')
    const fetchMock = mockFetch(jsonResponse(201, { id: 'r1' }))

    await request('/movies/m1/reviews', { method: 'POST', body: { nota: 8 } })

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"nota":8}')
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json')
  })

  it('repassa o AbortSignal para o fetch', async () => {
    const fetchMock = mockFetch(jsonResponse(200, {}))
    const controller = new AbortController()

    await request('/movies', { signal: controller.signal })

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.signal).toBe(controller.signal)
  })

  it('devolve undefined para 204 No Content', async () => {
    mockFetch(new Response(null, { status: 204 }))

    await expect(request('/reviews/r1', { method: 'DELETE' })).resolves.toBeUndefined()
  })

  it('transforma o detail em texto do FastAPI em ApiError', async () => {
    mockFetch(jsonResponse(404, { detail: 'Filme não encontrado' }))

    const error = await catchError(request('/movies/x'))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 404,
      message: 'Filme não encontrado',
      fieldErrors: [],
    })
  })

  it('transforma erros de validação 422 em erros por campo', async () => {
    mockFetch(
      jsonResponse(422, {
        detail: [
          { loc: ['body', 'nota'], msg: 'Input should be a multiple of 0.5', type: 'multiple_of' },
          { loc: ['body', 'nome'], msg: 'String should have at least 1 character', type: 'x' },
          { loc: ['body'], msg: 'campos não aceitam null: titulo', type: 'value_error' },
        ],
      }),
    )

    const error = await catchError(request('/movies/m1/reviews', { method: 'POST', body: {} }))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 422,
      message: 'Dados inválidos',
      fieldErrors: [
        { campo: 'nota', mensagem: 'Input should be a multiple of 0.5' },
        { campo: 'nome', mensagem: 'String should have at least 1 character' },
        { campo: '', mensagem: 'campos não aceitam null: titulo' },
      ],
    })
  })

  it('usa uma mensagem genérica quando o erro não é JSON', async () => {
    mockFetch(new Response('Internal Server Error', { status: 500 }))

    const error = await catchError(request('/movies'))

    expect(error).toMatchObject({ status: 500, message: 'Erro 500 ao acessar a API' })
  })

  it('converte resposta 200 com JSON inválido em ApiError', async () => {
    mockFetch(new Response('<html>proxy</html>', { status: 200 }))

    const error = await catchError(request('/movies'))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 200, message: 'Resposta inválida da API' })
  })

  it('converte falha de rede em ApiError com status 0', async () => {
    mockFetch(new TypeError('Failed to fetch'))

    const error = await catchError(request('/movies'))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 0, message: 'Não foi possível conectar à API' })
  })

  it('propaga o cancelamento sem convertê-lo em ApiError', async () => {
    mockFetch(new DOMException('The operation was aborted.', 'AbortError'))

    const error = await catchError(request('/movies'))

    expect(error).not.toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ name: 'AbortError' })
  })
})
