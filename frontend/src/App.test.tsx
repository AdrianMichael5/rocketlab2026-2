import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppRoutes } from './App'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

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
})
