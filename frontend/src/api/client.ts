export const DEFAULT_API_URL = 'http://localhost:8000/api/v1'

const NETWORK_ERROR_STATUS = 0
const VALIDATION_ERROR_STATUS = 422
// Primeiro item de `loc` nos erros do FastAPI indica a origem (body, query, path).
const LOC_ORIGINS = new Set(['body', 'query', 'path'])

export interface FieldError {
  /** Caminho do campo no payload (ex.: "nota"); vazio para erros do objeto inteiro. */
  campo: string
  mensagem: string
}

export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: FieldError[]

  constructor(status: number, message: string, fieldErrors: FieldError[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

export type QueryValue = string | number | boolean | null | undefined
export type QueryParams = Readonly<Record<string, QueryValue>>

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  params?: QueryParams
  signal?: AbortSignal
}

export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL?.trim()
  return (configured || DEFAULT_API_URL).replace(/\/+$/, '')
}

export function buildUrl(path: string, params: QueryParams = {}): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value))
    }
  }
  const search = query.toString()
  return `${getApiBaseUrl()}${path}${search ? `?${search}` : ''}`
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params, signal } = options
  const headers = new Headers({ Accept: 'application/json' })
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response
  try {
    response = await fetch(buildUrl(path, params), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    // Cancelamento (ex.: React Query desmontando a consulta) não é erro da API.
    if (isAbortError(error)) {
      throw error
    }
    throw new ApiError(NETWORK_ERROR_STATUS, 'Não foi possível conectar à API')
  }

  if (!response.ok) {
    throw await toApiError(response)
  }
  if (response.status === 204) {
    return undefined as T
  }
  try {
    return (await response.json()) as T
  } catch {
    // Ex.: proxy ou servidor errado devolvendo HTML com status 200.
    throw new ApiError(response.status, 'Resposta inválida da API')
  }
}

// Pelo nome, e não por instanceof: DOMException nem sempre herda de Error (ex.: jsdom).
function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
}

interface ValidationIssue {
  loc?: unknown[]
  msg?: unknown
}

async function toApiError(response: Response): Promise<ApiError> {
  const fallback = `Erro ${response.status} ao acessar a API`
  let detail: unknown
  try {
    detail = ((await response.json()) as { detail?: unknown }).detail
  } catch {
    return new ApiError(response.status, fallback)
  }

  if (typeof detail === 'string') {
    return new ApiError(response.status, detail)
  }
  if (Array.isArray(detail)) {
    const message = response.status === VALIDATION_ERROR_STATUS ? 'Dados inválidos' : fallback
    return new ApiError(response.status, message, detail.map(toFieldError))
  }
  return new ApiError(response.status, fallback)
}

function toFieldError(issue: ValidationIssue): FieldError {
  const loc = Array.isArray(issue.loc) ? issue.loc.map(String) : []
  const path = LOC_ORIGINS.has(loc[0]) ? loc.slice(1) : loc
  return { campo: path.join('.'), mensagem: String(issue.msg ?? 'Valor inválido') }
}
