import { ApiError } from '../../api/client'

const NOT_FOUND_STATUS = 404

export function isNotFoundError(error: Error): boolean {
  return error instanceof ApiError && error.status === NOT_FOUND_STATUS
}

export interface LoadErrorTexts {
  /** Título no 404 (ex.: "Filme não encontrado"). */
  notFound: string
  /** Título nas demais falhas (ex.: "Não foi possível carregar o filme"). */
  failed: string
}

/** Título da mensagem (e da aba) para a falha de carregamento. */
export function loadErrorTitle(error: Error, texts: LoadErrorTexts): string {
  return isNotFoundError(error) ? texts.notFound : texts.failed
}
