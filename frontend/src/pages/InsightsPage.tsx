import { useQuery } from '@tanstack/react-query'
import { useId } from 'react'
import { getStats } from '../api/stats'
import { statsKeys } from '../api/queryKeys'
import type { StatsOut, StatsResumo } from '../api/types'
import { reviewCountLabel } from '../components/Rating/nota'
import { StatusMessage } from '../components/StatusMessage/StatusMessage'
import { usePageTitle } from '../hooks/usePageTitle'
import { formatNotaDe10 } from './insights/chartTheme'
import { GenreComparisonChart, GenreRatingChart } from './insights/GenreCharts'
import styles from './insights/Insights.module.css'
import { MovieRanking } from './insights/MovieRanking'
import { YearChart } from './insights/YearChart'
import { formatUsd } from './movieDetail/format'
import pageStyles from './Page.module.css'

const countFormat = new Intl.NumberFormat('pt-BR')
const SKELETON_KEYS = [0, 1, 2, 3]

/** Página de insights: números gerais, rankings e gráficos do catálogo. */
export function InsightsPage() {
  usePageTitle('Insights')
  const stats = useQuery({
    queryKey: statsKeys.all(),
    queryFn: ({ signal }) => getStats(signal),
    // Avaliações e filmes mudam os números: busca de novo a cada visita (o cache
    // aparece na hora enquanto isso).
    staleTime: 0,
  })

  return (
    <>
      <section className={pageStyles.header}>
        <h1 className={pageStyles.title}>Insights</h1>
        <p className={pageStyles.lead}>Um panorama do catálogo e das avaliações dos usuários.</p>
      </section>

      {stats.isPending ? (
        <LoadingInsights />
      ) : stats.isError ? (
        <StatusMessage
          tone="error"
          title="Não foi possível carregar os insights"
          description={stats.error.message}
          action={
            <button type="button" disabled={stats.isFetching} onClick={() => stats.refetch()}>
              {stats.isFetching ? 'Tentando…' : 'Tentar novamente'}
            </button>
          }
        />
      ) : (
        <InsightsContent stats={stats.data} />
      )}
    </>
  )
}

function InsightsContent({ stats }: { stats: StatsOut }) {
  return (
    <div className={styles.layout}>
      <Summary resumo={stats.resumo} />
      <div className={styles.grid}>
        <MovieRanking
          title="Mais bem avaliados"
          hint="Média dos usuários, entre filmes com 3 ou mais avaliações."
          items={stats.top_avaliados}
          emptyMessage="Nenhum filme com 3 ou mais avaliações ainda."
          renderValue={(item) =>
            `${formatNotaDe10(item.nota_media)} · ${reviewCountLabel(item.qtd_avaliacoes)}`
          }
        />
        <MovieRanking
          title="Maior lucro"
          hint="Receita menos orçamento, em dólares, entre filmes com os dois informados."
          items={stats.top_lucro}
          emptyMessage="Nenhum filme com orçamento e receita informados."
          renderValue={(item) => formatUsd(item.lucro_usd)}
        />
        <GenreRatingChart generos={stats.generos} />
        <YearChart anos={stats.filmes_por_ano} anoAtual={new Date().getFullYear()} />
      </div>
      <GenreComparisonChart generos={stats.generos} />
    </div>
  )
}

function Summary({ resumo }: { resumo: StatsResumo }) {
  const titleId = useId()
  const tiles = [
    { label: 'Filmes', value: countFormat.format(resumo.total_filmes) },
    { label: 'Avaliações', value: countFormat.format(resumo.total_avaliacoes) },
    { label: 'Média geral', value: formatNotaDe10(resumo.media_geral) },
  ]
  return (
    <section aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.visuallyHidden}>
        Números gerais
      </h2>
      <dl className={styles.tiles}>
        {tiles.map((tile) => (
          <div key={tile.label} className={styles.tile}>
            <dt className={styles.tileLabel}>{tile.label}</dt>
            <dd className={styles.tileValue}>{tile.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function LoadingInsights() {
  return (
    <div role="status" aria-label="Carregando insights" aria-busy="true" className={styles.layout}>
      <div className={styles.tiles}>
        {SKELETON_KEYS.slice(0, 3).map((key) => (
          <div key={key} className={`${styles.tile} ${styles.skeleton}`} />
        ))}
      </div>
      <div className={styles.grid}>
        {SKELETON_KEYS.map((key) => (
          <div key={key} className={`${styles.card} ${styles.skeleton} ${styles.skeletonCard}`} />
        ))}
      </div>
    </div>
  )
}
