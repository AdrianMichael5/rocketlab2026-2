import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { personKeys } from '../api/queryKeys'
import type { MovieDetail, PersonDetail } from '../api/types'
import { APP_NAME } from '../hooks/usePageTitle'
import {
  type MockRequest,
  jsonResponse,
  movie,
  movieDetail,
  noContent,
  page,
  personDetail,
  review,
  stubApi,
} from '../test/apiMock'
import { createCachingTestQueryClient, renderRoute } from '../test/renderWithProviders'

const PATH = '/pessoas/p1'

/** Nunca responde: mantém a consulta carregando. */
const pending = () => new Promise<Response>(() => {})

/** Responde a pessoa refletindo no envelope a página pedida em ?page=. */
function personHandler(person: PersonDetail) {
  return (url: URL) =>
    jsonResponse({
      ...person,
      filmes: { ...person.filmes, page: Number(url.searchParams.get('page') ?? 1) },
    })
}

function cardTitles(): string[] {
  const list = screen.getByRole('list', { name: 'Filmes de Ridley Scott' })
  return within(list)
    .getAllByRole('heading', { level: 2 })
    .map((heading) => heading.textContent ?? '')
}

describe('PersonPage — carregamento e erros', () => {
  it('mostra o estado de carregamento', () => {
    stubApi({ person: pending })
    renderRoute(PATH)

    expect(screen.getByRole('status', { name: 'Carregando filmografia' })).toBeInTheDocument()
  })

  it('mostra "Pessoa não encontrada" com link de volta no 404', async () => {
    stubApi()
    renderRoute(PATH)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Pessoa não encontrada' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar para os filmes' })).toHaveAttribute('href', '/')
    await waitFor(() => expect(document.title).toBe(`Pessoa não encontrada · ${APP_NAME}`))
  })

  it('mostra o erro e tenta de novo', async () => {
    let calls = 0
    stubApi({
      person: () => {
        calls += 1
        return calls === 1 ? jsonResponse({ detail: 'Falhou' }, 500) : jsonResponse(personDetail())
      },
    })
    renderRoute(PATH)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Não foi possível carregar a pessoa')
    expect(alert).toHaveTextContent('Falhou')
    await userEvent.click(within(alert).getByRole('button', { name: 'Tentar novamente' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ridley Scott' }),
    ).toBeInTheDocument()
  })
})

describe('PersonPage — filmografia', () => {
  const filmes = page(
    [
      movie({ sk_movie_id: 'm3', titulo: 'Gladiador', ano_lancamento: 2000 }),
      movie({ sk_movie_id: 'm1', titulo: 'Alien', ano_lancamento: 1979 }),
    ],
    { total: 2, page_size: 24 },
  )

  it('mostra nome, papel, total e os filmes na ordem da API', async () => {
    stubApi({ person: personHandler(personDetail({ filmes })) })
    renderRoute(PATH)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ridley Scott' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Direção · 2 filmes')).toBeInTheDocument()
    expect(cardTitles()).toEqual(['Gladiador', 'Alien'])
    expect(screen.getByRole('link', { name: 'Alien' })).toHaveAttribute('href', '/filmes/m1')
    await waitFor(() => expect(document.title).toBe(`Ridley Scott · ${APP_NAME}`))
  })

  it.each([
    ['Ator', 'Atuação'],
    ['Roteirista', 'Roteiro'],
  ] as const)('mostra o papel %s como "%s"', async (tipo, papel) => {
    const person = personDetail({ tipo, filmes: page([movie()], { total: 1 }) })
    stubApi({ person: personHandler(person) })
    renderRoute(PATH)

    expect(await screen.findByText(`${papel} · 1 filme`)).toBeInTheDocument()
  })

  it('pede a primeira página com o tamanho da grade', async () => {
    const { requestsTo } = stubApi({ person: personHandler(personDetail({ filmes })) })
    renderRoute(PATH)

    await screen.findByRole('heading', { level: 1, name: 'Ridley Scott' })
    const [request] = requestsTo('GET', '/people/p1')
    expect(request.url.searchParams.get('page')).toBe('1')
    expect(request.url.searchParams.get('page_size')).toBe('24')
  })

  it('pagina pela URL e busca a página seguinte', async () => {
    const many = page([movie()], { total: 50, page_size: 24 })
    const { requestsTo } = stubApi({ person: personHandler(personDetail({ filmes: many })) })
    const { search } = renderRoute(PATH)

    await userEvent.click(await screen.findByRole('button', { name: /Próxima/ }))

    expect(search()).toBe('page=2')
    expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument()
    const pages = requestsTo('GET', '/people/p1').map(({ url }) => url.searchParams.get('page'))
    expect(pages).toEqual(['1', '2'])
  })

  it('usa a página 1 quando ?page= é inválido', async () => {
    const { requestsTo } = stubApi({ person: personHandler(personDetail({ filmes })) })
    renderRoute(`${PATH}?page=abc`)

    await screen.findByRole('heading', { level: 1, name: 'Ridley Scott' })
    expect(requestsTo('GET', '/people/p1')[0].url.searchParams.get('page')).toBe('1')
  })

  it('avisa quando a pessoa não tem filmes', async () => {
    stubApi({ person: personHandler(personDetail({ filmes: page([], { total: 0 }) })) })
    renderRoute(PATH)

    expect(
      await screen.findByText('Nenhum filme cadastrado para esta pessoa.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Direção · 0 filmes')).toBeInTheDocument()
  })

  it('oferece voltar à primeira página quando a página pedida passou do fim', async () => {
    const empty = page([], { total: 2, page_size: 24 })
    stubApi({ person: personHandler(personDetail({ filmes: empty })) })
    const { search } = renderRoute(`${PATH}?page=3`)

    expect(await screen.findByText('Não há filmes na página 3')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ir para a primeira página' }))

    await waitFor(() => expect(search()).toBe(''))
  })
})

