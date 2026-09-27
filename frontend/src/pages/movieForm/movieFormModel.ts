// Estado, validação e payloads do formulário de filme.
// Limites espelham backend/app/movies/schemas.py; o 422 da API continua valendo como rede.
import type { MovieCreate, MovieDetail, MovieUpdate } from '../../api/types'

export const MIN_ANO = 1888
export const MAX_ANO = 2100
const MAX_TITULO = 500
const MAX_DURACAO = 1000
const MAX_STATUS = 50
const MAX_SINOPSE = 4000
const MAX_URL = 2048
const MAX_NOME_DIRETOR = 255
const MAX_NOME_GENERO = 50
export const MAX_NOMES_POR_LISTA = 20

/** Status presentes nos dados; a API aceita qualquer texto de até 50 caracteres. */
export const STATUS_OPTIONS = ['Lançado', 'Pós-Produção', 'Em Produção', 'Planejado'] as const

export const MOVIE_FIELDS = [
  'titulo',
  'diretores',
  'ano_lancamento',
  'data_lancamento',
  'generos',
  'duracao_minutos',
  'status_filme',
  'sinopse',
  'url_poster',
] as const

export type MovieField = (typeof MOVIE_FIELDS)[number]
export type MovieFormErrors = Partial<Record<MovieField, string>>

/** Valores como os campos os guardam (texto); a conversão acontece no payload. */
export interface MovieFormValues {
  titulo: string
  diretores: string[]
  ano_lancamento: string
  /** AAAA-MM-DD, como o <input type="date"> e a API. */
  data_lancamento: string
  generos: string[]
  duracao_minutos: string
  status_filme: string
  sinopse: string
  url_poster: string
}

export const EMPTY_MOVIE_FORM: MovieFormValues = {
  titulo: '',
  diretores: [],
  ano_lancamento: '',
  data_lancamento: '',
  generos: [],
  duracao_minutos: '',
  status_filme: '',
  sinopse: '',
  url_poster: '',
}

const INTEGER = /^\d+$/
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

function tooLong(max: number): string {
  return `Use no máximo ${max} caracteres.`
}

/** Ano da data AAAA-MM-DD, ou null se não for uma data real (ex.: 30/02). */
function dateYear(value: string): number | null {
  const match = ISO_DATE.exec(value)
  if (!match) {
    return null
  }
  const [ano, mes, dia] = match.slice(1).map(Number)
  const date = new Date(Date.UTC(ano, mes - 1, dia))
  const isReal = date.getUTCMonth() === mes - 1 && date.getUTCDate() === dia
  return isReal ? ano : null
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== ''
  } catch {
    return false
  }
}

function validateNames(
  nomes: string[],
  maxNome: number,
  tooMany: string,
  nameTooLong: string,
): string | undefined {
  if (nomes.length > MAX_NOMES_POR_LISTA) {
    return tooMany
  }
  return nomes.some((nome) => nome.trim().length > maxNome) ? nameTooLong : undefined
}

function validateYearAndDate(values: MovieFormValues): MovieFormErrors {
  const errors: MovieFormErrors = {}
  const ano = values.ano_lancamento.trim()
  const anoValido = INTEGER.test(ano) ? Number(ano) : null
  if (ano !== '' && anoValido === null) {
    errors.ano_lancamento = 'Informe um ano válido.'
  } else if (anoValido !== null && (anoValido < MIN_ANO || anoValido > MAX_ANO)) {
    errors.ano_lancamento = `O ano deve estar entre ${MIN_ANO} e ${MAX_ANO}.`
  }

  const data = values.data_lancamento
  const anoDaData = data === '' ? null : dateYear(data)
  if (data !== '' && anoDaData === null) {
    errors.data_lancamento = 'Informe uma data válida.'
  } else if (anoDaData !== null && (anoDaData < MIN_ANO || anoDaData > MAX_ANO)) {
    errors.data_lancamento = `A data deve ser entre ${MIN_ANO} e ${MAX_ANO}.`
  }

  const ambosValidos = !errors.ano_lancamento && !errors.data_lancamento
  if (ambosValidos && anoValido !== null && anoDaData !== null && anoValido !== anoDaData) {
    errors.ano_lancamento = 'O ano deve ser igual ao da data de lançamento.'
  }
  return errors
}

function validateUrl(value: string): string | undefined {
  const url = value.trim()
  if (url === '') {
    return undefined
  }
  if (url.length > MAX_URL) {
    return tooLong(MAX_URL)
  }
  return isHttpUrl(url) ? undefined : 'Informe uma URL http(s) completa (ex.: https://…).'
}

