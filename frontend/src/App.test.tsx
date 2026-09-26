import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { jsonResponse, movieDetail, stubApi } from './test/apiMock'
import { renderRoute } from './test/renderWithProviders'

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
    expect(within(nav).getByRole('link', { name: 'Adicionar filme' })).toHaveAttribute(
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

  it('marca como ativo só o link da página atual', () => {
    renderAt('/filmes/novo')

    expect(screen.getByRole('link', { name: 'Adicionar filme' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Filmes' })).not.toHaveAttribute('aria-current')
  })

  it('navega entre as páginas pelo menu', async () => {
    renderAt('/')

    await userEvent.click(screen.getByRole('link', { name: 'Adicionar filme' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Adicionar filme' })).toBeInTheDocument()
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

  it('tem rota para editar o filme', () => {
    renderAt('/filmes/m1/editar')

    expect(screen.getByRole('heading', { level: 1, name: 'Editar filme' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar para o filme' })).toHaveAttribute(
      'href',
      '/filmes/m1',
    )
  })

  it('"filmes/novo" continua indo para o cadastro, não para o detalhe', () => {
    renderAt('/filmes/novo')

    expect(screen.getByRole('heading', { level: 1, name: 'Adicionar filme' })).toBeInTheDocument()
  })
})
