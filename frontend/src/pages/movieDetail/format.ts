// Formatação dos dados do detalhe do filme para exibição em pt-BR.
import type { PerformanceOut } from '../../api/types'

const UNKNOWN = '—'
const MINUTES_PER_HOUR = 60

/** Uma casa decimal fixa: "3,9", "8,0". */
const oneDecimal = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const integerFormat = new Intl.NumberFormat('pt-BR')
// Datas sem hora (AAAA-MM-DD): interpretadas e exibidas em UTC para não mudar o dia.
const releaseDateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' })
const reviewDateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' })

function moneyFormat(currency: 'USD' | 'BRL'): Intl.NumberFormat {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    notation: 'compact',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })
}
const usdFormat = moneyFormat('USD')
const brlFormat = moneyFormat('BRL')

/** Dólares abreviados: "US$ 2,4 bi", "US$ 950 mi". */
export function formatUsd(valor: number): string {
  return usdFormat.format(valor)
}

/** Duração em "2h 22min"; 0 ou null (desconhecida) viram "—". */
export function formatDuration(minutos: number | null): string {
  if (!minutos) {
    return UNKNOWN
  }
  const horas = Math.floor(minutos / MINUTES_PER_HOUR)
  const resto = minutos % MINUTES_PER_HOUR
  if (horas === 0) {
    return `${resto}min`
  }
  return resto === 0 ? `${horas}h` : `${horas}h ${resto}min`
}

/** "25 de maio de 1979" a partir de "1979-05-25". */
export function formatReleaseDate(isoDate: string | null): string | null {
  return isoDate ? releaseDateFormat.format(new Date(`${isoDate}T00:00:00Z`)) : null
}

/** "25 de set. de 2026" a partir do created_at (ISO 8601 em UTC), no fuso do navegador. */
export function formatReviewDate(isoDateTime: string): string {
  return reviewDateFormat.format(new Date(isoDateTime))
}

/** Linha rótulo/valor das listas de informações do filme. */
export interface FactRow {
  label: string
  value: string
}

function money(usd: number | null, brl: number | null): string | null {
  const parts = [
    usd === null ? null : usdFormat.format(usd),
    brl === null ? null : brlFormat.format(brl),
  ].filter((part) => part !== null)
  return parts.length > 0 ? parts.join(' · ') : null
}

function externalRating(nota: number | null, qtd: number | null): string | null {
  if (nota === null) {
    return null
  }
  if (qtd === null) {
    return oneDecimal.format(nota)
  }
  return `${oneDecimal.format(nota)} (${integerFormat.format(qtd)} ${qtd === 1 ? 'voto' : 'votos'})`
}

/** Linhas de bilheteria e notas externas, só com os valores que existem. */
export function performanceRows(performance: PerformanceOut | null): FactRow[] {
  if (performance === null) {
    return []
  }
  const p = performance
  const rows: [string, string | null][] = [
    ['Orçamento', money(p.orcamento_usd, p.orcamento_brl)],
    ['Receita', money(p.receita_usd, p.receita_brl)],
    ['Lucro', money(p.lucro_usd, p.lucro_brl)],
    ['Nota TMDB', externalRating(p.nota_tmdb, p.qtd_tmdb)],
    ['Nota IMDb', externalRating(p.nota_imdb, p.qtd_imdb)],
    ['Popularidade', p.popularidade === null ? null : oneDecimal.format(p.popularidade)],
  ]
  return rows.flatMap(([label, value]) => (value === null ? [] : [{ label, value }]))
}
