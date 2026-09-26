import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { jsonResponse, movie, moviePage, stubApi } from '../test/apiMock'
import { renderRoute } from '../test/renderWithProviders'

const ALIEN = movie({ sk_movie_id: 'm1', titulo: 'Alien' })
const BRAZIL = movie({
  sk_movie_id: 'm2',
  titulo: 'Brazil',
  ano_lancamento: 1985,
  url_poster: null,
  generos: [],
  nota_media: null,
  qtd_avaliacoes: 0,
})

/** Nunca responde: mantém a consulta carregando. */
const pending = () => new Promise<Response>(() => {})

async function findGrid() {
  return screen.findByRole('list', { name: 'Filmes' })
}

describe('MoviesPage — carregamento e resultados', () => {
  it('mostra o esqueleto enquanto carrega', () => {
    stubApi({ movies: pending })
    renderRoute('/')

    const loading = screen.getByRole('status', { name: 'Carregando filmes' })
    expect(loading).toHaveAttribute('aria-busy', 'true')
    expect(within(loading).getAllByTestId('movie-card-skeleton').length).toBeGreaterThan(0)
  })

  it('mostra um card por filme e o total encontrado', async () => {
    stubApi({ movies: () => jsonResponse(moviePage([ALIEN, BRAZIL], { total: 2 })) })
    renderRoute('/')

    const grid = await findGrid()
    expect(within(grid).getAllByRole('listitem')).toHaveLength(2)
    expect(within(grid).getByRole('heading', { name: 'Alien' })).toBeInTheDocument()
    expect(within(grid).getByText('Sem avaliações')).toBeInTheDocument()
    expect(screen.getByText('2 filmes')).toBeInTheDocument()
  })

  it('formata totais grandes em pt-BR', async () => {
    stubApi({ movies: () => jsonResponse(moviePage([ALIEN], { total: 95000 })) })
    renderRoute('/')

    expect(await screen.findByText('95.000 filmes')).toBeInTheDocument()
  })

  it('usa o singular para 1 filme', async () => {
    stubApi({ movies: () => jsonResponse(moviePage([ALIEN])) })
    renderRoute('/')

    expect(await screen.findByText('1 filme')).toBeInTheDocument()
  })

  it('pede a primeira página ordenada por título por padrão', async () => {
    const { movieRequests } = stubApi()
    renderRoute('/')

    await waitFor(() => expect(movieRequests()).toHaveLength(1))
    expect(movieRequests()[0].toString()).toBe('ordem=titulo&page=1&page_size=24')
  })

  it('usa o estado da URL na requisição e nos campos', async () => {
    const { movieRequests } = stubApi({ genres: () => jsonResponse(['Drama', 'Horror']) })
    renderRoute('/?q=alien&genero=Horror&ano=1979&ordem=nota&page=3')

    await waitFor(() => expect(movieRequests()).toHaveLength(1))
    expect(Object.fromEntries(movieRequests()[0])).toEqual({
      q: 'alien',
      genero: 'Horror',
      ano: '1979',
      ordem: 'nota',
      page: '3',
      page_size: '24',
    })
    expect(screen.getByRole('searchbox', { name: 'Buscar por título' })).toHaveValue('alien')
    expect(screen.getByRole('textbox', { name: 'Ano' })).toHaveValue('1979')
    expect(screen.getByRole('combobox', { name: 'Ordenar por' })).toHaveValue('nota')
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Gênero' })).toHaveValue('Horror'),
    )
  })
})

