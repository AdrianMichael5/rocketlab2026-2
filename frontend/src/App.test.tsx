import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { App } from './App'
import { jsonResponse, movieDetail, stubApi } from './test/apiMock'
import { renderRoute } from './test/renderWithProviders'

// A rota /insights é lazy: carrega o módulo (e o Recharts) antes dos testes, para o
// primeiro findBy não depender do tempo de import.
beforeAll(async () => {
  await import('./pages/InsightsPage')
}, 30_000)

const renderAt = renderRoute

beforeEach(() => {
  stubApi()
})

describe('layout e rotas', () => {
  it('mostra o cabeçalho com a marca e a navegação principal', () => {
    renderAt('/')

    const header = screen.getByRole('banner')
    expect(within(header).getByRole('link', { name: 'RocketLab Filmes' })).toHaveAttribute(
      'href',
      '/',
    )
    const nav = within(header).getByRole('navigation', { name: 'Principal' })
    expect(within(nav).getByRole('link', { name: 'Filmes' })).toHaveAttribute('href', '/')
    expect(within(nav).getByRole('link', { name: 'Novo filme' })).toHaveAttribute(
      'href',
      '/filmes/novo',
    )
  })

  it('o primeiro item do Tab é um link para pular direto ao conteúdo', async () => {
    renderAt('/')

    await userEvent.tab()

    const skip = screen.getByRole('link', { name: 'Pular para o conteúdo' })
    expect(skip).toHaveFocus()
    expect(skip).toHaveAttribute('href', '#conteudo')
    const main = screen.getByRole('main')
    expect(main).toHaveAttribute('id', 'conteudo')
    // tabIndex -1: o foco pode ir para o <main> ao seguir o link.
    expect(main).toHaveAttribute('tabindex', '-1')
  })

  it('renderiza a página de filmes na raiz, dentro do conteúdo principal', () => {
    renderAt('/')

    const main = screen.getByRole('main')
    expect(within(main).getByRole('heading', { level: 1, name: 'Filmes' })).toBeInTheDocument()
  })

  it('tem o link Insights no cabeçalho, ativo na página de insights', async () => {
    renderAt('/insights')

    const nav = screen.getByRole('navigation', { name: 'Principal' })
    const link = within(nav).getByRole('link', { name: 'Insights' })
    expect(link).toHaveAttribute('href', '/insights')
    expect(link).toHaveAttribute('aria-current', 'page')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Insights' }),
    ).toBeInTheDocument()
  })

  it('marca como ativo só o link da página atual', () => {
    renderAt('/filmes/novo')

    expect(screen.getByRole('link', { name: 'Novo filme' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Filmes' })).not.toHaveAttribute('aria-current')
  })

  it('navega entre as páginas pelo menu', async () => {
    renderAt('/')

    await userEvent.click(screen.getByRole('link', { name: 'Novo filme' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Novo filme' })).toBeInTheDocument()
  })

  it('mostra "página não encontrada" em rotas desconhecidas, mantendo o layout', () => {
    renderAt('/nao-existe')

    expect(
      screen.getByRole('heading', { level: 1, name: 'Página não encontrada' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar para os filmes' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })

  it('tem rota para o detalhe do filme (destino dos cards do catálogo)', async () => {
    stubApi({ movie: () => jsonResponse(movieDetail({ titulo: 'Alien' })) })
    renderAt('/filmes/m1')

    expect(await screen.findByRole('heading', { level: 1, name: 'Alien' })).toBeInTheDocument()
    expect(screen.queryByText('Página não encontrada')).not.toBeInTheDocument()
  })

  it('tem rota para editar o filme', async () => {
    stubApi({ movie: () => jsonResponse(movieDetail()) })
    renderAt('/filmes/m1/editar')

    expect(screen.getByRole('heading', { level: 1, name: 'Editar filme' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Cancelar' })).toHaveAttribute(
      'href',
      '/filmes/m1',
    )
  })

  it('"filmes/novo" continua indo para o cadastro, não para o detalhe', () => {
    renderAt('/filmes/novo')

    expect(screen.getByRole('heading', { level: 1, name: 'Novo filme' })).toBeInTheDocument()
  })
})

describe('título da aba e foco na troca de página', () => {
  it.each([
    ['/', 'Filmes · RocketLab Filmes'],
    ['/filmes/novo', 'Novo filme · RocketLab Filmes'],
    ['/nao-existe', 'Página não encontrada · RocketLab Filmes'],
  ])('%s tem título próprio na aba', async (path, title) => {
    renderAt(path)

    await waitFor(() => expect(document.title).toBe(title))
  })

  it('o detalhe usa o título do filme; o 404 diz que não o encontrou', async () => {
    stubApi({ movie: () => jsonResponse(movieDetail({ titulo: 'Alien' })) })
    const { unmount } = renderAt('/filmes/m1')
    await waitFor(() => expect(document.title).toBe('Alien · RocketLab Filmes'))
    unmount()

    stubApi()
    renderAt('/filmes/m1')
    await waitFor(() => expect(document.title).toBe('Filme não encontrado · RocketLab Filmes'))
  })

  it('a edição tem título próprio', async () => {
    stubApi({ movie: () => jsonResponse(movieDetail()) })
    renderAt('/filmes/m1/editar')

    await waitFor(() => expect(document.title).toBe('Editar filme · RocketLab Filmes'))
  })

  it('ao trocar de página, o foco vai para o início do conteúdo', async () => {
    renderAt('/')

    await userEvent.click(screen.getByRole('link', { name: 'Novo filme' }))

    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('não tira o foco da busca quando só a query string muda', async () => {
    const { search } = renderAt('/')
    const busca = screen.getByRole('searchbox', { name: 'Buscar por título' })

    await userEvent.type(busca, 'alien')
    await waitFor(() => expect(search()).toContain('q=alien'))

    expect(busca).toHaveFocus()
  })

  it('não move o foco ao abrir a aplicação', () => {
    renderAt('/')

    expect(screen.getByRole('main')).not.toHaveFocus()
  })
})

describe('App (BrowserRouter + QueryClient próprios)', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/')
  })

  it('renderiza o catálogo na raiz sem providers externos', () => {
    window.history.pushState({}, '', '/')
    render(<App />)

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(
      within(screen.getByRole('main')).getByRole('heading', { level: 1, name: 'Filmes' }),
    ).toBeInTheDocument()
  })

  it('usa a URL atual do navegador para escolher a rota', () => {
    window.history.pushState({}, '', '/filmes/novo')
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'Novo filme' })).toBeInTheDocument()
  })

  it('atualiza a URL do navegador ao navegar pelo menu', async () => {
    window.history.pushState({}, '', '/')
    render(<App />)

    await userEvent.click(screen.getByRole('link', { name: 'Novo filme' }))

    expect(window.location.pathname).toBe('/filmes/novo')
    expect(screen.getByRole('heading', { level: 1, name: 'Novo filme' })).toBeInTheDocument()
  })
})
