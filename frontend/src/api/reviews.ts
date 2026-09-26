import { request } from './client'
import type { Page, ReviewCreate, ReviewOut, ReviewPageParams } from './types'

const movieReviewsPath = (skMovieId: string): string =>
  `/movies/${encodeURIComponent(skMovieId)}/reviews`

/** Avaliações do filme, da mais recente para a mais antiga. */
export function listReviews(
  skMovieId: string,
  params: ReviewPageParams = {},
  signal?: AbortSignal,
): Promise<Page<ReviewOut>> {
  return request(movieReviewsPath(skMovieId), { params, signal })
}

/** Cria a avaliação; o backend recalcula a média do filme na mesma transação. */
export function createReview(skMovieId: string, payload: ReviewCreate): Promise<ReviewOut> {
  return request(movieReviewsPath(skMovieId), { method: 'POST', body: payload })
}

export function deleteReview(skMovieReviewId: string): Promise<void> {
  return request(`/reviews/${encodeURIComponent(skMovieReviewId)}`, { method: 'DELETE' })
}
