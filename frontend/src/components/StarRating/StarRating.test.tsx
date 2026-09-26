import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { StarRating } from './StarRating'

function fills(container: HTMLElement): (string | null)[] {
  return Array.from(container.querySelectorAll('[data-fill]')).map((star) =>
    star.getAttribute('data-fill'),
  )
}

describe('StarRating — exibição', () => {
  it('mostra a nota 0–10 como estrelas com meia', () => {
    const { container } = render(<StarRating value={7} />)

    expect(screen.getByRole('img', { name: 'Nota 3,5 de 5 estrelas' })).toBeInTheDocument()
    expect(fills(container)).toEqual(['full', 'full', 'full', 'half', 'empty'])
  })

  it('arredonda médias para a meia estrela mais próxima', () => {
    const { container } = render(<StarRating value={8.33} />)

    expect(screen.getByRole('img', { name: 'Nota 4 de 5 estrelas' })).toBeInTheDocument()
    expect(fills(container)).toEqual(['full', 'full', 'full', 'full', 'empty'])
  })

  it('indica quando o filme não tem avaliações', () => {
    const { container } = render(<StarRating value={null} />)

    expect(screen.getByRole('img', { name: 'Sem avaliações' })).toBeInTheDocument()
    expect(fills(container)).toEqual(Array(5).fill('empty'))
  })

  it('não é interativo', () => {
    render(<StarRating value={5} />)

    expect(screen.queryAllByRole('radio')).toHaveLength(0)
  })
})

describe('StarRating — entrada', () => {
  it('oferece 10 opções de meia em meia estrela, com nome acessível', () => {
    render(<StarRating value={null} onChange={() => {}} label="Sua nota" />)

    expect(screen.getByRole('radiogroup', { name: 'Sua nota' })).toBeInTheDocument()
    const nomes = screen.getAllByRole('radio').map((radio) => radio.getAttribute('aria-label'))
    expect(nomes).toEqual([
      '0,5 estrela',
      '1 estrela',
      '1,5 estrela',
      '2 estrelas',
      '2,5 estrelas',
      '3 estrelas',
      '3,5 estrelas',
      '4 estrelas',
      '4,5 estrelas',
      '5 estrelas',
    ])
  })

  it('devolve a nota 0–10 ao clicar', async () => {
    const onChange = vi.fn()
    render(<StarRating value={null} onChange={onChange} label="Sua nota" />)

    await userEvent.click(screen.getByRole('radio', { name: '3,5 estrelas' }))

    expect(onChange).toHaveBeenCalledWith(7)
  })

  it('marca a opção correspondente ao valor atual', () => {
    const { container } = render(<StarRating value={9} onChange={() => {}} label="Sua nota" />)

    expect(screen.getByRole('radio', { name: '4,5 estrelas' })).toBeChecked()
    expect(fills(container)).toEqual(['full', 'full', 'full', 'full', 'half'])
  })

  it('não marca nenhuma opção sem valor', () => {
    render(<StarRating value={null} onChange={() => {}} label="Sua nota" />)

    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).not.toBeChecked()
    }
  })

  it('permite ajustar a nota pelo teclado', async () => {
    function Controlado() {
      const [nota, setNota] = useState<number | null>(6)
      return (
        <>
          <StarRating value={nota} onChange={setNota} label="Sua nota" />
          <output>{nota}</output>
        </>
      )
    }
    const user = userEvent.setup()
    render(<Controlado />)

    await user.click(screen.getByRole('radio', { name: '3 estrelas' }))
    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('status')).toHaveTextContent('7')
    expect(screen.getByRole('radio', { name: '3,5 estrelas' })).toHaveFocus()
  })

  it('mostra prévia ao passar o mouse e volta ao valor ao sair', async () => {
    const user = userEvent.setup()
    const { container } = render(<StarRating value={4} onChange={() => {}} label="Sua nota" />)

    await user.hover(screen.getByLabelText('4,5 estrelas'))
    expect(fills(container)).toEqual(['full', 'full', 'full', 'full', 'half'])

    await user.unhover(screen.getByLabelText('4,5 estrelas'))
    expect(fills(container)).toEqual(['full', 'full', 'empty', 'empty', 'empty'])
  })

  it('toque não deixa prévia presa (só o mouse mostra prévia)', () => {
    const { container } = render(<StarRating value={4} onChange={() => {}} label="Sua nota" />)
    const metade = screen.getByLabelText('4,5 estrelas')

    // No toque o navegador também emite eventos de mouse de compatibilidade.
    fireEvent.pointerOver(metade, { pointerType: 'touch' })
    fireEvent.mouseOver(metade)

    expect(fills(container)).toEqual(['full', 'full', 'empty', 'empty', 'empty'])
  })

  it('descarta a prévia quando o valor muda (ex.: formulário reiniciado)', async () => {
    const user = userEvent.setup()
    const { container, rerender } = render(
      <StarRating value={4} onChange={() => {}} label="Sua nota" />,
    )
    await user.hover(screen.getByLabelText('4,5 estrelas'))

    rerender(<StarRating value={null} onChange={() => {}} label="Sua nota" />)

    expect(fills(container)).toEqual(Array(5).fill('empty'))
  })

  it('mostra a escolha feita pelo teclado mesmo com o mouse sobre as estrelas', async () => {
    function Controlado() {
      const [nota, setNota] = useState<number | null>(6)
      return <StarRating value={nota} onChange={setNota} label="Sua nota" />
    }
    const user = userEvent.setup()
    const { container } = render(<Controlado />)
    await user.hover(screen.getByLabelText('5 estrelas'))

    screen.getByRole('radio', { name: '3 estrelas' }).focus()
    await user.keyboard('{ArrowRight}')

    expect(fills(container)).toEqual(['full', 'full', 'full', 'half', 'empty'])
  })

  it('não altera a nota quando desabilitado', async () => {
    const onChange = vi.fn()
    render(<StarRating value={null} onChange={onChange} label="Sua nota" disabled />)

    await userEvent.click(screen.getByRole('radio', { name: '5 estrelas' }))

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('radio', { name: '5 estrelas' })).toBeDisabled()
  })
})