/** Mesmas regras de MovieCreate/MovieUpdate; objeto vazio = válido. */
export function validateMovie(values: MovieFormValues): MovieFormErrors {
  const titulo = values.titulo.trim()
  const duracao = values.duracao_minutos.trim()
  const errors: MovieFormErrors = {
    ...(titulo === '' && { titulo: 'Informe o título.' }),
    ...(titulo.length > MAX_TITULO && { titulo: tooLong(MAX_TITULO) }),
    ...validateYearAndDate(values),
    ...(duracao !== '' &&
      !(INTEGER.test(duracao) && Number(duracao) <= MAX_DURACAO) && {
        duracao_minutos: `Informe um número inteiro de 0 a ${MAX_DURACAO}.`,
      }),
    ...(values.status_filme.trim().length > MAX_STATUS && { status_filme: tooLong(MAX_STATUS) }),
    ...(values.sinopse.trim().length > MAX_SINOPSE && { sinopse: tooLong(MAX_SINOPSE) }),
    diretores: validateNames(
      values.diretores,
      MAX_NOME_DIRETOR,
      `Informe no máximo ${MAX_NOMES_POR_LISTA} diretores.`,
      `Cada nome pode ter no máximo ${MAX_NOME_DIRETOR} caracteres.`,
    ),
    generos: validateNames(
      values.generos,
      MAX_NOME_GENERO,
      `Informe no máximo ${MAX_NOMES_POR_LISTA} gêneros.`,
      `Cada gênero pode ter no máximo ${MAX_NOME_GENERO} caracteres.`,
    ),
    url_poster: validateUrl(values.url_poster),
  }
  return Object.fromEntries(
    Object.entries(errors).filter(([, message]) => message !== undefined),
  ) as MovieFormErrors
}

/** O ano acompanha a data: está vazio ou é igual ao ano dela (e não foi digitado à parte). */
export function yearFollowsDate(values: MovieFormValues): boolean {
  const ano = values.ano_lancamento.trim()
  return ano === '' || ano === String(dateYear(values.data_lancamento))
}

/**
 * Troca a data e, se o ano acompanha a data, copia o ano dela (como o backend faz no
 * cadastro). Anos fora de 1888–2100 são ignorados: o Chrome manda datas completas a
 * cada dígito do ano (0001, 0019, 0197, 1979) e só a última vale.
 */
export function withReleaseDate(
  values: MovieFormValues,
  data: string,
  followDate: boolean,
): MovieFormValues {
  const anoDaData = dateYear(data)
  const inRange = anoDaData !== null && anoDaData >= MIN_ANO && anoDaData <= MAX_ANO
  const ano = followDate && inRange ? String(anoDaData) : values.ano_lancamento
  return { ...values, data_lancamento: data, ano_lancamento: ano }
}

/** Remove espaços e nomes repetidos sem diferenciar caixa (como _dedupe_casefold). */
export function normalizeNames(nomes: string[]): string[] {
  const vistos = new Set<string>()
  return nomes
    .map((nome) => nome.trim())
    .filter((nome) => {
      const chave = nome.toLocaleLowerCase('pt-BR')
      if (nome === '' || vistos.has(chave)) {
        return false
      }
      vistos.add(chave)
      return true
    })
}

function textOrNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function integerOrNull(value: string): number | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : Number(trimmed)
}

/** Payload do POST; chame só com o formulário válido. */
export function toCreatePayload(values: MovieFormValues): Required<Omit<MovieCreate, 'id_filme'>> {
  return {
    titulo: values.titulo.trim(),
    diretores: normalizeNames(values.diretores),
    generos: normalizeNames(values.generos),
    ano_lancamento: integerOrNull(values.ano_lancamento),
    data_lancamento: textOrNull(values.data_lancamento),
    duracao_minutos: integerOrNull(values.duracao_minutos),
    status_filme: textOrNull(values.status_filme),
    sinopse: textOrNull(values.sinopse),
    url_poster: textOrNull(values.url_poster),
  }
}

/** PATCH só com o que mudou em relação aos valores iniciais (normalizados dos dois lados). */
export function toUpdatePayload(initial: MovieFormValues, current: MovieFormValues): MovieUpdate {
  const before = toCreatePayload(initial)
  const after = toCreatePayload(current)
  const changed = Object.entries(after).filter(([campo, value]) => {
    const previous = before[campo as keyof typeof before]
    return JSON.stringify(value) !== JSON.stringify(previous)
  })
  return Object.fromEntries(changed) as MovieUpdate
}

/** Formulário preenchido com o filme; duração 0 (desconhecida) aparece vazia. */
export function toFormValues(movie: MovieDetail): MovieFormValues {
  return {
    titulo: movie.titulo,
    diretores: movie.diretores,
    ano_lancamento: movie.ano_lancamento === null ? '' : String(movie.ano_lancamento),
    data_lancamento: movie.data_lancamento ?? '',
    generos: movie.generos,
    duracao_minutos: movie.duracao_minutos ? String(movie.duracao_minutos) : '',
    status_filme: movie.status_filme ?? '',
    sinopse: movie.sinopse ?? '',
    url_poster: movie.url_poster ?? '',
  }
}
