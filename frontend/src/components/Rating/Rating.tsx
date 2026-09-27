import styles from './Rating.module.css'
import { MAX_NOTA, formatNota, notaLabel } from './nota'

type RatingSize = 'sm' | 'md' | 'lg'

interface RatingProps {
  /** Nota de 0 a 10 da API. */
  value: number
  /** Média do filme: sempre uma casa decimal e nome "Nota média". */
  media?: boolean
  size?: RatingSize
}

/** Selo com a nota de 0 a 10 ("7,5/10"), anunciado como "Nota média 7,5 de 10". */
export function Rating({ value, media = false, size = 'md' }: RatingProps) {
  return (
    <span role="img" aria-label={notaLabel(value, media)} className={`${styles.rating} ${styles[size]}`}>
      <span className={styles.value}>{formatNota(value, media)}</span>
      <span className={styles.scale}>/{MAX_NOTA}</span>
    </span>
  )
}
