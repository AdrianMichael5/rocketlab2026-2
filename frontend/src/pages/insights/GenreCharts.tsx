import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from 'recharts'
import type { GeneroStats } from '../../api/types'
import { reviewCountLabel } from '../../components/Rating/nota'
import { ChartFigure } from './ChartFigure'
import {
  AXIS_LINE,
  AXIS_TICK,
  BAR_RADIUS_HORIZONTAL,
  formatNotaDe10,
  GRID_STROKE,
  LEGEND_TEXT_STYLE,
  NOTA_DOMAIN,
  NOTA_TICKS,
  notaTooltipFormatter,
  SERIES,
  TOOLTIP_STYLE,
} from './chartTheme'
import styles from './Insights.module.css'

const EMPTY_MESSAGE = 'Ainda não há avaliações de usuários.'
const GENRE_AXIS_WIDTH = 116
const CHART_PADDING = 48
const ROW_HEIGHT_SINGLE = 28
const ROW_HEIGHT_GROUPED = 54
const LEGEND_HEIGHT = 32
const CHART_MARGIN = { top: 4, right: 16, bottom: 4, left: 0 }

interface GenreChartProps {
  generos: GeneroStats[]
}

function GenreAxis() {
  return (
    <YAxis
      type="category"
      dataKey="genero"
      width={GENRE_AXIS_WIDTH}
      tick={AXIS_TICK}
      axisLine={AXIS_LINE}
      tickLine={false}
      interval={0}
    />
  )
}

function NotaAxis() {
  return (
    <XAxis
      type="number"
      domain={NOTA_DOMAIN}
      ticks={NOTA_TICKS}
      tick={AXIS_TICK}
      axisLine={AXIS_LINE}
      tickLine={false}
    />
  )
}

/** Média das notas dos usuários por gênero (uma série, barras horizontais). */
export function GenreRatingChart({ generos }: GenreChartProps) {
  return (
    <ChartFigure
      title="Média dos usuários por gênero"
      note="Média de todas as avaliações dos filmes de cada gênero, de 0 a 10."
      height={generos.length * ROW_HEIGHT_SINGLE + CHART_PADDING}
      isEmpty={generos.length === 0}
      emptyMessage={EMPTY_MESSAGE}
      chart={
        <BarChart data={generos} layout="vertical" margin={CHART_MARGIN}>
          <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
          <NotaAxis />
          <GenreAxis />
          <Tooltip {...TOOLTIP_STYLE} formatter={notaTooltipFormatter} />
          <Bar
            dataKey="media_usuarios"
            name={SERIES.usuarios.label}
            fill={SERIES.usuarios.color}
            radius={BAR_RADIUS_HORIZONTAL}
            maxBarSize={18}
          />
        </BarChart>
      }
      table={
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Gênero</th>
              <th scope="col">Média</th>
              <th scope="col">Avaliações</th>
            </tr>
          </thead>
          <tbody>
            {generos.map((item) => (
              <tr key={item.genero}>
                <th scope="row">{item.genero}</th>
                <td>{formatNotaDe10(item.media_usuarios)}</td>
                <td>{reviewCountLabel(item.qtd_avaliacoes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  )
}

/** Usuários × IMDb × TMDB por gênero, na mesma escala e no mesmo conjunto de filmes. */
export function GenreComparisonChart({ generos }: GenreChartProps) {
  return (
    <ChartFigure
      title="Usuários × IMDb × TMDB por gênero"
      note="Só filmes com avaliação de usuário, para comparar o mesmo conjunto. Notas zeradas do IMDb/TMDB (sem votos) ficam de fora."
      height={generos.length * ROW_HEIGHT_GROUPED + CHART_PADDING + LEGEND_HEIGHT}
      isEmpty={generos.length === 0}
      emptyMessage={EMPTY_MESSAGE}
      chart={
        <BarChart data={generos} layout="vertical" margin={CHART_MARGIN} barGap={2}>
          <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
          <NotaAxis />
          <GenreAxis />
          <Tooltip {...TOOLTIP_STYLE} formatter={notaTooltipFormatter} />
          {/* itemSorter null: a legenda segue a ordem das séries, não a alfabética. */}
          <Legend
            verticalAlign="top"
            height={LEGEND_HEIGHT}
            wrapperStyle={AXIS_TICK}
            itemSorter={null}
            formatter={(value) => <span style={LEGEND_TEXT_STYLE}>{value}</span>}
          />
          {(
            [
              ['media_usuarios', SERIES.usuarios],
              ['media_imdb', SERIES.imdb],
              ['media_tmdb', SERIES.tmdb],
            ] as const
          ).map(([dataKey, serie]) => (
            <Bar
              key={dataKey}
              dataKey={dataKey}
              name={serie.label}
              fill={serie.color}
              radius={BAR_RADIUS_HORIZONTAL}
              maxBarSize={12}
            />
          ))}
        </BarChart>
      }
      table={
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Gênero</th>
              <th scope="col">{SERIES.usuarios.label}</th>
              <th scope="col">{SERIES.imdb.label}</th>
              <th scope="col">{SERIES.tmdb.label}</th>
            </tr>
          </thead>
          <tbody>
            {generos.map((item) => (
              <tr key={item.genero}>
                <th scope="row">{item.genero}</th>
                <td>{formatNotaDe10(item.media_usuarios)}</td>
                <td>{formatNotaDe10(item.media_imdb)}</td>
                <td>{formatNotaDe10(item.media_tmdb)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  )
}
