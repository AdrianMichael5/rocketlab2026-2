import { ApiError } from '../../api/client'

const NOT_FOUND_STATUS = 404

/** Título da mensagem (e da aba) quando o filme não pôde ser carregado. */
export function movieLoadErrorTitle(error: Error): string {
  return isMovieNotFound(error) ? 'Filme não encontrado' : 'Não foi possível carregar o filme'
}

export function isMovieNotFound(error: Error): boolean {
  return error instanceof ApiError && error.status === NOT_FOUND_STATUS
}
