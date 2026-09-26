import styles from './Pagination.module.css'

const numberFormat = new Intl.NumberFormat('pt-BR')

interface PaginationProps {
  /** Página atual, a partir de 1. */
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

/** Anterior / "Página X de Y" / Próxima; some quando há uma página só. */
export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) {
    return null
  }

  return (
    <nav aria-label="Paginação" className={styles.pagination}>
      <button
        type="button"
        className={styles.button}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <span aria-hidden="true">←</span> Anterior
      </button>
      <p className={styles.status} aria-live="polite">
        Página {numberFormat.format(page)} de {numberFormat.format(totalPages)}
      </p>
      <button
        type="button"
        className={styles.button}
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Próxima <span aria-hidden="true">→</span>
      </button>
    </nav>
  )
}
