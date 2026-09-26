import { QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { createQueryClient } from './api/queryClient'
import { Layout } from './components/Layout/Layout'
import { MovieDetailPage } from './pages/MovieDetailPage'
import { MoviesPage } from './pages/MoviesPage'
import { NewMoviePage } from './pages/NewMoviePage'
import { NotFoundPage } from './pages/NotFoundPage'

/** Rotas da aplicação; separadas de App para os testes usarem MemoryRouter. */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<MoviesPage />} />
        <Route path="filmes/novo" element={<NewMoviePage />} />
        {/* A rota estática "novo" tem prioridade sobre o parâmetro no React Router. */}
        <Route path="filmes/:skMovieId" element={<MovieDetailPage />} />
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
