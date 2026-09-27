import { describe, expect, it } from 'vitest'
import { movieDetail } from '../../test/apiMock'
import {
  EMPTY_MOVIE_FORM,
  type MovieFormValues,
  isHttpUrl,
  toCreatePayload,
  toFormValues,
  toUpdatePayload,
  validateMovie,
  withReleaseDate,
  yearFollowsDate,
} from './movieFormModel'

function form(overrides: Partial<MovieFormValues> = {}): MovieFormValues {
  return { ...EMPTY_MOVIE_FORM, titulo: 'Alien', ...overrides }
}

describe('validateMovie', () => {
  it('aceita um formulário só com título', () => {
    expect(validateMovie(form())).toEqual({})
  })

  it('exige título (espaços não contam)', () => {
    expect(validateMovie(form({ titulo: '   ' }))).toEqual({ titulo: 'Informe o título.' })
  })

  it('limita o título a 500 caracteres', () => {
    expect(validateMovie(form({ titulo: 'a'.repeat(500) }))).toEqual({})
    expect(validateMovie(form({ titulo: 'a'.repeat(501) })).titulo).toBe(
      'Use no máximo 500 caracteres.',
    )
  })

  it.each([
    ['1888', undefined],
    ['2100', undefined],
    ['1887', 'O ano deve estar entre 1888 e 2100.'],
    ['2101', 'O ano deve estar entre 1888 e 2100.'],
    ['19a9', 'Informe um ano válido.'],
    ['1979.5', 'Informe um ano válido.'],
  ])('valida o ano %s', (ano, erro) => {
    expect(validateMovie(form({ ano_lancamento: ano })).ano_lancamento).toBe(erro)
  })

  it('valida a data de lançamento', () => {
    expect(validateMovie(form({ data_lancamento: '1979-05-25' }))).toEqual({})
    expect(validateMovie(form({ data_lancamento: '1979-02-30' })).data_lancamento).toBe(
      'Informe uma data válida.',
    )
    expect(validateMovie(form({ data_lancamento: '1800-01-01' })).data_lancamento).toBe(
      'A data deve ser entre 1888 e 2100.',
    )
  })

  it('exige que ano e data concordem', () => {
    const errors = validateMovie(form({ ano_lancamento: '1980', data_lancamento: '1979-05-25' }))

    expect(errors).toEqual({ ano_lancamento: 'O ano deve ser igual ao da data de lançamento.' })
  })

  it.each([
    ['0', undefined],
    ['1000', undefined],
    ['1001', 'Informe um número inteiro de 0 a 1000.'],
    ['-5', 'Informe um número inteiro de 0 a 1000.'],
    ['90,5', 'Informe um número inteiro de 0 a 1000.'],
  ])('valida a duração %s', (duracao, erro) => {
    expect(validateMovie(form({ duracao_minutos: duracao })).duracao_minutos).toBe(erro)
  })

  it('limita status e sinopse', () => {
    const errors = validateMovie(
      form({ status_filme: 's'.repeat(51), sinopse: 's'.repeat(4001) }),
    )

    expect(errors).toEqual({
      status_filme: 'Use no máximo 50 caracteres.',
      sinopse: 'Use no máximo 4000 caracteres.',
    })
  })

  it('exige URL http(s) absoluta no pôster', () => {
    expect(validateMovie(form({ url_poster: 'https://img.test/a.jpg' }))).toEqual({})
    expect(validateMovie(form({ url_poster: 'img.test/a.jpg' })).url_poster).toBe(
      'Informe uma URL http(s) completa (ex.: https://…).',
    )
    expect(
      validateMovie(form({ url_poster: `https://img.test/${'a'.repeat(2040)}` })).url_poster,
    ).toBe('Use no máximo 2048 caracteres.')
  })

  it('limita quantidade e tamanho dos nomes de diretores e gêneros', () => {
    const muitos = Array.from({ length: 21 }, (_, i) => `Nome ${i}`)

    expect(validateMovie(form({ diretores: muitos, generos: muitos }))).toEqual({
      diretores: 'Informe no máximo 20 diretores.',
      generos: 'Informe no máximo 20 gêneros.',
    })
    expect(
      validateMovie(form({ diretores: ['d'.repeat(256)], generos: ['g'.repeat(51)] })),
    ).toEqual({
      diretores: 'Cada nome pode ter no máximo 255 caracteres.',
      generos: 'Cada gênero pode ter no máximo 50 caracteres.',
    })
  })
})

describe('isHttpUrl', () => {
  it.each([
    ['https://image.tmdb.org/t/p/w500/a.jpg', true],
    ['http://localhost:8000/a.png', true],
    ['ftp://img.test/a.jpg', false],
    ['javascript:alert(1)', false],
    ['/relativa.jpg', false],
    ['', false],
  ])('%s → %s', (url, esperado) => {
    expect(isHttpUrl(url)).toBe(esperado)
  })
})

