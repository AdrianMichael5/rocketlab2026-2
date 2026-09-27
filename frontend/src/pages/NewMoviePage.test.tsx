import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { POSTER_PLACEHOLDER } from '../components/MovieCard/poster'
import {
  type MockRequest,
  jsonResponse,
  movieDetail,
  moviePage,
  stubApi,
} from '../test/apiMock'
import { renderRoute } from '../test/renderWithProviders'

const PATH = '/filmes/novo'
const CREATED = movieDetail({ sk_movie_id: 'novo1', titulo: 'Duna' })

/** Nunca responde: mantém a requisição pendente. */
const pending = () => new Promise<Response>(() => {})

type Respond = () => Response | Promise<Response>

/** POST /movies responde `post`; GET /movies (catálogo) devolve página vazia. */
function moviesHandler(post: Respond) {
  return (_url: URL, request: MockRequest) =>
    request.method === 'POST' ? post() : jsonResponse(moviePage([]))
}

function stubCreate(post: Respond = () => jsonResponse(CREATED, 201)) {
  return stubApi({
    movies: moviesHandler(post),
    genres: () => jsonResponse(['Drama', 'Ficção científica']),
    movie: () => jsonResponse(CREATED),
  })
}

const field = (label: string) => screen.getByLabelText(label)
const submit = () => userEvent.click(screen.getByRole('button', { name: 'Cadastrar filme' }))

function datalistOptions(container: HTMLElement): (string | null)[] {
  return [...container.querySelectorAll('datalist option')].map((option) =>
    option.getAttribute('value'),
  )
}

