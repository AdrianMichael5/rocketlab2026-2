// Nota de 0 a 10, a mesma escala do banco, da API e dos dados recebidos.

export const MIN_NOTA = 0
export const MAX_NOTA = 10

/** Opções do formulário de avaliação: inteiros de 0 a 10. */
export const NOTA_OPTIONS: readonly number[] = Array.from(
  { length: MAX_NOTA - MIN_NOTA + 1 },
  (_, index) => MIN_NOTA + index,
)

/** Média sempre com uma casa ("8,0", "7,5"): deixa claro que é uma média. */
const mediaFormat = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
/** Nota individual sem ",0" ("8", "9,8"): as notas antigas do CSV têm decimais. */
const notaFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

export function formatNota(nota: number, media = false): string {
  return (media ? mediaFormat : notaFormat).format(nota)
}

/** Nome acessível: "Nota 8 de 10" ou "Nota média 7,5 de 10". */
export function notaLabel(nota: number, media = false): string {
  return `${media ? 'Nota média' : 'Nota'} ${formatNota(nota, media)} de ${MAX_NOTA}`
}

const countFormat = new Intl.NumberFormat('pt-BR')

/** "1 avaliação", "5 avaliações", "1.500 avaliações". */
export function reviewCountLabel(qtd: number): string {
  return `${countFormat.format(qtd)} ${qtd === 1 ? 'avaliação' : 'avaliações'}`
}
