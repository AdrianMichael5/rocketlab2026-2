import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  type CatalogParams,
  DEFAULT_CATALOG_PARAMS,
  parseCatalogParams,
  toSearchParams,
} from './catalogParams'

export interface UpdateOptions {
  /** Substitui a entrada do histórico em vez de criar outra (ex.: digitação). */
  replace?: boolean
}

export type UpdateCatalogParams = (patch: Partial<CatalogParams>, options?: UpdateOptions) => void

interface CatalogParamsState {
  params: CatalogParams
  update: UpdateCatalogParams
  clear: () => void
}

/** Estado do catálogo na URL. Mudar busca, filtro ou ordem volta para a página 1. */
export function useCatalogParams(): CatalogParamsState {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = useMemo(() => parseCatalogParams(searchParams), [searchParams])

  const update = useCallback<UpdateCatalogParams>(
    (patch, options) => {
      setSearchParams(
        (current) =>
          toSearchParams({
            ...parseCatalogParams(current),
            ...patch,
            page: patch.page ?? DEFAULT_CATALOG_PARAMS.page,
          }),
        options,
      )
    },
    [setSearchParams],
  )

  const clear = useCallback(() => update(DEFAULT_CATALOG_PARAMS), [update])

  return { params, update, clear }
}
