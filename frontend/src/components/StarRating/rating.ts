// Conversões entre a nota da API (0–10) e as estrelas exibidas (0–5, de meia em meia).
// Decisão documentada no README: nota = estrelas × 2.

export const STAR_COUNT = 5
export const STAR_STEP = 0.5
const MAX_NOTA = 10

export type StarFill = 'full' | 'half' | 'empty'

/** Nota 0–10 → estrelas 0–5, arredondando para a meia estrela mais próxima. */
export function notaToStars(nota: number | null): number | null {
  if (nota === null) {
    return null
  }
  const limitada = Math.min(Math.max(nota, 0), MAX_NOTA)
  return Math.round(limitada) / 2
}

export function starsToNota(estrelas: number): number {
  return estrelas * 2
}

/** Preenchimento da estrela na posição 1–5 para um total de estrelas. */
export function starFill(estrelas: number | null, posicao: number): StarFill {
  if (estrelas === null || estrelas <= posicao - 1) {
    return 'empty'
  }
  return estrelas >= posicao ? 'full' : 'half'
}

const numberFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

export function formatStars(estrelas: number): string {
  return numberFormat.format(estrelas)
}

/** "0,5 estrela", "1,5 estrela", "2 estrelas" — plural a partir de 2. */
export function starsLabel(estrelas: number): string {
  return `${formatStars(estrelas)} ${estrelas < 2 ? 'estrela' : 'estrelas'}`
}

const countFormat = new Intl.NumberFormat('pt-BR')

/** "1 avaliação", "5 avaliações", "1.500 avaliações". */
export function reviewCountLabel(qtd: number): string {
  return `${countFormat.format(qtd)} ${qtd === 1 ? 'avaliação' : 'avaliações'}`
}
