import { request } from './client'
import type { StatsOut } from './types'

/** Números gerais, rankings e médias por gênero e ano (página de insights). */
export function getStats(signal?: AbortSignal): Promise<StatsOut> {
  return request('/stats', { signal })
}
