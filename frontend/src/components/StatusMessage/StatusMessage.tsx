import type { ReactNode } from 'react'
import styles from './StatusMessage.module.css'

interface StatusMessageProps {
  title: string
  description?: ReactNode
  /** Botão ou link que resolve a situação (ex.: "Tentar novamente"). */
  action?: ReactNode
  /** "error" anuncia a mensagem na hora para leitores de tela. */
  tone?: 'info' | 'error'
}

/** Mensagem de estado vazio ou de erro no lugar do conteúdo. */
export function StatusMessage({ title, description, action, tone = 'info' }: StatusMessageProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={`${styles.message} ${tone === 'error' ? styles.error : ''}`}
    >
      <h2 className={styles.title}>{title}</h2>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
