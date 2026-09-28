import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { Pagination } from './Pagination'

/** Some quando há uma página só (totalPages ≤ 1). */
const meta = {
  title: 'Components/Pagination',
  component: Pagination,
  args: { page: 1, totalPages: 10, onPageChange: fn() },
} satisfies Meta<typeof Pagination>

export default meta
type Story = StoryObj<typeof meta>

/** "Anterior" desabilitado. */
export const PrimeiraPagina: Story = {}

export const PaginaDoMeio: Story = { args: { page: 5 } }

/** "Próxima" desabilitado. */
export const UltimaPagina: Story = { args: { page: 10 } }
