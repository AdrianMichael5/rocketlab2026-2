import { LoadError } from '../../components/LoadError/LoadError'
import { MOVIE_LOAD_ERROR_TEXTS } from './loadError'

interface MovieLoadErrorProps {
  error: Error
  isRetrying: boolean
  onRetry: () => void
  /** A mensagem é o conteúdo da página inteira: o título vira o <h1>. */
  isPageTitle?: boolean
}

/** Falha ao carregar um filme: "não encontrado" no 404, erro com nova tentativa no resto. */
export function MovieLoadError(props: MovieLoadErrorProps) {
  return (
    <LoadError
      {...props}
      texts={MOVIE_LOAD_ERROR_TEXTS}
      notFoundDescription="Ele pode ter sido removido ou o endereço está incorreto."
    />
  )
}
