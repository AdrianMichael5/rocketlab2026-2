import { vi } from 'vitest'
import type { MovieDetail, MovieListItem, Page, ReviewOut } from '../api/types'

export interface MockRequest {
  url: URL
  method: string
  /** Corpo JSON já decodificado (undefined sem corpo). */
  body: unknown
}

type Handler = (url: URL, request: MockRequest) => Response | Promise<Response>

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function noContent(): Response {
  return new Response(null, { status: 204 })
}

export function notFound(detail = 'Não encontrado'): Response {
  return jsonResponse({ detail }, 404)
}

export function page<T>(items: T[], overrides: Partial<Page<T>> = {}): Page<T> {
  return { items, total: items.length, page: 1, page_size: 24, ...overrides }
}

export function moviePage(
  items: MovieListItem[],
  overrides: Partial<Page<MovieListItem>> = {},
): Page<MovieListItem> {
  return page(items, overrides)
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

export function movieDetail(overrides: Partial<MovieDetail> = {}): MovieDetail {
  return {
    sk_movie_id: 'm1',
    id_filme: '348',
    titulo: 'Alien',
    data_lancamento: '1979-05-25',
    ano_lancamento: 1979,
    duracao_minutos: 117,
    status_filme: 'Lançado',
    sinopse: 'A tripulação da Nostromo recebe um sinal misterioso.',
    url_poster: 'https://image.tmdb.org/t/p/w500/alien.jpg',
    url_backdrop: 'https://image.tmdb.org/t/p/w1280/alien.jpg',
    generos: ['Horror', 'Ficção científica'],
    diretores: ['Ridley Scott'],
    atores: ['Sigourney Weaver', 'Tom Skerritt'],
    roteiristas: ['Dan O’Bannon'],
    produtoras: ['Brandywine Productions'],
    performance: null,
    avaliacoes: { nota_media: 7.8, qtd_avaliacoes: 5 },
    ...overrides,
  }
}

export function review(overrides: Partial<ReviewOut> = {}): ReviewOut {
  return {
    sk_movie_review_id: 'r1',
    sk_movie_id: 'm1',
    nome: 'Ana',
    nota: 8,
    comentario: 'Clássico do terror.',
    created_at: '2026-09-25T12:00:00Z',
    ...overrides,
  }
}

interface ApiHandlers {
  /** GET /movies (catálogo). */
  movies?: Handler
  genres?: Handler
  /** GET, PATCH e DELETE /movies/{id}. */
  movie?: Handler
  /** GET e POST /movies/{id}/reviews. */
  reviews?: Handler
}

const MOVIE_PATH = /\/movies\/[^/]+$/
const REVIEWS_PATH = /\/movies\/[^/]+\/reviews$/

function route(url: URL, handlers: Required<ApiHandlers>): Handler | null {
  const { pathname } = url
  if (pathname.endsWith('/movies')) return handlers.movies
  if (pathname.endsWith('/genres')) return handlers.genres
  if (REVIEWS_PATH.test(pathname)) return handlers.reviews
  if (MOVIE_PATH.test(pathname)) return handlers.movie
  return null
}

/**
 * Substitui o fetch global respondendo as rotas da API; o resto dá 404.
 * Devolve o mock e atalhos para as requisições já feitas.
 */
export function stubApi({
  movies = () => jsonResponse(moviePage([])),
  genres = () => jsonResponse([]),
  movie = () => notFound('Filme não encontrado'),
  reviews = () => jsonResponse(page([])),
}: ApiHandlers = {}) {
  const requests: MockRequest[] = []
  const fetchMock = vi.fn((input: string, init: RequestInit = {}) => {
    const request: MockRequest = {
      url: new URL(input),
      method: init.method ?? 'GET',
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    }
    requests.push(request)
    const handler = route(request.url, { movies, genres, movie, reviews })
    return Promise.resolve(handler ? handler(request.url, request) : notFound())
  })
  vi.stubGlobal('fetch', fetchMock)

  const movieRequests = (): URLSearchParams[] =>
    requests.filter(({ url }) => url.pathname.endsWith('/movies')).map(({ url }) => url.searchParams)

  /** Requisições com o método e o final de caminho dados (ex.: 'POST', '/reviews'). */
  const requestsTo = (method: string, pathSuffix: string): MockRequest[] =>
    requests.filter((request) => request.method === method && request.url.pathname.endsWith(pathSuffix))

  return { fetchMock, movieRequests, requestsTo }
}
