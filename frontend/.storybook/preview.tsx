import type { Preview } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router-dom'
// Mesmo CSS global do app (src/main.tsx): tokens, tema escuro, tipografia.
import '../src/styles/theme.css'

const preview: Preview = {
  // Componentes com <Link> precisam de um roteador; nenhuma navegação sai da story.
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  parameters: {
    layout: 'padded',
    controls: { expanded: true },
  },
}

export default preview
