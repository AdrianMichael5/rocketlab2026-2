import { request } from './client'

/** Nomes dos gêneros que têm filmes, em ordem alfabética. */
export function listGenres(signal?: AbortSignal): Promise<string[]> {
  return request('/genres', { signal })
}
