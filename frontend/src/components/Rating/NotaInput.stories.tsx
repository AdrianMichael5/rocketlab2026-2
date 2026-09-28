import type { Meta, StoryObj } from '@storybook/react-vite'
import { useArgs } from 'storybook/preview-api'
import { fn } from 'storybook/test'
import { NotaInput } from './NotaInput'

/** Entrada da nota: grupo de rádios com os inteiros de 0 a 10 (setas trocam a opção). */
const meta = {
  title: 'Components/Rating/Entrada',
  component: NotaInput,
  // A nota fica nos args: o painel Controls e os cliques na story ficam sincronizados.
  render: function Render(args) {
    const [, updateArgs] = useArgs<typeof args>()
    return (
      <NotaInput
        {...args}
        onChange={(nota) => {
          updateArgs({ value: nota })
          args.onChange(nota)
        }}
      />
    )
  },
  args: { value: null, label: 'Sua nota (0 a 10)', onChange: fn() },
} satisfies Meta<typeof NotaInput>

export default meta
type Story = StoryObj<typeof meta>

export const SemNota: Story = {}

export const ComNotaEscolhida: Story = { args: { value: 8 } }

export const ComErro: Story = { args: { invalid: true } }

export const Desabilitado: Story = { args: { value: 5, disabled: true } }
