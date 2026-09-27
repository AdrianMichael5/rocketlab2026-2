import { ApiError } from './client'

// Prefixo que o Pydantic põe nas mensagens de validadores próprios (ValueError).
const PYDANTIC_PREFIX = /^Value error, /

export interface SplitErrors<C extends string> {
  /** Primeiro erro de cada campo conhecido. */
  fields: Partial<Record<C, string>>
  /** Erros sem campo conhecido (ou do objeto inteiro); null se não houver. */
  general: string | null
}

/**
 * Separa um erro da API para exibir no formulário: erros 422 de campos conhecidos
 * vão para o campo ("diretores.0" conta como "diretores"); o resto vira mensagem geral.
 */
export function splitFieldErrors<C extends string>(
  error: Error,
  campos: readonly C[],
): SplitErrors<C> {
  if (!(error instanceof ApiError) || error.fieldErrors.length === 0) {
    return { fields: {}, general: error.message }
  }
  const isCampo = (campo: string): campo is C => (campos as readonly string[]).includes(campo)
  const issues = error.fieldErrors.map(({ campo, mensagem }) => ({
    campo: campo.split('.')[0],
    mensagem: mensagem.replace(PYDANTIC_PREFIX, ''),
  }))
  const known = issues.filter(({ campo }) => isCampo(campo))
  const others = issues.filter(({ campo }) => !isCampo(campo))
  // Invertido para o primeiro erro de cada campo prevalecer em fromEntries.
  const fields = Object.fromEntries(
    known.toReversed().map(({ campo, mensagem }) => [campo, mensagem]),
  ) as Partial<Record<C, string>>
  return {
    fields,
    general: others.length > 0 ? others.map(({ mensagem }) => mensagem).join(' ') : null,
  }
}
