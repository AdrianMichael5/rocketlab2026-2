import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteMovie, getMovie } from '../api/movies'
import { movieKeys, personKeys } from '../api/queryKeys'
import type { MovieDetail } from '../api/types'
import { ConfirmDialog } from '../components/ConfirmDialog/ConfirmDialog'
import { usePageTitle } from '../hooks/usePageTitle'
import styles from './MovieDetailPage.module.css'
import { MovieFacts } from './movieDetail/MovieFacts'
import { MovieHero } from './movieDetail/MovieHero'
import { movieLoadErrorTitle } from './movieDetail/loadError'
import { MovieLoadError } from './movieDetail/MovieLoadError'
import { ReviewsSection } from './movieDetail/ReviewsSection'

/** Detalhe do filme: informações, média, avaliações e ações de editar/remover. */
export function MovieDetailPage() {
  const { skMovieId = '' } = useParams()
  const movie = useQuery({
    queryKey: movieKeys.detail(skMovieId),
    queryFn: ({ signal }) => getMovie(skMovieId, signal),
  })
  usePageTitle(movie.data?.titulo ?? (movie.error ? movieLoadErrorTitle(movie.error) : null))

  // Dados antes do erro: uma nova busca que falha não esconde o filme já exibido.
  if (movie.data) {
    // key: trocar de filme reinicia modal e formulário.
    return <MovieDetailContent key={movie.data.sk_movie_id} movie={movie.data} />
  }
  if (movie.isPending) {
    return <LoadingDetail />
  }
  return (
    <MovieLoadError
      isPageTitle
      error={movie.error}
      isRetrying={movie.isFetching}
      onRetry={() => movie.refetch()}
    />
  )
}

function LoadingDetail() {
  return (
    <div role="status" aria-label="Carregando filme" aria-busy="true" className={styles.loading}>
      <div className={styles.loadingBackdrop} />
      <div className={styles.loadingLine} />
      <div className={styles.loadingLine} />
    </div>
  )
}

function MovieDetailContent({ movie }: { movie: MovieDetail }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const removal = useMutation({
    mutationFn: () => deleteMovie(movie.sk_movie_id),
    onSuccess: () => {
      navigate('/', { replace: true })
      queryClient.removeQueries({ queryKey: movieKeys.detail(movie.sk_movie_id) })
      void queryClient.invalidateQueries({ queryKey: movieKeys.lists() })
      void queryClient.invalidateQueries({ queryKey: personKeys.all() })
    },
  })

  function closeConfirm() {
    setConfirmOpen(false)
    removal.reset()
  }

  return (
    <article className={styles.page}>
      <MovieHero
        movie={movie}
        actions={
          <>
            <Link
              to={`/filmes/${encodeURIComponent(movie.sk_movie_id)}/editar`}
              className={styles.edit}
            >
              Editar
            </Link>
            <button type="button" className={styles.remove} onClick={() => setConfirmOpen(true)}>
              Remover
            </button>
          </>
        }
      />
      <MovieFacts movie={movie} />
      <ReviewsSection skMovieId={movie.sk_movie_id} />
      <ConfirmDialog
        open={confirmOpen}
        title="Remover filme?"
        description={`“${movie.titulo}” e todas as avaliações dele serão removidos. Esta ação não pode ser desfeita.`}
        confirmLabel="Remover filme"
        pendingLabel="Removendo…"
        isPending={removal.isPending}
        error={removal.error?.message ?? null}
        onConfirm={() => removal.mutate()}
        onCancel={closeConfirm}
      />
    </article>
  )
}
