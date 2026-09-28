// Estado do catálogo guardado na query string (?q=&genero=&ano=&ordem=&page=).
// Valores inválidos na URL (digitados à mão ou antigos) viram o padrão em vez de erro.
import type { MovieFilters, MovieOrder } from '../../api/types'

/** 24 cabe certinho em grades de 2, 3, 4 ou 6 colunas. */
export const CATALOG_PAGE_SIZE = 24

// Mesmos limites da API: app/api/deps.py e app/movies/{router,schemas}.py.
export const MIN_ANO = 1888
export const MAX_ANO = 2100
const MAX_PAGE = 10_000
const MAX_Q_LENGTH = 200
const MAX_GENERO_LENGTH = 50

export const ORDERS: readonly MovieOrder[] = ['titulo', 'ano', 'nota']

export interface CatalogParams {
  q: string
  genero: string
  ano: number | null
  ordem: MovieOrder
  page: number
}

export const DEFAULT_CATALOG_PARAMS: CatalogParams = {
  q: '',
  genero: '',
  ano: null,
  ordem: 'titulo',
  page: 1,
}

const INTEGER = /^\d+$/

/** Ano de 4 dígitos dentro dos limites da API, ou null. */
export function parseAno(texto: string | null): number | null {
  const valor = texto?.trim() ?? ''
  if (!INTEGER.test(valor)) {
    return null
  }
  const ano = Number(valor)
  return ano >= MIN_ANO && ano <= MAX_ANO ? ano : null
}

export function parsePage(texto: string | null): number {
  const valor = texto?.trim() ?? ''
  if (!INTEGER.test(valor)) {
    return DEFAULT_CATALOG_PARAMS.page
  }
  const page = Number(valor)
  return page >= 1 && page <= MAX_PAGE ? page : DEFAULT_CATALOG_PARAMS.page
}

function parseOrdem(texto: string | null): MovieOrder {
  return ORDERS.find((ordem) => ordem === texto) ?? DEFAULT_CATALOG_PARAMS.ordem
}

export function parseCatalogParams(search: URLSearchParams): CatalogParams {
  return {
    q: (search.get('q') ?? '').slice(0, MAX_Q_LENGTH),
    genero: (search.get('genero') ?? '').slice(0, MAX_GENERO_LENGTH),
    ano: parseAno(search.get('ano')),
    ordem: parseOrdem(search.get('ordem')),
    page: parsePage(search.get('page')),
  }
}

/** Só o que difere do padrão entra na URL. */
export function toSearchParams(params: CatalogParams): URLSearchParams {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.genero) search.set('genero', params.genero)
  if (params.ano !== null) search.set('ano', String(params.ano))
  if (params.ordem !== DEFAULT_CATALOG_PARAMS.ordem) search.set('ordem', params.ordem)
  if (params.page !== DEFAULT_CATALOG_PARAMS.page) search.set('page', String(params.page))
  return search
}

export function toMovieFilters(params: CatalogParams): MovieFilters {
  const q = params.q.trim()
  return {
    ...(q && { q }),
    ...(params.genero && { genero: params.genero }),
    ...(params.ano !== null && { ano: params.ano }),
    ordem: params.ordem,
    page: params.page,
    page_size: CATALOG_PAGE_SIZE,
  }
}

/** Sempre ao menos 1 página, mesmo sem resultados. */
export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}
