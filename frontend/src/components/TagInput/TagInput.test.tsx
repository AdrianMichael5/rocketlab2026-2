import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { TagInput, type TagInputProps } from './TagInput'

type HarnessProps = Partial<Omit<TagInputProps, 'values' | 'onChange'>> & { initial?: string[] }

/** TagInput controlado de verdade, para testar como o usuário usa. */
function Harness({ initial = [], ...props }: HarnessProps) {
  const [values, setValues] = useState(initial)
  return (
    <>
      <TagInput label="Gêneros" values={values} onChange={setValues} {...props} />
      <output data-testid="valores">{JSON.stringify(values)}</output>
    </>
  )
}

const valores = () => JSON.parse(screen.getByTestId('valores').textContent ?? '[]') as string[]
const input = () => screen.getByLabelText('Gêneros')

describe('TagInput', () => {
  it('adiciona com Enter e limpa o campo', async () => {
    render(<Harness />)

    await userEvent.type(input(), 'Horror{Enter}')

    expect(valores()).toEqual(['Horror'])
    expect(input()).toHaveValue('')
    expect(screen.getByRole('list', { name: 'Gêneros selecionados' })).toHaveTextContent('Horror')
  })

  it('adiciona com vírgula', async () => {
    render(<Harness />)

    await userEvent.type(input(), 'Horror,Drama,')

    expect(valores()).toEqual(['Horror', 'Drama'])
  })

  it('adiciona o texto pendente ao sair do campo', async () => {
    render(<Harness />)

    await userEvent.type(input(), '  Drama  ')
    await userEvent.tab()

    expect(valores()).toEqual(['Drama'])
  })

  it('Enter não envia o formulário', async () => {
    let submitted = false
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submitted = true
        }}
      >
        <Harness />
      </form>,
    )

    await userEvent.type(input(), 'Horror{Enter}')

    expect(submitted).toBe(false)
  })

  it('ignora vazio e repetido (sem diferenciar maiúsculas)', async () => {
    render(<Harness initial={['Horror']} />)

    await userEvent.type(input(), '   {Enter}horror{Enter}')

    expect(valores()).toEqual(['Horror'])
    expect(input()).toHaveValue('')
  })

  it('usa a grafia da sugestão existente', async () => {
    render(<Harness suggestions={['Ficção científica']} />)

    await userEvent.type(input(), 'ficção científica{Enter}')

    expect(valores()).toEqual(['Ficção científica'])
  })

  it('adiciona ao escolher uma sugestão da lista', () => {
    render(<Harness suggestions={['Horror', 'Drama']} />)

    fireEvent.input(input(), { target: { value: 'Drama' }, inputType: 'insertReplacementText' })

    expect(valores()).toEqual(['Drama'])
  })

  it('oferece só as sugestões ainda não escolhidas', () => {
    const { container } = render(<Harness initial={['Horror']} suggestions={['Horror', 'Drama']} />)

    const options = [...container.querySelectorAll('datalist option')].map((option) =>
      option.getAttribute('value'),
    )
    expect(options).toEqual(['Drama'])
  })

  it('remove pelo botão de cada item', async () => {
    render(<Harness initial={['Horror', 'Drama']} />)

    await userEvent.click(screen.getByRole('button', { name: 'Remover Horror' }))

    expect(valores()).toEqual(['Drama'])
  })

  it('Backspace no campo vazio remove o último item', async () => {
    render(<Harness initial={['Horror', 'Drama']} />)

    await userEvent.type(input(), '{Backspace}')

    expect(valores()).toEqual(['Horror'])
  })

  it('para de aceitar itens no limite', async () => {
    render(<Harness maxItems={2} />)

    await userEvent.type(input(), 'A{Enter}B{Enter}')

    expect(valores()).toEqual(['A', 'B'])
    expect(input()).toBeDisabled()
  })

  it('corta nomes no tamanho máximo', () => {
    render(<Harness maxLength={5} />)

    expect(input()).toHaveAttribute('maxLength', '5')
  })

  it('fica desativado com disabled', () => {
    render(<Harness initial={['Horror']} disabled />)

    expect(input()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remover Horror' })).toBeDisabled()
  })

  it('liga a dica e o erro ao campo', () => {
    render(
      <>
        <Harness invalid describedBy="erro" />
        <p id="erro">Informe no máximo 20 gêneros.</p>
      </>,
    )

    expect(input()).toHaveAttribute('aria-invalid', 'true')
    expect(input()).toHaveAccessibleDescription(
      'Pressione Enter ou vírgula para adicionar. Informe no máximo 20 gêneros.',
    )
    expect(within(document.body).queryByRole('list')).not.toBeInTheDocument()
  })
})
