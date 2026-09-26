import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listGenres } from './genres'
import { createMovie, deleteMovie, getMovie, listMovies, updateMovie } from './movies'
import { createReview, deleteReview, listReviews } from './reviews'
import type { MovieUpdate } from './types'

const BASE = 'http://api.test/v1'

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', BASE)
  fetchMock = vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify({}), { status: 200 })),
  )
  vi.stubGlobal('fetch', fetchMock)
})

function lastCall(): { url: string; method: string; body: unknown } {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
  return {
    url,
    method: init.method ?? 'GET',
    body: init.body === undefined ? undefined : JSON.parse(init.body as string),
  }
}

describe('movies', () => {
  it('listMovies envia filtros e paginação na query string', async () => {
    await listMovies({ q: 'alien', genero: 'Horror', ano: 1979, ordem: 'nota', page: 2 })

    expect(lastCall()).toEqual({
      url: `${BASE}/movies?q=alien&genero=Horror&ano=1979&ordem=nota&page=2`,
      method: 'GET',
      body: undefined,
    })
  })

  it('getMovie codifica o identificador na URL', async () => {
    await getMovie('a/b')

    expect(lastCall().url).toBe(`${BASE}/movies/a%2Fb`)
  })

  it('createMovie faz POST com o payload', async () => {
    await createMovie({ titulo: 'Novo', generos: ['Drama'] })

    expect(lastCall()).toEqual({
      url: `${BASE}/movies`,
      method: 'POST',
      body: { titulo: 'Novo', generos: ['Drama'] },
    })
  })

  it('updateMovie faz PATCH só com os campos enviados', async () => {
    await updateMovie('m1', { sinopse: null })

    expect(lastCall()).toEqual({
      url: `${BASE}/movies/m1`,
      method: 'PATCH',
      body: { sinopse: null },
    })
  })

  it('MovieUpdate recusa null nos campos que o PATCH não aceita (checado pelo tsc)', () => {
    const invalidos: MovieUpdate[] = [
      // @ts-expect-error id_filme não aceita null no PATCH
      { id_filme: null },
      // @ts-expect-error titulo não aceita null no PATCH
      { titulo: null },
      // @ts-expect-error generos não aceita null no PATCH
      { generos: null },
      // @ts-expect-error diretores não aceita null no PATCH
      { diretores: null },
    ]
    const validos: MovieUpdate[] = [{ sinopse: null }, { url_poster: null }, { generos: [] }]

    expect(invalidos).toHaveLength(4)
    expect(validos).toHaveLength(3)
  })

  it('deleteMovie faz DELETE', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))

    await expect(deleteMovie('m1')).resolves.toBeUndefined()
    expect(lastCall()).toMatchObject({ url: `${BASE}/movies/m1`, method: 'DELETE' })
  })
})

describe('reviews', () => {
  it('listReviews usa a rota aninhada no filme', async () => {
    await listReviews('m1', { page: 1, page_size: 10 })

    expect(lastCall()).toMatchObject({
      url: `${BASE}/movies/m1/reviews?page=1&page_size=10`,
      method: 'GET',
    })
  })

  it('createReview faz POST com nome, nota e comentário', async () => {
    await createReview('m1', { nome: 'Ana', nota: 7.5, comentario: 'Bom.' })

    expect(lastCall()).toEqual({
      url: `${BASE}/movies/m1/reviews`,
      method: 'POST',
      body: { nome: 'Ana', nota: 7.5, comentario: 'Bom.' },
    })
  })

  it('deleteReview usa a rota de avaliações', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))

    await deleteReview('r1')

    expect(lastCall()).toMatchObject({ url: `${BASE}/reviews/r1`, method: 'DELETE' })
  })
})

describe('genres', () => {
  it('listGenres busca a lista de gêneros', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(['Drama']), { status: 200 }))

    await expect(listGenres()).resolves.toEqual(['Drama'])
    expect(lastCall()).toMatchObject({ url: `${BASE}/genres`, method: 'GET' })
  })
})
