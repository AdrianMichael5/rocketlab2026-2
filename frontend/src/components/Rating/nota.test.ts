import { describe, expect, it } from 'vitest'
import { NOTA_OPTIONS, formatNota, notaLabel, reviewCountLabel } from './nota'

describe('NOTA_OPTIONS', () => {
  it('vai de 0 a 10 em passos de 1', () => {
    expect(NOTA_OPTIONS).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })
})

describe('formatNota', () => {
  it('mostra a nota individual com vírgula e sem ",0"', () => {
    expect(formatNota(8)).toBe('8')
    expect(formatNota(9.8)).toBe('9,8')
  })

  it('mostra a média sempre com uma casa decimal', () => {
    expect(formatNota(8, true)).toBe('8,0')
    expect(formatNota(7.25, true)).toBe('7,3')
    expect(formatNota(10, true)).toBe('10,0')
  })
})

describe('notaLabel', () => {
  it('diferencia nota individual e média', () => {
    expect(notaLabel(8)).toBe('Nota 8 de 10')
    expect(notaLabel(7.5, true)).toBe('Nota média 7,5 de 10')
  })
})

describe('reviewCountLabel', () => {
  it('usa o singular para uma avaliação', () => {
    expect(reviewCountLabel(1)).toBe('1 avaliação')
  })

  it('usa o plural e separador de milhar', () => {
    expect(reviewCountLabel(0)).toBe('0 avaliações')
    expect(reviewCountLabel(1500)).toBe('1.500 avaliações')
  })
})
