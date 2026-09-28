import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import type { RankedMovie } from '../../api/types'
import { POSTER_PLACEHOLDER } from '../../components/MovieCard/poster'
import styles from './Insights.module.css'

interface MovieRankingProps<T extends RankedMovie> {
  title: string
  /** Critério do ranking, exibido abaixo do título. */
  hint: string
  items: T[]
  emptyMessage: string
  /** Valor que justifica a posição (nota, lucro...). */
  renderValue: (item: T) => string
}

/** Top N de filmes; cada item leva ao detalhe do filme. */
export function MovieRanking<T extends RankedMovie>({
  title,
  hint,
  items,
  emptyMessage,
  renderValue,
}: MovieRankingProps<T>) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className={styles.card}>
      <h2 id={titleId} className={styles.cardTitle}>
        {title}
      </h2>
      <p className={styles.note}>{hint}</p>
      {items.length === 0 ? (
        <p className={styles.empty}>{emptyMessage}</p>
      ) : (
        <ol className={styles.ranking}>
          {items.map((item, index) => (
            <li key={item.sk_movie_id}>
              <Link to={`/filmes/${item.sk_movie_id}`} className={styles.rankingLink}>
                <span className={styles.position} aria-hidden="true">
                  {index + 1}
                </span>
                <RankingPoster url={item.url_poster} />
                <span className={styles.rankingText}>
                  <span className={styles.rankingTitle}>{item.titulo}</span>
                  {item.ano_lancamento !== null && (
                    <span className={styles.rankingYear}> ({item.ano_lancamento})</span>
                  )}
                  <span className={styles.rankingValue}>{renderValue(item)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function RankingPoster({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false)
  return (
    <img
      className={styles.poster}
      src={url && !failed ? url : POSTER_PLACEHOLDER}
      alt=""
      width={40}
      height={60}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}
