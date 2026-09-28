import type { Decorator } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { genreKeys } from '../../api/queryKeys'

export const MOCK_GENRES = ['Animação', 'Comédia', 'Drama', 'Ficção científica', 'Horror']

/**
 * QueryClient próprio por story, com os gêneros já no cache e sem expirar:
 * o componente lê o cache e nunca chama a API.
 */
export const withQueryClient: Decorator = (Story) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  })
  client.setQueryData(genreKeys.all(), MOCK_GENRES)
  return (
    <QueryClientProvider client={client}>
      <Story />
    </QueryClientProvider>
  )
}
