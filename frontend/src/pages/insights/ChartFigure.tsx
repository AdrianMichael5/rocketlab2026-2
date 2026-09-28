import { type ReactElement, type ReactNode, useId } from 'react'
import { ResponsiveContainer } from 'recharts'
import styles from './Insights.module.css'

interface ChartFigureProps {
  title: string
  /** Nota curta abaixo do título (ex.: de onde vêm os dados). */
  note?: ReactNode
  /** Altura do gráfico em px; a largura acompanha o contêiner. */
  height: number
  /** Sem dados: mostra `emptyMessage` no lugar do gráfico. */
  isEmpty: boolean
  emptyMessage: string
  /** Gráfico Recharts (filho único do ResponsiveContainer). */
  chart: ReactElement
  /** Os mesmos dados em tabela: alternativa acessível e sem depender de cor. */
  table: ReactNode
}

/** Gráfico com título, nota e tabela de dados recolhível. */
export function ChartFigure({
  title,
  note,
  height,
  isEmpty,
  emptyMessage,
  chart,
  table,
}: ChartFigureProps) {
  const titleId = useId()

  if (isEmpty) {
    return (
      <section aria-labelledby={titleId} className={styles.card}>
        <h2 id={titleId} className={styles.cardTitle}>
          {title}
        </h2>
        <p className={styles.empty}>{emptyMessage}</p>
      </section>
    )
  }

  return (
    <figure aria-labelledby={titleId} className={styles.card}>
      <figcaption className={styles.caption}>
        <h2 id={titleId} className={styles.cardTitle}>
          {title}
        </h2>
        {note && <p className={styles.note}>{note}</p>}
      </figcaption>
      <div className={styles.chart} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {chart}
        </ResponsiveContainer>
      </div>
      <details className={styles.dataTable}>
        <summary>Ver dados em tabela</summary>
        {table}
      </details>
    </figure>
  )
}
