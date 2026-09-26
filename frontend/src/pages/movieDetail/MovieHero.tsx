import { type ReactNode, useState } from 'react'
import type { MovieDetail } from '../../api/types'
import { POSTER_PLACEHOLDER } from '../../components/MovieCard/poster'
import { StarRating } from '../../components/StarRating/StarRating'
import { formatRatingSummary } from './format'
import styles from './MovieHero.module.css'

// Tamanho do pôster w500 do TMDB (2:3); reserva o espaço antes da imagem carregar.
const POSTER_WIDTH = 500
const POSTER_HEIGHT = 750

interface MovieHeroProps {
  movie: MovieDetail
  /** Botões de ação do filme (Editar, Remover). */
  actions: ReactNode
}

/** Topo do detalhe: imagem de fundo, pôster, título, ano, média e ações. */
export function MovieHero({ movie, actions }: MovieHeroProps) {
  const [posterFailed, setPosterFailed] = useState(false)
  const [backdropFailed, setBackdropFailed] = useState(false)
  const posterSrc = movie.url_poster && !posterFailed ? movie.url_poster : POSTER_PLACEHOLDER
  // Sem fundo (ou se falhar), fica o gradiente do CSS.
  const backdropSrc = backdropFailed ? null : movie.url_backdrop
  const summary = formatRatingSummary(movie.avaliacoes)

  return (
    <header className={styles.hero}>
      <div className={styles.backdrop}>
        {backdropSrc && (
          <img
            className={styles.backdropImage}
            src={backdropSrc}
            alt=""
            onError={() => setBackdropFailed(true)}
          />
        )}
      </div>
      <div className={styles.content}>
        <img
          className={styles.poster}
          src={posterSrc}
          alt={`Pôster de ${movie.titulo}`}
          width={POSTER_WIDTH}
          height={POSTER_HEIGHT}
          onError={() => setPosterFailed(true)}
        />
        <div className={styles.info}>
          <h1 className={styles.title}>{movie.titulo}</h1>
          {movie.ano_lancamento !== null && <p className={styles.year}>{movie.ano_lancamento}</p>}
          {summary === null ? (
            <p className={styles.noRating}>Sem avaliações</p>
          ) : (
            <p className={styles.rating}>
              <StarRating value={movie.avaliacoes.nota_media} />
              <span>{summary}</span>
            </p>
          )}
          <div className={styles.actions}>{actions}</div>
        </div>
      </div>
    </header>
  )
}
