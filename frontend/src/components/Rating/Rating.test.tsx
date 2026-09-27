import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { NotaInput } from './NotaInput'
import { Rating } from './Rating'

describe('Rating', () => {
  it('mostra a nota individual de 0 a 10', () => {
    render(<Rating value={8} />)

    expect(screen.getByRole('img', { name: 'Nota 8 de 10' })).toHaveTextContent('8/10')
  })

  it('mostra a média com uma casa decimal', () => {
    render(<Rating value={7.8} media />)

    expect(screen.getByRole('img', { name: 'Nota média 7,8 de 10' })).toHaveTextContent('7,8/10')
  })

  it('não é interativo', () => {
    render(<Rating value={5} />)

    expect(screen.queryAllByRole('radio')).toHaveLength(0)
  })
})

describe('NotaInput', () => {
  it('oferece as notas de 0 a 10, com nome acessível', () => {
    render(<NotaInput value={null} onChange={() => {}} label="Sua nota" />)

    expect(screen.getByRole('radiogroup', { name: 'Sua nota' })).toBeInTheDocument()
    const valores = screen.getAllByRole('radio').map((radio) => radio.getAttribute('value'))
    expect(valores).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'])
    expect(screen.getByRole('radio', { name: 'Nota 10' })).toBeInTheDocument()
  })

  it('marca a nota recebida', () => {
    render(<NotaInput value={7} onChange={() => {}} label="Sua nota" />)

    expect(screen.getByRole('radio', { name: 'Nota 7' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Nota 8' })).not.toBeChecked()
  })

  it('devolve a nota escolhida pelo clique, inclusive 0', async () => {
    const onChange = vi.fn()
    render(<NotaInput value={null} onChange={onChange} label="Sua nota" />)

    await userEvent.click(screen.getByRole('radio', { name: 'Nota 0' }))

    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('troca a nota com as setas do teclado', async () => {
    function Controlado() {
      const [nota, setNota] = useState<number | null>(5)
      return <NotaInput value={nota} onChange={setNota} label="Sua nota" />
    }
    render(<Controlado />)

    screen.getByRole('radio', { name: 'Nota 5' }).focus()
    await userEvent.keyboard('{ArrowRight}')

    expect(screen.getByRole('radio', { name: 'Nota 6' })).toBeChecked()
  })

  it('fica bloqueado quando desabilitado', () => {
    render(<NotaInput value={null} onChange={() => {}} label="Sua nota" disabled />)

    expect(screen.getByRole('radiogroup', { name: 'Sua nota' })).toHaveAttribute('aria-disabled', 'true')
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled()
    }
  })

  it('liga o grupo à mensagem de erro', () => {
    render(
      <NotaInput value={null} onChange={() => {}} label="Sua nota" invalid describedBy="erro-nota" />,
    )

    const grupo = screen.getByRole('radiogroup', { name: 'Sua nota' })
    expect(grupo).toHaveAttribute('aria-invalid', 'true')
    expect(grupo).toHaveAttribute('aria-describedby', 'erro-nota')
  })
})