describe('MoviesPage — busca, filtros e ordenação', () => {
  it('busca só depois de 300 ms sem digitar, com uma única requisição', async () => {
    const { movieRequests } = stubApi()
    const view = renderRoute('/?page=2')
    await waitFor(() => expect(movieRequests()).toHaveLength(1))

    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar por título' }), 'ali')
    expect(movieRequests()).toHaveLength(1)

    await waitFor(() => expect(view.search()).toBe('q=ali'))
    await waitFor(() => expect(movieRequests()).toHaveLength(2))
    expect(movieRequests()[1].get('q')).toBe('ali')
    // Nova busca volta para a primeira página.
    expect(movieRequests()[1].get('page')).toBe('1')
  })

  it('Enter aplica a busca na hora', async () => {
    stubApi()
    const view = renderRoute('/')

    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Buscar por título' }),
      'alien{Enter}',
    )

    expect(view.search()).toBe('q=alien')
  })

  it('filtra por gênero com as opções vindas da API', async () => {
    const { movieRequests } = stubApi({ genres: () => jsonResponse(['Drama', 'Horror']) })
    const view = renderRoute('/?page=4')
    const select = screen.getByRole('combobox', { name: 'Gênero' })
    await screen.findByRole('option', { name: 'Horror' })

    await userEvent.selectOptions(select, 'Horror')

    expect(view.search()).toBe('genero=Horror')
    await waitFor(() => expect(movieRequests().at(-1)?.get('genero')).toBe('Horror'))
  })

  it('filtra por ano só quando o ano é válido', async () => {
    stubApi()
    const view = renderRoute('/')
    const ano = screen.getByRole('textbox', { name: 'Ano' })

    await userEvent.type(ano, '19')
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(view.search()).toBe('')

    await userEvent.type(ano, '94')
    await waitFor(() => expect(view.search()).toBe('ano=1994'))

    await userEvent.clear(ano)
    await waitFor(() => expect(view.search()).toBe(''))
  })

  it('ano inválido remove o filtro anterior e avisa no campo', async () => {
    stubApi()
    const view = renderRoute('/?ano=1994')
    const ano = screen.getByRole('textbox', { name: 'Ano' })
    expect(ano).not.toHaveAttribute('aria-invalid', 'true')

    await userEvent.clear(ano)
    await userEvent.type(ano, '1800')

    // O campo e a lista nunca ficam divergentes: sem ano válido, sem filtro de ano.
    await waitFor(() => expect(view.search()).toBe(''))
    expect(ano).toHaveAttribute('aria-invalid', 'true')
    expect(ano).toHaveAccessibleDescription('Informe um ano entre 1888 e 2100.')
  })

  it('ano incompleto também remove o filtro anterior', async () => {
    const { movieRequests } = stubApi()
    const view = renderRoute('/?ano=1994')
    const ano = screen.getByRole('textbox', { name: 'Ano' })

    await userEvent.type(ano, '{Backspace}{Backspace}')

    await waitFor(() => expect(view.search()).toBe(''))
    await waitFor(() => expect(movieRequests().at(-1)?.has('ano')).toBe(false))
    expect(ano).toHaveValue('19')
    expect(ano).toHaveAttribute('aria-invalid', 'true')
  })

  it('ano inválido sem filtro ativo não mexe na URL nem na página', async () => {
    stubApi()
    const view = renderRoute('/?page=3')
    const ano = screen.getByRole('textbox', { name: 'Ano' })

    await userEvent.type(ano, '19')

    await waitFor(() => expect(ano).toHaveAttribute('aria-invalid', 'true'))
    expect(view.search()).toBe('page=3')
  })

  it('o aviso de ano inválido não aparece enquanto ainda se digita e some ao corrigir', async () => {
    stubApi()
    const view = renderRoute('/')
    const ano = screen.getByRole('textbox', { name: 'Ano' })

    await userEvent.type(ano, '19')
    expect(ano).not.toHaveAttribute('aria-invalid', 'true')

    await userEvent.type(ano, '94')
    await waitFor(() => expect(view.search()).toBe('ano=1994'))
    expect(ano).not.toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByText('Informe um ano entre 1888 e 2100.')).not.toBeInTheDocument()
  })

  it('muda a ordenação', async () => {
    stubApi()
    const view = renderRoute('/?page=2')

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Ordenar por' }), 'ano')

    expect(view.search()).toBe('ordem=ano')
  })

  it('navegar para "/" pelo menu limpa a busca do campo', async () => {
    stubApi()
    renderRoute('/?q=alien')
    const busca = screen.getByRole('searchbox', { name: 'Buscar por título' })

    await userEvent.click(screen.getByRole('link', { name: 'Filmes' }))

    expect(busca).toHaveValue('')
  })
})

