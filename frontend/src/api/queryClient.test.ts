import { describe, expect, it } from 'vitest'
import { ApiError } from './client'
import {
  MAX_QUERY_RETRIES,
  STALE_TIME_MS,
  createQueryClient,
  shouldRetryQuery,
} from './queryClient'

describe('shouldRetryQuery', () => {
  it.each([400, 404, 409, 422])('não repete erros %s do cliente', (status) => {
    expect(shouldRetryQuery(0, new ApiError(status, 'x'))).toBe(false)
  })

  it('repete falhas de rede e erros 5xx até o limite', () => {
    expect(shouldRetryQuery(0, new ApiError(0, 'rede'))).toBe(true)
    expect(shouldRetryQuery(MAX_QUERY_RETRIES - 1, new ApiError(503, 'x'))).toBe(true)
    expect(shouldRetryQuery(MAX_QUERY_RETRIES, new ApiError(503, 'x'))).toBe(false)
  })

  it('repete erros inesperados até o limite', () => {
    expect(shouldRetryQuery(0, new Error('boom'))).toBe(true)
  })
})

describe('createQueryClient', () => {
  it('aplica a política de retry e não repete mutações', () => {
    const client = createQueryClient()

    expect(client.getDefaultOptions().queries?.retry).toBe(shouldRetryQuery)
    expect(client.getDefaultOptions().mutations?.retry).toBe(false)
  })

  it('considera os dados frescos por 30s, metade do TTL do cache do backend', () => {
    const client = createQueryClient()

    expect(STALE_TIME_MS).toBe(30_000)
    expect(client.getDefaultOptions().queries?.staleTime).toBe(STALE_TIME_MS)
  })
})