describe('withReleaseDate', () => {
  it('preenche o ano com o ano da data quando o ano segue a data', () => {
    expect(withReleaseDate(form(), '1979-05-25', true)).toMatchObject({
      data_lancamento: '1979-05-25',
      ano_lancamento: '1979',
    })
  })

  it('não troca um ano digitado pelo usuário', () => {
    const values = form({ ano_lancamento: '1980' })

    expect(withReleaseDate(values, '1979-05-25', false).ano_lancamento).toBe('1980')
  })

  it('não preenche o ano com data incompleta', () => {
    expect(withReleaseDate(form(), '', true).ano_lancamento).toBe('')
  })

  it('ignora os anos parciais que o Chrome envia ao digitar o ano (regressão)', () => {
    // Em dd/mm/aaaa o ano é digitado por último: 0001 → 0019 → 0197 → 1979.
    let values = form()
    for (const data of ['0001-05-25', '0019-05-25', '0197-05-25']) {
      values = withReleaseDate(values, data, true)
      expect(values.ano_lancamento).toBe('')
    }

    expect(withReleaseDate(values, '1979-05-25', true).ano_lancamento).toBe('1979')
  })

  it('acompanha a troca de data enquanto o ano segue a data (regressão)', () => {
    const values = withReleaseDate(form(), '1979-05-25', true)

    expect(withReleaseDate(values, '1980-01-01', true).ano_lancamento).toBe('1980')
  })
})

describe('yearFollowsDate', () => {
  it.each([
    [{ ano_lancamento: '', data_lancamento: '' }, true],
    [{ ano_lancamento: '', data_lancamento: '1979-05-25' }, true],
    [{ ano_lancamento: '1979', data_lancamento: '1979-05-25' }, true],
    [{ ano_lancamento: '1979', data_lancamento: '' }, false],
    [{ ano_lancamento: '1980', data_lancamento: '1979-05-25' }, false],
  ])('%o → %s', (overrides, esperado) => {
    expect(yearFollowsDate(form(overrides))).toBe(esperado)
  })
})

describe('toCreatePayload', () => {
  it('normaliza textos, números e listas', () => {
    const payload = toCreatePayload(
      form({
        titulo: '  Alien  ',
        diretores: [' Ridley Scott ', 'ridley scott'],
        generos: ['Horror'],
        ano_lancamento: '1979',
        data_lancamento: '1979-05-25',
        duracao_minutos: '117',
        status_filme: 'Lançado',
        sinopse: '  Espaço.  ',
        url_poster: ' https://img.test/a.jpg ',
      }),
    )

    expect(payload).toEqual({
      titulo: 'Alien',
      diretores: ['Ridley Scott'],
      generos: ['Horror'],
      ano_lancamento: 1979,
      data_lancamento: '1979-05-25',
      duracao_minutos: 117,
      status_filme: 'Lançado',
      sinopse: 'Espaço.',
      url_poster: 'https://img.test/a.jpg',
    })
  })

  it('manda null para opcionais vazios', () => {
    expect(toCreatePayload(form({ sinopse: '   ' }))).toEqual({
      titulo: 'Alien',
      diretores: [],
      generos: [],
      ano_lancamento: null,
      data_lancamento: null,
      duracao_minutos: null,
      status_filme: null,
      sinopse: null,
      url_poster: null,
    })
  })
})

describe('toFormValues', () => {
  it('preenche o formulário a partir do filme', () => {
    expect(toFormValues(movieDetail({ duracao_minutos: 117, sinopse: null }))).toEqual({
      titulo: 'Alien',
      diretores: ['Ridley Scott'],
      generos: ['Horror', 'Ficção científica'],
      ano_lancamento: '1979',
      data_lancamento: '1979-05-25',
      duracao_minutos: '117',
      status_filme: 'Lançado',
      sinopse: '',
      url_poster: 'https://image.tmdb.org/t/p/w500/alien.jpg',
    })
  })

  it('deixa a duração vazia quando é 0 (desconhecida)', () => {
    expect(toFormValues(movieDetail({ duracao_minutos: 0 })).duracao_minutos).toBe('')
  })
})

describe('toUpdatePayload', () => {
  const initial = toFormValues(movieDetail({ duracao_minutos: 0 }))

  it('não envia nada quando nada mudou', () => {
    expect(toUpdatePayload(initial, { ...initial })).toEqual({})
  })

  it('não trata duração 0 intocada como mudança', () => {
    expect(toUpdatePayload(initial, { ...initial, titulo: 'Aliens' })).toEqual({ titulo: 'Aliens' })
  })

  it('envia só os campos alterados, normalizados', () => {
    const current = { ...initial, sinopse: ' Nova. ', generos: ['Horror'], duracao_minutos: '120' }

    expect(toUpdatePayload(initial, current)).toEqual({
      sinopse: 'Nova.',
      generos: ['Horror'],
      duracao_minutos: 120,
    })
  })

  it('envia null para limpar um campo', () => {
    expect(toUpdatePayload(initial, { ...initial, url_poster: '', status_filme: '' })).toEqual({
      url_poster: null,
      status_filme: null,
    })
  })

  it('ignora diferenças só de espaços', () => {
    expect(toUpdatePayload(initial, { ...initial, titulo: ' Alien ' })).toEqual({})
  })
})