describe('MoviesPage — navegação para o filme', () => {
  it('clicar no card abre o detalhe do filme, não a página "não encontrada"', async () => {
    stubApi({ movies: () => jsonResponse(moviePage([ALIEN])) })
    renderRoute('/')
    const grid = await findGrid()

    await userEvent.click(within(grid).getByRole('link', { name: 'Alien' }))

    expect(
      screen.getByRole('heading', { level: 1, name: 'Detalhes do filme' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Página não encontrada')).not.toBeInTheDocument()
  })
})

describe('MoviesPage — paginação', () => {
  it('navega para a próxima página e atualiza a URL', async () => {
    const { movieRequests } = stubApi({
      movies: (url) =>
        jsonResponse(
          moviePage([ALIEN], { total: 50, page: Number(url.searchParams.get('page')) }),
        ),
    })
    const view = renderRoute('/?q=a')
    const nav = await screen.findByRole('navigation', { name: 'Paginação' })
    expect(nav).toHaveTextContent('Página 1 de 3')

    await userEvent.click(within(nav).getByRole('button', { name: 'Próxima' }))

    expect(view.search()).toBe('q=a&page=2')
    await waitFor(() => expect(nav).toHaveTextContent('Página 2 de 3'))
    expect(movieRequests().at(-1)?.get('page')).toBe('2')
  })

  it('mantém os resultados anteriores visíveis enquanto a próxima página carrega', async () => {
    let calls = 0
    stubApi({
      movies: () => {
        calls += 1
        return calls === 1 ? jsonResponse(moviePage([ALIEN], { total: 50 })) : pending()
      },
    })
    renderRoute('/')
    const grid = await findGrid()

    await userEvent.click(screen.getByRole('button', { name: 'Próxima' }))

    expect(within(grid).getByRole('heading', { name: 'Alien' })).toBeInTheDocument()
    expect(grid).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('status', { name: 'Carregando filmes' })).not.toBeInTheDocument()
  })
})

describe('MoviesPage — vazio e erro', () => {
  it('sem filtros e sem filmes, convida a adicionar um filme', async () => {
    stubApi()
    renderRoute('/')

    expect(
      await screen.findByRole('heading', { name: 'Nenhum filme cadastrado' }),
    ).toBeInTheDocument()
    const main = screen.getByRole('main')
    expect(within(main).getByRole('link', { name: 'Adicionar filme' })).toHaveAttribute(
      'href',
      '/filmes/novo',
    )
  })

  it('com filtros e sem resultados, permite limpar os filtros', async () => {
    const { movieRequests } = stubApi()
    const view = renderRoute('/?q=zzz&genero=Drama&ordem=nota')

    expect(
      await screen.findByRole('heading', { name: 'Nenhum filme encontrado' }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))

    expect(view.search()).toBe('')
    expect(screen.getByRole('searchbox', { name: 'Buscar por título' })).toHaveValue('')
    await waitFor(() => expect(movieRequests().at(-1)?.has('q')).toBe(false))
  })

  it('página além do fim oferece voltar para a primeira', async () => {
    stubApi({ movies: () => jsonResponse(moviePage([], { total: 30, page: 9 })) })
    const view = renderRoute('/?page=9')

    await userEvent.click(
      await screen.findByRole('button', { name: 'Ir para a primeira página' }),
    )

    expect(view.search()).toBe('')
  })

  it('mostra o erro da API e tenta de novo', async () => {
    let calls = 0
    stubApi({
      movies: () => {
        calls += 1
        return calls === 1
          ? jsonResponse({ detail: 'Banco indisponível' }, 500)
          : jsonResponse(moviePage([ALIEN]))
      },
    })
    renderRoute('/')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Não foi possível carregar os filmes')
    expect(alert).toHaveTextContent('Banco indisponível')

    await userEvent.click(within(alert).getByRole('button', { name: 'Tentar novamente' }))

    expect(await findGrid()).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('falha ao carregar gêneros não impede a listagem', async () => {
    stubApi({
      movies: () => jsonResponse(moviePage([ALIEN])),
      genres: () => jsonResponse({ detail: 'erro' }, 500),
    })
    renderRoute('/?genero=Drama')

    expect(await findGrid()).toBeInTheDocument()
    // O gênero da URL continua selecionável mesmo sem a lista da API.
    expect(screen.getByRole('combobox', { name: 'Gênero' })).toHaveValue('Drama')
  })
})
