import type { Locator, Page } from '@playwright/test'

/** Catálogo (/): busca, lista de filmes e estados vazios. */
export class CatalogPage {
  readonly page: Page
  readonly heading: Locator
  readonly searchInput: Locator
  readonly results: Locator
  readonly noResults: Locator
  readonly clearFilters: Locator

  constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole('heading', { level: 1, name: 'Filmes' })
    this.searchInput = page.getByRole('searchbox', { name: 'Buscar por título' })
    this.results = page.getByRole('list', { name: 'Filmes' })
    this.noResults = page.getByRole('heading', { name: 'Nenhum filme encontrado' })
    this.clearFilters = page.getByRole('button', { name: 'Limpar filtros' })
  }

  async goto(): Promise<void> {
    await this.page.goto('/')
    await this.heading.waitFor()
  }

  /** Digita a busca e aplica com Enter (sem esperar o debounce). */
  async search(text: string): Promise<void> {
    await this.searchInput.fill(text)
    await this.searchInput.press('Enter')
  }

  movieLink(titulo: string): Locator {
    return this.results.getByRole('link', { name: titulo, exact: true })
  }

  movieCard(titulo: string): Locator {
    // O locator de `has` é relativo ao item, por isso parte de page e não de results.
    const link = this.page.getByRole('link', { name: titulo, exact: true })
    return this.results.getByRole('listitem').filter({ has: link })
  }

  async openMovie(titulo: string): Promise<void> {
    await this.movieLink(titulo).click()
  }
}
