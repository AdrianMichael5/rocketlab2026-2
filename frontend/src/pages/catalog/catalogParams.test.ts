import { describe, expect, it } from 'vitest'
import {
  CATALOG_PAGE_SIZE,
  DEFAULT_CATALOG_PARAMS,
  parseAno,
  parseCatalogParams,
  toMovieFilters,
  toSearchParams,
  totalPages,
} from './catalogParams'

const parse = (query: string) => parseCatalogParams(new URLSearchParams(query))

describe('parseCatalogParams', () => {
  it('usa os padrões quando a URL não tem parâmetros', () => {
    expect(parse('')).toEqual(DEFAULT_CATALOG_PARAMS)
    expect(DEFAULT_CATALOG_PARAMS).toEqual({
      q: '',
      genero: '',
      ano: null,
      ordem: 'titulo',
      page: 1,
    })
  })

  it('lê busca, gênero, ano, ordem e página', () => {
    expect(parse('q=alien&genero=Horror&ano=1979&ordem=nota&page=3')).toEqual({
      q: 'alien',
      genero: 'Horror',
      ano: 1979,
      ordem: 'nota',
      page: 3,
    })
  })

  it.each(['abc', '0', '-2', '1.5', '10001', ''])('página inválida "%s" vira 1', (page) => {
    expect(parse(`page=${page}`).page).toBe(1)
  })

  it('ordem desconhecida vira "titulo"', () => {
    expect(parse('ordem=popularidade').ordem).toBe('titulo')
  })

  it.each(['abc', '1887', '2101', '19.5', ''])('ano inválido "%s" é ignorado', (ano) => {
    expect(parse(`ano=${ano}`).ano).toBeNull()
  })

  it('limita busca e gênero aos tamanhos aceitos pela API', () => {
    const params = parse(`q=${'a'.repeat(250)}&genero=${'g'.repeat(80)}`)

    expect(params.q).toHaveLength(200)
    expect(params.genero).toHaveLength(50)
  })
})

describe('toSearchParams', () => {
  it('omite os valores padrão para manter a URL limpa', () => {
    expect(toSearchParams(DEFAULT_CATALOG_PARAMS).toString()).toBe('')
  })

  it('inclui só o que difere do padrão', () => {
    const search = toSearchParams({ q: 'alien', genero: '', ano: 1979, ordem: 'nota', page: 2 })

    expect(search.toString()).toBe('q=alien&ano=1979&ordem=nota&page=2')
  })

  it('é o inverso de parseCatalogParams', () => {
    const params = {
      q: 'o poderoso',
      genero: 'Ficção científica',
      ano: 1972,
      ordem: 'ano',
      page: 4,
    } as const

    expect(parseCatalogParams(toSearchParams(params))).toEqual(params)
  })
})

describe('toMovieFilters', () => {
  it('converte para os filtros da API, com tamanho de página fixo', () => {
    const params = { q: '  alien ', genero: 'Horror', ano: 1979, ordem: 'nota', page: 2 } as const

    expect(toMovieFilters(params)).toEqual({
      q: 'alien',
      genero: 'Horror',
      ano: 1979,
      ordem: 'nota',
      page: 2,
      page_size: CATALOG_PAGE_SIZE,
    })
  })

  it('omite busca, gênero e ano vazios', () => {
    expect(toMovieFilters({ ...DEFAULT_CATALOG_PARAMS, q: '   ' })).toEqual({
      ordem: 'titulo',
      page: 1,
      page_size: CATALOG_PAGE_SIZE,
    })
  })
})

describe('parseAno', () => {
  it.each([
    ['1979', 1979],
    [' 2001 ', 2001],
    ['1888', 1888],
    ['2100', 2100],
  ])('"%s" → %d', (texto, ano) => {
    expect(parseAno(texto)).toBe(ano)
  })

  it.each(['', '19', '1887', '2101', '19a9', '1979.0'])('"%s" → null', (texto) => {
    expect(parseAno(texto)).toBeNull()
  })
})

describe('totalPages', () => {
  it.each([
    [0, 20, 1],
    [1, 20, 1],
    [20, 20, 1],
    [21, 20, 2],
    [95000, 24, 3959],
  ])('total %d com página de %d → %d páginas', (total, pageSize, expected) => {
    expect(totalPages(total, pageSize)).toBe(expected)
  })
})
