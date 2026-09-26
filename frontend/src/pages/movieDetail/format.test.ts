import { describe, expect, it } from 'vitest'
import type { PerformanceOut } from '../../api/types'
import {
  formatDuration,
  formatReleaseDate,
  formatReviewDate,
  formatRatingSummary,
  performanceRows,
} from './format'

// Intl usa espaço não separável entre símbolo e valor ("US$ 5 mi").
const normalize = (text: string): string => text.replace(/\s/g, ' ')

function performance(overrides: Partial<PerformanceOut> = {}): PerformanceOut {
  return {
    orcamento_usd: null,
    receita_usd: null,
    lucro_usd: null,
    orcamento_brl: null,
    receita_brl: null,
    lucro_brl: null,
    popularidade: null,
    nota_tmdb: null,
    qtd_tmdb: null,
    nota_imdb: null,
    qtd_imdb: null,
    ...overrides,
  }
}

describe('formatDuration', () => {
  it('usa travessão quando a duração é 0 (desconhecida)', () => {
    expect(formatDuration(0)).toBe('—')
  })

  it('usa travessão quando a duração é nula', () => {
    expect(formatDuration(null)).toBe('—')
  })

  it('mostra só minutos abaixo de uma hora', () => {
    expect(formatDuration(45)).toBe('45min')
  })

  it('mostra horas e minutos', () => {
    expect(formatDuration(142)).toBe('2h 22min')
  })

  it('omite os minutos em horas exatas', () => {
    expect(formatDuration(120)).toBe('2h')
  })
})

describe('formatRatingSummary', () => {
  it('mostra estrelas, nota de 0 a 10 e quantidade', () => {
    expect(formatRatingSummary({ nota_media: 7.8, qtd_avaliacoes: 5 })).toBe(
      '3,9 ★ · 7,8/10 · 5 avaliações',
    )
  })

  it('não arredonda as estrelas do texto para meia estrela', () => {
    expect(formatRatingSummary({ nota_media: 7.25, qtd_avaliacoes: 2 })).toMatch(/^3,6 ★/)
  })

  it('usa sempre uma casa decimal', () => {
    expect(formatRatingSummary({ nota_media: 8, qtd_avaliacoes: 3 })).toBe(
      '4,0 ★ · 8,0/10 · 3 avaliações',
    )
  })

  it('usa o singular para uma avaliação', () => {
    expect(formatRatingSummary({ nota_media: 10, qtd_avaliacoes: 1 })).toBe(
      '5,0 ★ · 10,0/10 · 1 avaliação',
    )
  })

  it('devolve null quando não há avaliações', () => {
    expect(formatRatingSummary({ nota_media: null, qtd_avaliacoes: 0 })).toBeNull()
  })
})

describe('formatReleaseDate', () => {
  it('formata a data por extenso sem deslocar o dia pelo fuso', () => {
    expect(formatReleaseDate('1979-05-25')).toBe('25 de maio de 1979')
  })

  it('devolve null sem data', () => {
    expect(formatReleaseDate(null)).toBeNull()
  })
})

describe('formatReviewDate', () => {
  it('formata a data da avaliação em pt-BR', () => {
    expect(formatReviewDate('2026-09-25T12:00:00Z')).toBe('25 de set. de 2026')
  })
})

describe('performanceRows', () => {
  it('não tem linhas sem dados de bilheteria', () => {
    expect(performanceRows(null)).toEqual([])
    expect(performanceRows(performance())).toEqual([])
  })

  it('junta dólar e real na mesma linha, em formato compacto', () => {
    const rows = performanceRows(performance({ orcamento_usd: 5_000_000, orcamento_brl: 25_000_000 }))

    expect(rows.map((row) => ({ ...row, value: normalize(row.value) }))).toEqual([
      { label: 'Orçamento', value: 'US$ 5 mi · R$ 25 mi' },
    ])
  })

  it('mostra só a moeda disponível e valores negativos', () => {
    const rows = performanceRows(performance({ lucro_usd: -2_500_000 }))

    expect(normalize(rows[0].value)).toBe('-US$ 2,5 mi')
  })

  it('mostra notas externas com a quantidade de votos', () => {
    const rows = performanceRows(performance({ nota_imdb: 7.3, qtd_imdb: 2375 }))

    expect(rows).toEqual([{ label: 'Nota IMDb', value: '7,3 (2.375 votos)' }])
  })

  it('mostra a nota externa sem votos quando a quantidade falta', () => {
    const rows = performanceRows(performance({ nota_tmdb: 6 }))

    expect(rows).toEqual([{ label: 'Nota TMDB', value: '6,0' }])
  })

  it('mantém a ordem: valores, notas e popularidade', () => {
    const rows = performanceRows(
      performance({
        popularidade: 12.345,
        nota_tmdb: 7,
        qtd_tmdb: 1,
        receita_usd: 1_200_000_000,
        orcamento_usd: 100,
      }),
    )

    expect(rows.map((row) => row.label)).toEqual([
      'Orçamento',
      'Receita',
      'Nota TMDB',
      'Popularidade',
    ])
    expect(rows[2].value).toBe('7,0 (1 voto)')
    expect(rows[3].value).toBe('12,3')
  })
})
