import { onlineManager } from '@tanstack/react-query'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { MovieDetail } from '../api/types'
import { type MockRequest, jsonResponse, movieDetail, stubApi } from '../test/apiMock'
import { renderRoute } from '../test/renderWithProviders'

const PATH = '/filmes/m1/editar'
const ALIEN = movieDetail({ duracao_minutos: 0, sinopse: 'Nostromo.' })

/** Nunca responde: mantém a consulta carregando. */
const pending = () => new Promise<Response>(() => {})

type Respond = (request: MockRequest) => Response | Promise<Response>

/**
 * GET /movies/m1 devolve o filme atual; PATCH responde `patch` e, se der certo,
 * o filme salvo passa a ser o devolvido nos GETs seguintes.
 */
function stubEdit(
  initial: MovieDetail = ALIEN,
  patch: Respond = (request) => jsonResponse({ ...initial, ...(request.body as object) }),
) {
  let current = initial
  return stubApi({
    genres: () => jsonResponse(['Horror']),
    movie: async (_url, request) => {
      if (request.method !== 'PATCH') {
        return jsonResponse(current)
      }
      const response = await patch(request)
      if (response.ok) {
        current = (await response.clone().json()) as MovieDetail
      }
      return response
    },
  })
}

const field = (label: string) => screen.getByLabelText(label)
const submit = () => userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

async function findForm() {
  return screen.findByRole('button', { name: 'Salvar alterações' })
}

describe('EditMoviePage — carregamento', () => {
  it('mostra o carregamento', () => {
    stubApi({ movie: pending })
    renderRoute(PATH)

    expect(screen.getByRole('heading', { level: 1, name: 'Editar filme' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Carregando filme' })).toBeInTheDocument()
  })

  it('mostra "Filme não encontrado" no 404', async () => {
    stubApi()
    renderRoute(PATH)

    // Abaixo do <h1> "Editar filme", que continua na página.
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Filme não encontrado' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Editar filme' })).toBeInTheDocument()
  })

  it('mostra o erro e tenta de novo', async () => {
    let calls = 0
    stubApi({
      movie: () => {
        calls += 1
        return calls === 1 ? jsonResponse({ detail: 'Falhou' }, 500) : jsonResponse(ALIEN)
      },
    })
    renderRoute(PATH)

    const alert = await screen.findByRole('alert')
    await userEvent.click(within(alert).getByRole('button', { name: 'Tentar novamente' }))

    expect(await findForm()).toBeInTheDocument()
  })

  it('preenche o formulário com o filme', async () => {
    stubEdit()
    renderRoute(PATH)
    await findForm()

    expect(field('Título')).toHaveValue('Alien')
    expect(screen.getByRole('list', { name: 'Diretores selecionados' })).toHaveTextContent(
      'Ridley Scott',
    )
    expect(field('Ano')).toHaveValue('1979')
    expect(field('Data de lançamento')).toHaveValue('1979-05-25')
    // Duração 0 = desconhecida: campo vazio.
    expect(field('Duração (minutos)')).toHaveValue('')
    expect(field('Status')).toHaveValue('Lançado')
    expect(field('Sinopse')).toHaveValue('Nostromo.')
    expect(screen.getByRole('img', { name: 'Prévia do pôster' })).toHaveAttribute(
      'src',
      'https://image.tmdb.org/t/p/w500/alien.jpg',
    )
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/filmes/m1')
  })

  it('mantém um status fora da lista conhecida', async () => {
    stubEdit(movieDetail({ status_filme: 'Rumor' }))
    renderRoute(PATH)
    await findForm()

    expect(field('Status')).toHaveValue('Rumor')
  })
})

describe('EditMoviePage — salvar', () => {
  it('envia só os campos alterados e abre o detalhe atualizado', async () => {
    const { requestsTo } = stubEdit()
    const view = renderRoute(PATH)
    await findForm()

    await userEvent.clear(field('Título'))
    await userEvent.type(field('Título'), 'Aliens')
    await userEvent.clear(field('Sinopse'))
    await userEvent.click(screen.getByRole('button', { name: 'Remover Ridley Scott' }))
    await submit()

    expect(await screen.findByRole('heading', { level: 1, name: 'Aliens' })).toBeInTheDocument()
    expect(view.pathname()).toBe('/filmes/m1')
    expect(requestsTo('PATCH', '/movies/m1')[0].body).toEqual({
      titulo: 'Aliens',
      sinopse: null,
      diretores: [],
    })
  })

  it('compara com o filme do início da edição mesmo após nova busca (regressão)', async () => {
    let current: MovieDetail = ALIEN
    const { requestsTo } = stubApi({
      genres: () => jsonResponse([]),
      movie: (_url, request) =>
        request.method === 'PATCH'
          ? jsonResponse({ ...current, ...(request.body as object) })
          : jsonResponse(current),
    })
    renderRoute(PATH)
    await findForm()

    // Outra aba muda a sinopse; a volta da conexão faz o React Query buscar o filme de novo.
    current = { ...ALIEN, sinopse: 'Mudada em outra aba.' }
    act(() => {
      onlineManager.setOnline(false)
      onlineManager.setOnline(true)
    })
    await waitFor(() => expect(requestsTo('GET', '/movies/m1')).toHaveLength(2))

    await userEvent.clear(field('Título'))
    await userEvent.type(field('Título'), 'Aliens')
    await submit()

    await waitFor(() => expect(requestsTo('PATCH', '/movies/m1')).toHaveLength(1))
    // A sinopse não foi tocada aqui: não pode voltar ao valor antigo.
    expect(requestsTo('PATCH', '/movies/m1')[0].body).toEqual({ titulo: 'Aliens' })
  })

  it('sem alterações, volta ao detalhe sem enviar nada', async () => {
    const { requestsTo } = stubEdit()
    const view = renderRoute(PATH)
    await findForm()

    await submit()

    await waitFor(() => expect(view.pathname()).toBe('/filmes/m1'))
    expect(requestsTo('PATCH', '/movies/m1')).toHaveLength(0)
  })

  it('mostra o erro 422 do backend no campo', async () => {
    stubEdit(ALIEN, () =>
      jsonResponse(
        {
          detail: [
            {
              loc: ['body', 'ano_lancamento'],
              msg: 'ano_lancamento difere do ano de data_lancamento',
            },
          ],
        },
        422,
      ),
    )
    const view = renderRoute(PATH)
    await findForm()

    await userEvent.clear(field('Título'))
    await userEvent.type(field('Título'), 'Aliens')
    await submit()

    expect(
      await screen.findByText('ano_lancamento difere do ano de data_lancamento'),
    ).toBeInTheDocument()
    expect(field('Ano')).toHaveAttribute('aria-invalid', 'true')
    expect(view.pathname()).toBe(PATH)
  })
})