describe('NewMoviePage — cadastro', () => {
  it('mostra o formulário vazio com os gêneros existentes como sugestão', async () => {
    stubCreate()
    const { container } = renderRoute(PATH)

    expect(screen.getByRole('heading', { level: 1, name: 'Novo filme' })).toBeInTheDocument()
    expect(field('Título')).toHaveValue('')
    await waitFor(() => expect(datalistOptions(container)).toEqual(['Drama', 'Ficção científica']))
  })

  it('cadastra com todos os campos e abre o detalhe', async () => {
    const { requestsTo } = stubCreate()
    const view = renderRoute(PATH)

    await userEvent.type(field('Título'), '  Duna  ')
    await userEvent.type(field('Diretores'), 'Denis Villeneuve{Enter}')
    fireEvent.change(field('Data de lançamento'), { target: { value: '2021-10-21' } })
    await userEvent.type(field('Gêneros'), 'Épico{Enter}')
    await userEvent.type(field('Duração (minutos)'), '155')
    await userEvent.selectOptions(field('Status'), 'Lançado')
    await userEvent.type(field('Sinopse'), 'Arrakis.')
    await userEvent.type(field('URL do pôster'), 'https://img.test/duna.jpg')
    await submit()

    expect(await screen.findByRole('heading', { level: 1, name: 'Duna' })).toBeInTheDocument()
    expect(view.pathname()).toBe('/filmes/novo1')
    expect(requestsTo('POST', '/movies')[0].body).toEqual({
      titulo: 'Duna',
      diretores: ['Denis Villeneuve'],
      generos: ['Épico'],
      // Ano preenchido a partir da data.
      ano_lancamento: 2021,
      data_lancamento: '2021-10-21',
      duracao_minutos: 155,
      status_filme: 'Lançado',
      sinopse: 'Arrakis.',
      url_poster: 'https://img.test/duna.jpg',
    })
  })

  it('reaproveita a grafia de um gênero existente', async () => {
    const { requestsTo } = stubCreate()
    const { container } = renderRoute(PATH)
    await waitFor(() => expect(datalistOptions(container)).toHaveLength(2))

    await userEvent.type(field('Título'), 'Duna')
    await userEvent.type(field('Gêneros'), 'ficção científica{Enter}')
    await submit()

    await waitFor(() => expect(requestsTo('POST', '/movies')).toHaveLength(1))
    expect(requestsTo('POST', '/movies')[0].body).toMatchObject({ generos: ['Ficção científica'] })
  })

  it('preenche o ano certo ao digitar a data como no Chrome (regressão)', () => {
    stubCreate()
    renderRoute(PATH)

    // dd/mm/aaaa: o Chrome manda uma data completa a cada dígito do ano.
    for (const data of ['0001-05-25', '0019-05-25', '0197-05-25', '1979-05-25']) {
      fireEvent.change(field('Data de lançamento'), { target: { value: data } })
    }
    expect(field('Ano')).toHaveValue('1979')

    fireEvent.change(field('Data de lançamento'), { target: { value: '1980-01-01' } })
    expect(field('Ano')).toHaveValue('1980')
  })

  it('não sobrescreve um ano digitado à mão', async () => {
    stubCreate()
    renderRoute(PATH)

    await userEvent.type(field('Ano'), '1985')
    fireEvent.change(field('Data de lançamento'), { target: { value: '1979-05-25' } })

    expect(field('Ano')).toHaveValue('1985')
  })

  it('valida no cliente e não envia', async () => {
    const { requestsTo } = stubCreate()
    renderRoute(PATH)

    await userEvent.type(field('Ano'), '1700')
    await submit()

    expect(screen.getByText('Informe o título.')).toBeInTheDocument()
    expect(screen.getByText('O ano deve estar entre 1888 e 2100.')).toBeInTheDocument()
    expect(field('Título')).toHaveAttribute('aria-invalid', 'true')
    expect(field('Título')).toHaveAccessibleDescription('Informe o título.')
    expect(screen.getByRole('alert')).toHaveTextContent('Corrija os campos destacados.')
    expect(requestsTo('POST', '/movies')).toHaveLength(0)
  })

  it('limpa o erro do campo ao editá-lo', async () => {
    stubCreate()
    renderRoute(PATH)

    await submit()
    await userEvent.type(field('Título'), 'D')

    expect(screen.queryByText('Informe o título.')).not.toBeInTheDocument()
  })

  it('mostra os erros 422 da API nos campos', async () => {
    stubCreate(() =>
      jsonResponse(
        {
          detail: [
            {
              loc: ['body', 'url_poster'],
              msg: 'Value error, url_poster deve ser uma URL http(s) absoluta',
            },
            { loc: ['body', 'diretores', 0], msg: 'String should have at most 255 characters' },
          ],
        },
        422,
      ),
    )
    renderRoute(PATH)

    await userEvent.type(field('Título'), 'Duna')
    await userEvent.type(field('Diretores'), 'X{Enter}')
    await submit()

    expect(
      await screen.findByText('url_poster deve ser uma URL http(s) absoluta'),
    ).toBeInTheDocument()
    expect(field('URL do pôster')).toHaveAttribute('aria-invalid', 'true')
    expect(field('Diretores')).toHaveAccessibleDescription(
      'Pressione Enter ou vírgula para adicionar. String should have at most 255 characters',
    )
  })

  it('mostra erros sem campo (ex.: 409) como alerta', async () => {
    stubCreate(() => jsonResponse({ detail: "id_filme 'x' já cadastrado" }, 409))
    renderRoute(PATH)

    await userEvent.type(field('Título'), 'Duna')
    await submit()

    expect(await screen.findByRole('alert')).toHaveTextContent("id_filme 'x' já cadastrado")
  })

  it('bloqueia o formulário enquanto salva', async () => {
    stubCreate(pending)
    renderRoute(PATH)

    await userEvent.type(field('Título'), 'Duna')
    await submit()

    expect(await screen.findByRole('button', { name: 'Salvando…' })).toBeDisabled()
    expect(field('Título')).toBeDisabled()
    expect(field('Gêneros')).toBeDisabled()
  })

  it('cancela voltando ao catálogo', () => {
    stubCreate()
    renderRoute(PATH)

    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/')
  })
})

describe('NewMoviePage — prévia do pôster', () => {
  const preview = () => screen.getByRole('img', { name: 'Prévia do pôster' })

  it('mostra o pôster padrão sem URL válida', async () => {
    stubCreate()
    renderRoute(PATH)

    expect(preview()).toHaveAttribute('src', POSTER_PLACEHOLDER)
    await userEvent.type(field('URL do pôster'), 'img.test/a.jpg')
    expect(preview()).toHaveAttribute('src', POSTER_PLACEHOLDER)
  })

  it('mostra a imagem da URL digitada', async () => {
    stubCreate()
    renderRoute(PATH)

    await userEvent.type(field('URL do pôster'), 'https://img.test/a.jpg')

    expect(preview()).toHaveAttribute('src', 'https://img.test/a.jpg')
  })

  it('avisa quando a imagem não carrega e tenta de novo com outra URL', async () => {
    stubCreate()
    renderRoute(PATH)

    await userEvent.type(field('URL do pôster'), 'https://img.test/quebrada.jpg')
    fireEvent.error(preview())

    expect(preview()).toHaveAttribute('src', POSTER_PLACEHOLDER)
    expect(screen.getByText('Não foi possível carregar a imagem.')).toBeInTheDocument()

    await userEvent.type(field('URL do pôster'), '2')
    expect(preview()).toHaveAttribute('src', 'https://img.test/quebrada.jpg2')
    expect(screen.queryByText('Não foi possível carregar a imagem.')).not.toBeInTheDocument()
  })
})