describe('PersonPage — dados atualizados após mudar um filme', () => {
  // Ridley Scott (d-1) dirige Alien (m1); o detalhe do filme tem o link de volta para ele.
  const PERSON_PATH = '/pessoas/d-1'
  const person = personDetail({ sk_person_id: 'd-1', filmes: page([movie()], { total: 1 }) })

  /** Filme m1 com GET, PATCH (mescla o corpo) e DELETE; avaliações vazias e POST aceito. */
  function stubMovieChanges() {
    let current: MovieDetail = movieDetail()
    return stubApi({
      person: personHandler(person),
      genres: () => jsonResponse(['Horror']),
      movie: (_url, request: MockRequest) => {
        if (request.method === 'DELETE') return noContent()
        if (request.method === 'PATCH') {
          current = movieDetail({ ...current, ...(request.body as object), creditos: undefined })
        }
        return jsonResponse(current)
      },
      reviews: (_url, request) =>
        request.method === 'POST' ? jsonResponse(review(), 201) : jsonResponse(page([])),
    })
  }

  async function openMovieFromPerson() {
    await userEvent.click(await screen.findByRole('link', { name: 'Alien' }))
    await screen.findByRole('heading', { level: 1, name: 'Alien' })
  }

  async function backToPerson() {
    await userEvent.click(screen.getByRole('link', { name: 'Ridley Scott' }))
    await screen.findByRole('heading', { level: 1, name: 'Ridley Scott' })
  }

  it('busca a filmografia de novo depois de avaliar um filme dela', async () => {
    const { requestsTo } = stubMovieChanges()
    renderRoute(PERSON_PATH, createCachingTestQueryClient())
    await openMovieFromPerson()

    await userEvent.type(screen.getByLabelText('Seu nome'), 'Carla')
    await userEvent.click(screen.getByRole('radio', { name: 'Nota 7' }))
    await userEvent.type(screen.getByLabelText('Comentário'), 'Bom.')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar avaliação' }))
    await screen.findByText('Avaliação enviada.')
    await backToPerson()

    await waitFor(() => expect(requestsTo('GET', '/people/d-1')).toHaveLength(2))
  })

  it('busca a filmografia de novo depois de editar um filme dela', async () => {
    const { requestsTo } = stubMovieChanges()
    renderRoute(PERSON_PATH, createCachingTestQueryClient())
    await openMovieFromPerson()

    await userEvent.click(screen.getByRole('link', { name: 'Editar' }))
    const titulo = await screen.findByLabelText(/^Título/)
    await userEvent.clear(titulo)
    await userEvent.type(titulo, 'Aliens')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await screen.findByRole('heading', { level: 1, name: 'Aliens' })
    await backToPerson()

    await waitFor(() => expect(requestsTo('GET', '/people/d-1')).toHaveLength(2))
  })

  it('marca a filmografia como desatualizada ao remover um filme dela', async () => {
    stubMovieChanges()
    const client = createCachingTestQueryClient()
    renderRoute(PERSON_PATH, client)
    await openMovieFromPerson()

    await userEvent.click(screen.getByRole('button', { name: 'Remover' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remover filme' }))
    await screen.findByRole('heading', { level: 1, name: 'Filmes' })

    // Sem link de volta a partir do catálogo: a próxima visita busca de novo.
    expect(client.getQueryState(personKeys.detail('d-1', 1))?.isInvalidated).toBe(true)
  })
})
