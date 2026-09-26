import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

function renderDialog(overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const props = {
    open: true,
    title: 'Remover filme?',
    description: 'Esta ação não pode ser desfeita.',
    confirmLabel: 'Remover filme',
    pendingLabel: 'Removendo…',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  }
  const view = render(<ConfirmDialog {...props} />)
  return { ...view, props }
}

describe('ConfirmDialog', () => {
  it('fica oculto quando fechado', () => {
    renderDialog({ open: false })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('abre como modal com título e descrição', () => {
    renderDialog()

    const dialog = screen.getByRole('dialog', { name: 'Remover filme?' })
    expect(dialog).toHaveAccessibleDescription('Esta ação não pode ser desfeita.')
  })

  it('confirma pelo botão de confirmação', async () => {
    const { props } = renderDialog()

    await userEvent.click(screen.getByRole('button', { name: 'Remover filme' }))

    expect(props.onConfirm).toHaveBeenCalledTimes(1)
    expect(props.onCancel).not.toHaveBeenCalled()
  })

  it('cancela pelo botão Cancelar', async () => {
    const { props } = renderDialog()

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(props.onCancel).toHaveBeenCalledTimes(1)
  })

  it('cancela com Esc (evento cancel do dialog)', () => {
    const { props } = renderDialog()

    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))

    expect(props.onCancel).toHaveBeenCalledTimes(1)
  })

  it('fecha quando open passa a false', () => {
    const { props, rerender } = renderDialog()

    rerender(<ConfirmDialog {...props} open={false} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('bloqueia os botões e o Esc enquanto confirma', () => {
    const { props } = renderDialog({ isPending: true })

    expect(screen.getByRole('button', { name: 'Removendo…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(props.onCancel).not.toHaveBeenCalled()
  })

  it('reabre em vez de cancelar se o navegador fechar durante a confirmação', () => {
    // Chrome fecha o <dialog> no segundo Esc mesmo com preventDefault no cancel.
    const { props } = renderDialog({ isPending: true })
    const dialog = screen.getByRole('dialog') as HTMLDialogElement

    dialog.close()

    expect(props.onCancel).not.toHaveBeenCalled()
    expect(dialog.open).toBe(true)
  })

  it('mostra o erro da confirmação como alerta', () => {
    renderDialog({ error: 'Erro 500 ao acessar a API' })

    expect(screen.getByRole('alert')).toHaveTextContent('Erro 500 ao acessar a API')
  })
})
