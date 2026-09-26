import { vi } from 'vitest'
import type { MovieListItem, Page } from '../api/types'

type Handler = (url: URL) => Response | Promise<Response>

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function moviePage(
  items: MovieListItem[],
  overrides: Partial<Page<MovieListItem>> = {},
): Page<MovieListItem> {
  return { items, total: items.length, page: 1, page_size: 24, ...overrides }
}

export function movie(overrides: Partial<MovieListItem> = {}): MovieListItem {
  return {
    sk_movie_id: 'm1',
    titulo: 'Alien',
    ano_lancamento: 1979,
    url_poster: 'https://image.tmdb.org/t/p/w500/alien.jpg',
    generos: ['Horror', 'Ficção científica'],
    nota_media: 9,
    qtd_avaliacoes: 2,
    ...overrides,
  }
}

interface ApiHandlers {
  movies?: Handler
  genres?: Handler
}

/**
 * Substitui o fetch global respondendo /movies e /genres; o resto dá 404.
 * Devolve o mock e um atalho para as URLs já pedidas em /movies.
 */
export function stubApi({
  movies = () => jsonResponse(moviePage([])),
  genres = () => jsonResponse([]),
}: ApiHandlers = {}) {
  const fetchMock = vi.fn((input: string) => {
    const url = new URL(input)
    if (url.pathname.endsWith('/movies')) return Promise.resolve(movies(url))
    if (url.pathname.endsWith('/genres')) return Promise.resolve(genres(url))
    return Promise.resolve(jsonResponse({ detail: 'Não encontrado' }, 404))
  })
  vi.stubGlobal('fetch', fetchMock)

  const movieRequests = (): URLSearchParams[] =>
    fetchMock.mock.calls
      .map(([input]) => new URL(input))
      .filter((url) => url.pathname.endsWith('/movies'))
      .map((url) => url.searchParams)

  return { fetchMock, movieRequests }
}
