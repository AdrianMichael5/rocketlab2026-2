import { describe, expect, it } from 'vitest'
import { formatStars, notaToStars, reviewCountLabel, starFill, starsToNota } from './rating'

describe('notaToStars', () => {
  it.each([
    [0, 0],
    [1, 0.5],
    [7, 3.5],
    [10, 5],
    // Arredonda para a meia estrela mais próxima.
    [9.8, 5],
    [4.99, 2.5],
    [8.25, 4],
    [8.5, 4.5],
    [0.4, 0],
  ])('nota %s → %s estrelas', (nota, estrelas) => {
    expect(notaToStars(nota)).toBe(estrelas)
  })

  it('limita valores fora de 0–10', () => {
    expect(notaToStars(-3)).toBe(0)
    expect(notaToStars(14)).toBe(5)
  })

  it('mantém null para filmes sem avaliação', () => {
    expect(notaToStars(null)).toBeNull()
  })
})

describe('starsToNota', () => {
  it.each([
    [0.5, 1],
    [3.5, 7],
    [5, 10],
  ])('%s estrelas → nota %s', (estrelas, nota) => {
    expect(starsToNota(estrelas)).toBe(nota)
  })
})

describe('starFill', () => {
  it('preenche estrelas inteiras, meia e vazias', () => {
    expect([1, 2, 3, 4, 5].map((posicao) => starFill(3.5, posicao))).toEqual([
      'full',
      'full',
      'full',
      'half',
      'empty',
    ])
  })

  it('deixa todas vazias sem nota', () => {
    expect([1, 2, 3, 4, 5].map((posicao) => starFill(null, posicao))).toEqual(
      Array(5).fill('empty'),
    )
  })
})

describe('formatStars', () => {
  it('usa vírgula decimal e omite ",0"', () => {
    expect(formatStars(4.5)).toBe('4,5')
    expect(formatStars(3)).toBe('3')
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
