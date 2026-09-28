import { request } from './client'
import type { PersonDetail } from './types'

/** Tamanho da página da filmografia: o mesmo da grade do catálogo. */
export const PERSON_PAGE_SIZE = 24

export function getPerson(
  skPersonId: string,
  page: number,
  signal?: AbortSignal,
): Promise<PersonDetail> {
  return request(`/people/${encodeURIComponent(skPersonId)}`, {
    params: { page, page_size: PERSON_PAGE_SIZE },
    signal,
  })
}
