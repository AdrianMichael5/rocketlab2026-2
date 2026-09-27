import { describe, expect, it } from 'vitest'
import { ApiError } from './client'
import { splitFieldErrors } from './fieldErrors'

const CAMPOS = ['titulo', 'diretores', 'url_poster'] as const

function validation(...issues: [string, string][]): ApiError {
  return new ApiError(
    422,
    'Dados inválidos',
    issues.map(([campo, mensagem]) => ({ campo, mensagem })),
  )
}

describe('splitFieldErrors', () => {
  it('põe cada erro no seu campo', () => {
    const result = splitFieldErrors(validation(['titulo', 'Obrigatório']), CAMPOS)

    expect(result).toEqual({ fields: { titulo: 'Obrigatório' }, general: null })
  })

  it('agrupa erros de itens de lista no campo da lista', () => {
    const result = splitFieldErrors(validation(['diretores.0', 'Nome longo demais']), CAMPOS)

    expect(result.fields).toEqual({ diretores: 'Nome longo demais' })
  })

  it('mantém o primeiro erro quando o campo tem vários', () => {
    const result = splitFieldErrors(
      validation(['titulo', 'Primeiro'], ['titulo', 'Segundo']),
      CAMPOS,
    )

    expect(result.fields.titulo).toBe('Primeiro')
  })

  it('remove o prefixo "Value error, " do Pydantic', () => {
    const result = splitFieldErrors(
      validation(['url_poster', 'Value error, url_poster deve ser uma URL http(s) absoluta']),
      CAMPOS,
    )

    expect(result.fields.url_poster).toBe('url_poster deve ser uma URL http(s) absoluta')
  })

  it('manda erros sem campo ou de campos desconhecidos para a mensagem geral', () => {
    const result = splitFieldErrors(
      validation(['', 'Value error, ano difere da data'], ['id_filme', 'Repetido']),
      CAMPOS,
    )

    expect(result).toEqual({ fields: {}, general: 'ano difere da data Repetido' })
  })

  it('usa a mensagem do erro quando não há erros de campo (409, 500, rede)', () => {
    const result = splitFieldErrors(new ApiError(409, "id_filme '1' já cadastrado"), CAMPOS)

    expect(result).toEqual({ fields: {}, general: "id_filme '1' já cadastrado" })
  })

  it('aceita erros que não são da API', () => {
    expect(splitFieldErrors(new Error('Falhou'), CAMPOS)).toEqual({ fields: {}, general: 'Falhou' })
  })
})
