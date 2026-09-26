import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { movieKeys } from '../../api/queryKeys'
import { listReviews } from '../../api/reviews'
import { Pagination } from '../../components/Pagination/Pagination'
import { StatusMessage } from '../../components/StatusMessage/StatusMessage'
import { totalPages } from '../catalog/catalogParams'
import { ReviewForm } from './ReviewForm'
import { ReviewList } from './ReviewList'
import styles from './Reviews.module.css'

export const REVIEWS_PAGE_SIZE = 10

interface ReviewsSectionProps {
  skMovieId: string
}

/** Formulário de nova avaliação e lista paginada (mais recentes primeiro). */
export function ReviewsSection({ skMovieId }: ReviewsSectionProps) {
  const headingId = useId()
  const [page, setPage] = useState(1)
  const reviews = useQuery({
    queryKey: movieKeys.reviews(skMovieId, page),
    queryFn: ({ signal }) =>
      listReviews(skMovieId, { page, page_size: REVIEWS_PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
  })

  function renderReviews() {
    if (reviews.isPending) {
      return <p className={styles.muted}>Carregando avaliações…</p>
    }
    if (reviews.isError) {
      return (
        <StatusMessage
          tone="error"
          title="Não foi possível carregar as avaliações"
          description={reviews.error.message}
          action={
            <button type="button" disabled={reviews.isFetching} onClick={() => reviews.refetch()}>
              {reviews.isFetching ? 'Tentando…' : 'Tentar novamente'}
            </button>
          }
        />
      )
    }
    if (reviews.data.total === 0) {
      return <p className={styles.muted}>Nenhuma avaliação ainda. Seja o primeiro a avaliar!</p>
    }
    return (
      <>
        <ReviewList reviews={reviews.data.items} isStale={reviews.isPlaceholderData} />
        <Pagination
          page={page}
          totalPages={totalPages(reviews.data.total, REVIEWS_PAGE_SIZE)}
          onPageChange={setPage}
        />
      </>
    )
  }

  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <h2 id={headingId} className={styles.heading}>
        Avaliações
      </h2>
      {/* A nova avaliação é a mais recente: volta à primeira página para vê-la. */}
      <ReviewForm skMovieId={skMovieId} onCreated={() => setPage(1)} />
      {renderReviews()}
    </section>
  )
}
