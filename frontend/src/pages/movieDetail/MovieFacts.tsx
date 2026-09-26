import { useId } from 'react'
import type { MovieDetail } from '../../api/types'
import { type FactRow, formatDuration, formatReleaseDate, performanceRows } from './format'
import styles from './MovieFacts.module.css'

interface MovieFactsProps {
  movie: MovieDetail
}

function joined(items: string[]): string | null {
  return items.length > 0 ? items.join(', ') : null
}

/** Ficha técnica; a duração sempre aparece ("—" quando desconhecida), o resto só se existir. */
function infoRows(movie: MovieDetail): FactRow[] {
  const rows: [string, string | null][] = [
    ['Direção', joined(movie.diretores)],
    ['Gêneros', joined(movie.generos)],
    ['Duração', formatDuration(movie.duracao_minutos)],
    ['Status', movie.status_filme],
    ['Lançamento', formatReleaseDate(movie.data_lancamento)],
    ['Roteiro', joined(movie.roteiristas)],
    ['Produtoras', joined(movie.produtoras)],
  ]
  return rows.flatMap(([label, value]) => (value === null ? [] : [{ label, value }]))
}

/** Sinopse, elenco, ficha técnica e bilheteria do filme. */
export function MovieFacts({ movie }: MovieFactsProps) {
  const castId = useId()
  const performance = performanceRows(movie.performance)

  return (
    <div className={styles.facts}>
      <div className={styles.main}>
        {movie.sinopse && (
          <section className={styles.section}>
            <h2 className={styles.heading}>Sinopse</h2>
            <p className={styles.synopsis}>{movie.sinopse}</p>
          </section>
        )}
        {movie.atores.length > 0 && (
          <section className={styles.section}>
            <h2 id={castId} className={styles.heading}>
              Elenco
            </h2>
            <ul role="list" aria-labelledby={castId} className={styles.cast}>
              {movie.atores.map((ator, index) => (
                <li key={`${index}-${ator}`}>{ator}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <div className={styles.side}>
        <section className={styles.section}>
          <h2 className={styles.heading}>Ficha técnica</h2>
          <FactList rows={infoRows(movie)} />
        </section>
        {performance.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.heading}>Bilheteria e notas externas</h2>
            <FactList rows={performance} />
          </section>
        )}
      </div>
    </div>
  )
}

function FactList({ rows }: { rows: FactRow[] }) {
  return (
    <dl className={styles.list}>
      {rows.map(({ label, value }) => (
        <div key={label} className={styles.row}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
