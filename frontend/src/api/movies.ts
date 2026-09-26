import { request } from './client'
import type {
  MovieCreate,
  MovieDetail,
  MovieFilters,
  MovieListItem,
  MovieUpdate,
  Page,
} from './types'

const moviePath = (skMovieId: string): string => `/movies/${encodeURIComponent(skMovieId)}`

export function listMovies(
  filters: MovieFilters = {},
  signal?: AbortSignal,
): Promise<Page<MovieListItem>> {
  return request('/movies', { params: filters, signal })
}

export function getMovie(skMovieId: string, signal?: AbortSignal): Promise<MovieDetail> {
  return request(moviePath(skMovieId), { signal })
}

export function createMovie(payload: MovieCreate): Promise<MovieDetail> {
  return request('/movies', { method: 'POST', body: payload })
}

export function updateMovie(skMovieId: string, payload: MovieUpdate): Promise<MovieDetail> {
  return request(moviePath(skMovieId), { method: 'PATCH', body: payload })
}

export function deleteMovie(skMovieId: string): Promise<void> {
  return request(moviePath(skMovieId), { method: 'DELETE' })
}
