import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { MovieListItem } from '../../api/types'
import { StarRating } from '../StarRating/StarRating'
import styles from './MovieCard.module.css'
import { POSTER_PLACEHOLDER } from './poster'

// Tamanho do pôster w500 do TMDB (2:3); reserva o espaço antes da imagem carregar.
const POSTER_WIDTH = 500
const POSTER_HEIGHT = 750

const numberFormat = new Intl.NumberFormat('pt-BR')

function reviewCountLabel(qtd: number): string {
  return `${numberFormat.format(qtd)} ${qtd === 1 ? 'avaliação' : 'avaliações'}`
}

interface MovieCardProps {
  movie: MovieListItem
}

export function MovieCard({ movie }: MovieCardProps) {
  const [posterFailed, setPosterFailed] = useState(false)
  const posterSrc = movie.url_poster && !posterFailed ? movie.url_poster : POSTER_PLACEHOLDER

  return (
    <article className={styles.card}>
      <img
        className={styles.poster}
        src={posterSrc}
        alt={`Pôster de ${movie.titulo}`}
        width={POSTER_WIDTH}
        height={POSTER_HEIGHT}
        loading="lazy"
        onError={() => setPosterFailed(true)}
      />
      <div className={styles.body}>
        <h2 className={styles.title}>
          {/* O ::after do link cobre o card inteiro, mantendo só o título como nome. */}
          <Link to={`/filmes/${encodeURIComponent(movie.sk_movie_id)}`} className={styles.link}>
            {movie.titulo}
          </Link>
        </h2>
        {movie.ano_lancamento !== null && <p className={styles.year}>{movie.ano_lancamento}</p>}
        {movie.generos.length > 0 && (
          <p className={styles.genres}>{movie.generos.join(' · ')}</p>
        )}
        {movie.nota_media === null ? (
          <p className={styles.noRating}>Sem avaliações</p>
        ) : (
          <p className={styles.rating}>
            <StarRating value={movie.nota_media} size="sm" />
            <span className={styles.count}>{reviewCountLabel(movie.qtd_avaliacoes)}</span>
          </p>
        )}
      </div>
    </article>
  )
}
