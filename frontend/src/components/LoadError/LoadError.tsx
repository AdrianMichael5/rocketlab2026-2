import { Link } from 'react-router-dom'
import { StatusMessage } from '../StatusMessage/StatusMessage'
import { type LoadErrorTexts, isNotFoundError, loadErrorTitle } from './loadErrorTexts'

interface LoadErrorProps {
  error: Error
  texts: LoadErrorTexts
  /** Explicação exibida no 404. */
  notFoundDescription: string
  isRetrying: boolean
  onRetry: () => void
  /** A mensagem é o conteúdo da página inteira: o título vira o <h1>. */
  isPageTitle?: boolean
}

/** Falha ao carregar um recurso: "não encontrado" no 404, erro com nova tentativa no resto. */
export function LoadError({
  error,
  texts,
  notFoundDescription,
  isRetrying,
  onRetry,
  isPageTitle = false,
}: LoadErrorProps) {
  const title = loadErrorTitle(error, texts)
  const headingLevel = isPageTitle ? 1 : 2

  if (isNotFoundError(error)) {
    return (
      <StatusMessage
        title={title}
        headingLevel={headingLevel}
        description={notFoundDescription}
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
