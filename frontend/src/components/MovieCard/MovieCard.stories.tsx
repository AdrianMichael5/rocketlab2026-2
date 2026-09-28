import type { Meta, StoryObj } from '@storybook/react-vite'
import { mockMovie } from '../../stories/fixtures/movies'
import { MovieCard } from './MovieCard'

const meta = {
  title: 'Components/MovieCard',
  component: MovieCard,
  // Largura de uma coluna da grade do catálogo.
  decorators: [
    (Story) => (
      <div style={{ width: 200 }}>
        <Story />
      </div>
    ),
  ],
  args: { movie: mockMovie() },
} satisfies Meta<typeof MovieCard>

export default meta
type Story = StoryObj<typeof meta>

export const ComPoster: Story = {}

/** Sem url_poster: usa o pôster padrão (8 mil filmes do catálogo não têm pôster). */
export const SemPoster: Story = { args: { movie: mockMovie({ url_poster: null }) } }

export const SemAvaliacoes: Story = {
  args: { movie: mockMovie({ nota_media: null, qtd_avaliacoes: 0 }) },
}

export const TituloLongo: Story = {
  args: {
    movie: mockMovie({
      titulo:
        'O Estranho Caso do Homem que Atravessou o Oceano Atlântico a Nado para Reencontrar a Família Perdida em 1923',
    }),
  },
}
