import type { Meta, StoryObj } from '@storybook/react-vite'
import { Rating } from './Rating'

/** Exibição da nota de 0 a 10 como texto ("8/10"); o projeto não usa estrelas. */
const meta = {
  title: 'Components/Rating/Exibição',
  component: Rating,
  args: { value: 5.5, media: false, size: 'md' },
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 10, step: 0.1 } },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof Rating>

export default meta
type Story = StoryObj<typeof meta>

export const NotaZero: Story = { args: { value: 0 } }

export const NotaCincoEMeio: Story = { args: { value: 5.5 } }

export const NotaDez: Story = { args: { value: 10 } }

/** Média do filme: sempre com uma casa decimal ("10,0/10") e anunciada como "Nota média". */
export const MediaDoFilme: Story = { args: { value: 10, media: true } }

export const Tamanhos: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
      <Rating {...args} size="sm" />
      <Rating {...args} size="md" />
      <Rating {...args} size="lg" />
    </div>
  ),
}
