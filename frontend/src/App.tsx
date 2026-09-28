import { QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { createQueryClient } from './api/queryClient'
import { Layout } from './components/Layout/Layout'
import { EditMoviePage } from './pages/EditMoviePage'
import { MovieDetailPage } from './pages/MovieDetailPage'
import { MoviesPage } from './pages/MoviesPage'
import { NewMoviePage } from './pages/NewMoviePage'
import { NotFoundPage } from './pages/NotFoundPage'

// Carregada sob demanda: o Recharts só entra no bundle de quem abre os insights.
const InsightsPage = lazy(() =>
  import('./pages/InsightsPage').then((module) => ({ default: module.InsightsPage })),
)

/** Rotas da aplicação; separadas de App para os testes usarem MemoryRouter. */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<MoviesPage />} />
        <Route path="filmes/novo" element={<NewMoviePage />} />
        {/* A rota estática "novo" tem prioridade sobre o parâmetro no React Router. */}
        <Route path="filmes/:skMovieId" element={<MovieDetailPage />} />
        <Route path="filmes/:skMovieId/editar" element={<EditMoviePage />} />
        <Route
          path="insights"
          element={
            <Suspense fallback={<p role="status">Carregando…</p>}>
              <InsightsPage />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export function App() {
  // Um QueryClient por montagem da aplicação (estável entre renderizações).
  const [queryClient] = useState(createQueryClient)
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
