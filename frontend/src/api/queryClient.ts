import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './client'

export const MAX_QUERY_RETRIES = 2
/** Por 30s a tela reaproveita o dado sem consultar a API (o backend ainda tem cache de 60s). */
export const STALE_TIME_MS = 30_000

/** Erros 4xx não mudam ao repetir (404, 422...); rede e 5xx podem ser passageiros. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const isClientError = error instanceof ApiError && error.status >= 400 && error.status < 500
  return !isClientError && failureCount < MAX_QUERY_RETRIES
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        retry: shouldRetryQuery,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  })
}
