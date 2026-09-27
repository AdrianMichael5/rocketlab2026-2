import { Link } from 'react-router-dom'
import { StatusMessage } from '../../components/StatusMessage/StatusMessage'
import { isMovieNotFound, movieLoadErrorTitle } from './loadError'

interface MovieLoadErrorProps {
  error: Error
  isRetrying: boolean
  onRetry: () => void
  /** A mensagem é o conteúdo da página inteira: o título vira o <h1>. */
  isPageTitle?: boolean
}

/** Falha ao carregar um filme: "não encontrado" no 404, erro com nova tentativa no resto. */
export function MovieLoadError({
  error,
  isRetrying,
  onRetry,
  isPageTitle = false,
}: MovieLoadErrorProps) {
  const title = movieLoadErrorTitle(error)
  const headingLevel = isPageTitle ? 1 : 2

  if (isMovieNotFound(error)) {
    return (
      <StatusMessage
        title={title}
        headingLevel={headingLevel}
        description="Ele pode ter sido removido ou o endereço está incorreto."
        action={<Link to="/">Voltar para os filmes</Link>}
      />
    )
  }
  return (
    <StatusMessage
      tone="error"
      title={title}
      headingLevel={headingLevel}
      description={error.message}
      action={
        <button type="button" disabled={isRetrying} onClick={onRetry}>
          {isRetrying ? 'Tentando…' : 'Tentar novamente'}
        </button>
      }
    />
  )
}
