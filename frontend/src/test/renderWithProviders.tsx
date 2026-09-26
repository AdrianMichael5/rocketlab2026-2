import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter, type Location, useLocation } from 'react-router-dom'
import { AppRoutes } from '../App'

/** Sem retry (erros aparecem na hora) e sem cache entre testes. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

/** Renderiza a aplicação na rota `path` e expõe a localização atual do roteador. */
export function renderRoute(path = '/') {
  const current: { location: Location | null } = { location: null }

  function LocationSpy() {
    current.location = useLocation()
    return null
  }

  const view = render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
        <LocationSpy />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return {
    ...view,
    /** Query string atual, sem o "?" (ex.: "q=alien&page=2"). */
    search: () => current.location?.search.replace(/^\?/, '') ?? '',
    /** Caminho atual (ex.: "/filmes/m1"). */
    pathname: () => current.location?.pathname ?? '',
  }
}
