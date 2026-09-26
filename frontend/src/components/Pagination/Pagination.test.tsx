import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Pagination } from './Pagination'

function renderPagination(page: number, totalPages: number) {
  const onPageChange = vi.fn()
  render(<Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />)
  return onPageChange
}

describe('Pagination', () => {
  it('mostra a página atual e o total, formatados em pt-BR', () => {
    renderPagination(2, 3959)

    const nav = screen.getByRole('navigation', { name: 'Paginação' })
    expect(nav).toHaveTextContent('Página 2 de 3.959')
  })

  it('desabilita "Anterior" na primeira página', () => {
    renderPagination(1, 3)

    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeEnabled()
  })

  it('desabilita "Próxima" na última página', () => {
    renderPagination(3, 3)

    expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled()
  })

  it('avisa a página anterior e a próxima', async () => {
    const onPageChange = renderPagination(2, 3)

    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    await userEvent.click(screen.getByRole('button', { name: 'Próxima' }))

    expect(onPageChange.mock.calls).toEqual([[1], [3]])
  })

  it('não aparece quando há uma página só', () => {
    renderPagination(1, 1)

    expect(screen.queryByRole('navigation', { name: 'Paginação' })).not.toBeInTheDocument()
  })
})
