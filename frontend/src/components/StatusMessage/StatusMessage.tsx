import type { ReactNode } from 'react'
import styles from './StatusMessage.module.css'

interface StatusMessageProps {
  title: string
  description?: ReactNode
  /** Botão ou link que resolve a situação (ex.: "Tentar novamente"). */
  action?: ReactNode
  /** "error" anuncia a mensagem na hora para leitores de tela. */
  tone?: 'info' | 'error'
  /** 1 quando a mensagem ocupa a página inteira e é o título dela. */
  headingLevel?: 1 | 2
}

/** Mensagem de estado vazio ou de erro no lugar do conteúdo. */
export function StatusMessage({
  title,
  description,
  action,
  tone = 'info',
  headingLevel = 2,
}: StatusMessageProps) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2'
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={`${styles.message} ${tone === 'error' ? styles.error : ''}`}
    >
      <Heading className={styles.title}>{title}</Heading>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
