import type { Locator, Page } from '@playwright/test'

export interface MovieFormInput {
  titulo?: string
  diretores?: string[]
  ano?: string
  duracao?: string
  generos?: string[]
  status?: string
  sinopse?: string
}

/** Formulário de filme, compartilhado por /filmes/novo e /filmes/:id/editar. */
export class MovieFormPage {
  readonly page: Page
  readonly titulo: Locator
  readonly diretores: Locator
  readonly ano: Locator
  readonly duracao: Locator
  readonly generos: Locator
  readonly status: Locator
  readonly sinopse: Locator
  readonly createButton: Locator
  readonly saveButton: Locator
  readonly formAlert: Locator

  constructor(page: Page) {
    this.page = page
    this.titulo = page.getByLabel('Título', { exact: true })
    this.diretores = page.getByLabel('Diretores', { exact: true })
    this.ano = page.getByLabel('Ano', { exact: true })
    this.duracao = page.getByLabel('Duração (minutos)')
    this.generos = page.getByLabel('Gêneros', { exact: true })
    this.status = page.getByLabel('Status', { exact: true })
    this.sinopse = page.getByLabel('Sinopse')
    this.createButton = page.getByRole('button', { name: 'Cadastrar filme' })
    this.saveButton = page.getByRole('button', { name: 'Salvar alterações' })
    this.formAlert = page.getByRole('main').getByRole('alert')
  }

  async gotoNew(): Promise<void> {
    await this.page.goto('/filmes/novo')
  }

  async gotoEdit(skMovieId: string): Promise<void> {
    await this.page.goto(`/filmes/${encodeURIComponent(skMovieId)}/editar`)
  }

  /** Preenche só os campos informados; listas viram etiquetas (Enter adiciona). */
  async fill(input: MovieFormInput): Promise<void> {
    if (input.titulo !== undefined) await this.titulo.fill(input.titulo)
    for (const nome of input.diretores ?? []) await this.addTag(this.diretores, nome)
    if (input.ano !== undefined) await this.ano.fill(input.ano)
    if (input.duracao !== undefined) await this.duracao.fill(input.duracao)
    for (const nome of input.generos ?? []) await this.addTag(this.generos, nome)
    if (input.status !== undefined) await this.status.selectOption(input.status)
    if (input.sinopse !== undefined) await this.sinopse.fill(input.sinopse)
  }

  async removeTag(nome: string): Promise<void> {
    await this.page.getByRole('button', { name: `Remover ${nome}`, exact: true }).click()
  }

  tags(label: 'Diretores' | 'Gêneros'): Locator {
    return this.page.getByRole('list', { name: `${label} selecionados` })
  }

  private async addTag(input: Locator, nome: string): Promise<void> {
    await input.fill(nome)
    await input.press('Enter')
  }
}
