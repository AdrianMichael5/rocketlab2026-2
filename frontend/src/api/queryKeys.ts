import type { MovieFilters } from './types'

/**
 * Chaves do React Query. Tudo de um filme fica sob ['movie', id]: invalidar essa
 * chave atualiza o detalhe (média) e as páginas de avaliações de uma vez.
 */
export const movieKeys = {
  /** Prefixo de todas as páginas do catálogo. */
  lists: () => ['movies'] as const,
  list: (filters: MovieFilters) => ['movies', filters] as const,
  detail: (skMovieId: string) => ['movie', skMovieId] as const,
  reviews: (skMovieId: string, page: number) => ['movie', skMovieId, 'reviews', page] as const,
}

export const personKeys = {
  /**
   * Prefixo de todas as filmografias: mudar um filme (título, créditos, média ou
   * remoção) pode afetar a página de qualquer pessoa ligada a ele.
   */
  all: () => ['person'] as const,
  detail: (skPersonId: string, page: number) => ['person', skPersonId, page] as const,
}

export const genreKeys = {
  all: () => ['genres'] as const,
}

export const statsKeys = {
  all: () => ['stats'] as const,
}
