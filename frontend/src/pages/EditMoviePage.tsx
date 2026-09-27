import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getMovie, updateMovie } from '../api/movies'
import { movieKeys } from '../api/queryKeys'
import type { MovieDetail } from '../api/types'
import { usePageTitle } from '../hooks/usePageTitle'
import styles from './Page.module.css'
import { MovieLoadError } from './movieDetail/MovieLoadError'
import { MovieForm } from './movieForm/MovieForm'
import { type MovieFormValues, toFormValues, toUpdatePayload } from './movieForm/movieFormModel'
import { useOpenSavedMovie } from './movieForm/useOpenSavedMovie'

/** Edição de filme: carrega o filme, envia só o que mudou e abre o detalhe. */
export function EditMoviePage() {
  usePageTitle('Editar filme')
  const { skMovieId = '' } = useParams()
  const movie = useQuery({
    queryKey: movieKeys.detail(skMovieId),
    queryFn: ({ signal }) => getMovie(skMovieId, signal),
  })

  function renderContent() {
    if (movie.data) {
      // key: trocar de filme reinicia o formulário com os novos valores.
      return <EditMovieForm key={movie.data.sk_movie_id} movie={movie.data} />
    }
    if (movie.isPending) {
      return (
        <p role="status" aria-label="Carregando filme" className={styles.lead}>
          Carregando…
        </p>
      )
    }
    return (
      <MovieLoadError
        error={movie.error}
        isRetrying={movie.isFetching}
        onRetry={() => movie.refetch()}
      />
    )
  }

  return (
    <>
      <section className={styles.header}>
        <h1 className={styles.title}>Editar filme</h1>
        {movie.data && <p className={styles.lead}>{movie.data.titulo}</p>}
      </section>
      {renderContent()}
    </>
  )
}

function EditMovieForm({ movie }: { movie: MovieDetail }) {
  const navigate = useNavigate()
  const openSavedMovie = useOpenSavedMovie()
  // Fixo desde a abertura: se o filme for buscado de novo durante a edição, o PATCH
  // continua comparando com o que o formulário mostrou (e não reverte mudanças alheias).
  const [initial] = useState(() => toFormValues(movie))
  const detailPath = `/filmes/${encodeURIComponent(movie.sk_movie_id)}`

  async function save(values: MovieFormValues) {
    const payload = toUpdatePayload(initial, values)
    if (Object.keys(payload).length === 0) {
      navigate(detailPath, { replace: true })
      return
    }
    openSavedMovie(await updateMovie(movie.sk_movie_id, payload))
  }

  return (
    <MovieForm
      initial={initial}
      submitLabel="Salvar alterações"
      cancelTo={detailPath}
      onSubmit={save}
    />
  )
}
