import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import type { AnoStats } from '../../api/types'
import { ChartFigure } from './ChartFigure'
import {
  AXIS_LINE,
  AXIS_TICK,
  BAR_RADIUS_VERTICAL,
  COUNT_COLOR,
  GRID_STROKE,
  TOOLTIP_STYLE,
} from './chartTheme'
import styles from './Insights.module.css'

const CHART_HEIGHT = 280
const COUNT_AXIS_WIDTH = 56
const CHART_MARGIN = { top: 8, right: 8, bottom: 4, left: 0 }

const countFormat = new Intl.NumberFormat('pt-BR')
const compactFormat = new Intl.NumberFormat('pt-BR', { notation: 'compact' })

/**
 * Anos sem filmes viram 0 entre o primeiro e o último ano: o eixo é de tempo e um
 * ano ausente sumiria do gráfico em vez de aparecer como vazio.
 */
function fillMissingYears(anos: AnoStats[]): AnoStats[] {
  if (anos.length === 0) {
    return []
  }
  const porAno = new Map(anos.map((item) => [item.ano, item.qtd_filmes]))
  const primeiro = anos[0].ano
  const ultimo = anos[anos.length - 1].ano
  return Array.from({ length: ultimo - primeiro + 1 }, (_, index) => {
    const ano = primeiro + index
    return { ano, qtd_filmes: porAno.get(ano) ?? 0 }
  })
}

function countTooltipFormatter(value: unknown): string {
  return typeof value === 'number' ? countFormat.format(value) : '—'
}

interface YearChartProps {
  anos: AnoStats[]
  /** Ano corrente; anos depois dele são lançamentos anunciados. */
  anoAtual: number
}

/** Quantidade de filmes por ano de lançamento. */
export function YearChart({ anos: anosComFilmes, anoAtual }: YearChartProps) {
  const anos = fillMissingYears(anosComFilmes)
  const temAnosFuturos = anos.some((item) => item.ano > anoAtual)
  return (
    <ChartFigure
      title="Filmes lançados por ano"
      note={temAnosFuturos ? `Anos após ${anoAtual} são lançamentos anunciados.` : undefined}
      height={CHART_HEIGHT}
      isEmpty={anos.length === 0}
      emptyMessage="Nenhum filme com ano de lançamento."
      chart={
        <BarChart data={anos} margin={CHART_MARGIN}>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis dataKey="ano" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
          <YAxis
            width={COUNT_AXIS_WIDTH}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => compactFormat.format(value)}
          />
          <Tooltip {...TOOLTIP_STYLE} formatter={countTooltipFormatter} />
          <Bar
            dataKey="qtd_filmes"
            name="Filmes"
            fill={COUNT_COLOR}
            radius={BAR_RADIUS_VERTICAL}
            maxBarSize={40}
          />
        </BarChart>
      }
      table={
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Ano</th>
              <th scope="col">Filmes</th>
            </tr>
          </thead>
          <tbody>
            {anos.map((item) => (
              <tr key={item.ano}>
                <th scope="row">{item.ano}</th>
                <td>{countFormat.format(item.qtd_filmes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  )
}
