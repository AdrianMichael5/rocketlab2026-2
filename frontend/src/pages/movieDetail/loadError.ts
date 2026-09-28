import { type LoadErrorTexts, loadErrorTitle } from '../../components/LoadError/loadErrorTexts'

export const MOVIE_LOAD_ERROR_TEXTS: LoadErrorTexts = {
  notFound: 'Filme não encontrado',
  failed: 'Não foi possível carregar o filme',
}

/** Título da mensagem (e da aba) quando o filme não pôde ser carregado. */
export function movieLoadErrorTitle(error: Error): string {
  return loadErrorTitle(error, MOVIE_LOAD_ERROR_TEXTS)
}
