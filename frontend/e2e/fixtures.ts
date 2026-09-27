import { test as base } from '@playwright/test'
import { CatalogPage } from './pages/CatalogPage.ts'
import { MovieDetailPage } from './pages/MovieDetailPage.ts'
import { MovieFormPage } from './pages/MovieFormPage.ts'
import { MoviesApi } from './support/api.ts'

interface Fixtures {
  api: MoviesApi
  /** Marcador único do teste: nos títulos, a busca por ele só acha dados deste teste. */
  tag: string
  catalog: CatalogPage
  detail: MovieDetailPage
  movieForm: MovieFormPage
}

export const test = base.extend<Fixtures>({
  api: async ({ request }, provide) => {
    const api = new MoviesApi(request)
    await provide(api)
    await api.cleanup()
  },
  // eslint-disable-next-line no-empty-pattern -- o Playwright exige desestruturação aqui
  tag: async ({}, provide, testInfo) => {
    await provide(`e2e${testInfo.workerIndex}x${Date.now().toString(36)}`)
  },
  catalog: async ({ page }, provide) => provide(new CatalogPage(page)),
  detail: async ({ page }, provide) => provide(new MovieDetailPage(page)),
  movieForm: async ({ page }, provide) => provide(new MovieFormPage(page)),
})

export { expect } from '@playwright/test'
