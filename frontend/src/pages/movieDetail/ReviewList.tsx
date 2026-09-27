import type { ReviewOut } from '../../api/types'
import { Rating } from '../../components/Rating/Rating'
import { formatReviewDate } from './format'
import styles from './Reviews.module.css'

interface ReviewListProps {
  reviews: ReviewOut[]
  /** Página anterior exibida enquanto a próxima carrega. */
  isStale?: boolean
}

export function ReviewList({ reviews, isStale = false }: ReviewListProps) {
  return (
    <ul role="list" aria-label="Avaliações" aria-busy={isStale} className={styles.list}>
      {reviews.map((review) => (
        <li key={review.sk_movie_review_id} className={styles.item}>
          <article>
            <header className={styles.itemHeader}>
              <h3 className={styles.name}>{review.nome}</h3>
              <Rating value={review.nota} size="sm" />
              <time dateTime={review.created_at} className={styles.date}>
                {formatReviewDate(review.created_at)}
              </time>
            </header>
            <p className={styles.comment}>{review.comentario}</p>
          </article>
        </li>
      ))}
    </ul>
  )
}
