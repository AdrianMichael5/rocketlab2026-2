import { Fragment, type ReactNode, useId } from 'react'
import { Link } from 'react-router-dom'
import type { MovieDetail, PessoaRef } from '../../api/types'
import { formatDuration, formatReleaseDate, performanceRows } from './format'
import styles from './MovieFacts.module.css'

/** Linha da ficha técnica: o valor pode trazer links (pessoas). */
interface InfoRow {
  label: string
  value: ReactNode
}

interface MovieFactsProps {
  movie: MovieDetail
}

function joined(items: string[]): string | null {
  return items.length > 0 ? items.join(', ') : null
}

function personPath(skPersonId: string): string {
  return `/pessoas/${encodeURIComponent(skPersonId)}`
}

function PersonLink({ person }: { person: PessoaRef }) {
  return (
    <Link to={personPath(person.sk_person_id)} className={styles.personLink}>
      {person.nome}
    </Link>
  )
}

/** Nomes separados por vírgula, cada um levando à página da pessoa. */
function personLinks(people: PessoaRef[]): ReactNode {
  if (people.length === 0) {
    return null
  }
  return people.map((person, index) => (
    <Fragment key={person.sk_person_id}>
      {index > 0 && ', '}
      <PersonLink person={person} />
    </Fragment>
  ))
}

/** Ficha técnica; a duração sempre aparece ("—" quando desconhecida), o resto só se existir. */
function infoRows(movie: MovieDetail): InfoRow[] {
  const rows: [string, ReactNode][] = [
    ['Direção', personLinks(movie.creditos.diretores)],
    ['Gêneros', joined(movie.generos)],
    ['Duração', formatDuration(movie.duracao_minutos)],
    ['Status', movie.status_filme],
    ['Lançamento', formatReleaseDate(movie.data_lancamento)],
    ['Roteiro', personLinks(movie.creditos.roteiristas)],
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
        {movie.creditos.atores.length > 0 && (
          <section className={styles.section}>
            <h2 id={castId} className={styles.heading}>
              Elenco
            </h2>
            <ul role="list" aria-labelledby={castId} className={styles.cast}>
              {movie.creditos.atores.map((ator) => (
                <li key={ator.sk_person_id}>
                  <PersonLink person={ator} />
                </li>
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

function FactList({ rows }: { rows: InfoRow[] }) {
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
