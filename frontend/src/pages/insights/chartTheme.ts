// Aparência compartilhada dos gráficos Recharts, a partir dos tokens de styles/theme.css.
// Atributos SVG aceitam var(), então as cores continuam vindo do tema.
import { formatNota, MAX_NOTA, MIN_NOTA } from '../../components/Rating/nota'

export const SERIES = {
  usuarios: { label: 'Usuários', color: 'var(--chart-usuarios)' },
  imdb: { label: 'IMDb', color: 'var(--chart-imdb)' },
  tmdb: { label: 'TMDB', color: 'var(--chart-tmdb)' },
} as const

export const COUNT_COLOR = 'var(--chart-count)'

/** Eixo de notas sempre de 0 a 10, para os gráficos serem comparáveis. */
export const NOTA_DOMAIN: [number, number] = [MIN_NOTA, MAX_NOTA]
export const NOTA_TICKS = [0, 2, 4, 6, 8, 10]

export const AXIS_TICK = { fill: 'var(--color-text-muted)', fontSize: 12 }
export const AXIS_LINE = { stroke: 'var(--color-border-control)' }
export const GRID_STROKE = 'var(--color-border)'

export const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'var(--color-surface-raised)',
    border: '1px solid var(--color-border-control)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text-strong)',
    fontSize: 'var(--font-size-sm)',
  },
  labelStyle: { color: 'var(--color-text-strong)', fontWeight: 600 },
  itemStyle: { color: 'var(--color-text-strong)' },
  cursor: { fill: 'var(--color-surface-raised)', fillOpacity: 0.5 },
  separator: ': ',
}

/** Pontas arredondadas só no fim da barra; a base fica rente ao eixo. */
export const BAR_RADIUS_HORIZONTAL: [number, number, number, number] = [0, 4, 4, 0]
export const BAR_RADIUS_VERTICAL: [number, number, number, number] = [4, 4, 0, 0]

/** Texto da legenda na cor de texto; a cor da série fica só no marcador ao lado. */
export const LEGEND_TEXT_STYLE = { color: 'var(--color-text)' }

const UNKNOWN = '—'

/** "7,5/10", ou "—" sem valor. */
export function formatNotaDe10(nota: number | null | undefined): string {
  return nota === null || nota === undefined ? UNKNOWN : `${formatNota(nota, true)}/${MAX_NOTA}`
}

/** Formatter do Tooltip para séries de nota (o Recharts passa o valor como unknown). */
export function notaTooltipFormatter(value: unknown): string {
  return formatNotaDe10(typeof value === 'number' ? value : null)
}
