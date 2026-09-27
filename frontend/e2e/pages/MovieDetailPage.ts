import type { Locator, Page } from '@playwright/test'

export interface ReviewFormInput {
  nome: string
  /** Estrelas de 0,5 a 5 (a API guarda nota = estrelas × 2). */
  estrelas: number
  comentario: string
}

const starsFormat = new Intl.NumberFormat('pt-BR')

/** Mesmo texto de `starsLabel` do componente StarRating ("3,5 estrelas", "1 estrela"). */
function starsLabel(estrelas: number): string {
  return `${starsFormat.format(estrelas)} ${estrelas < 2 ? 'estrela' : 'estrelas'}`
}

/** Detalhe do filme (/filmes/:id): ficha, ações, remoção e avaliações. */
export class MovieDetailPage {
  readonly page: Page
  readonly editLink: Locator
  readonly removeButton: Locator
  readonly removeDialog: Locator
  readonly reviewForm: Locator
  readonly reviews: Locator
  readonly noReviews: Locator

  constructor(page: Page) {
    this.page = page
    this.editLink = page.getByRole('link', { name: 'Editar', exact: true })
    this.removeButton = page.getByRole('button', { name: 'Remover', exact: true })
    this.removeDialog = page.getByRole('dialog', { name: 'Remover filme?' })
    this.reviewForm = page.getByRole('form', { name: 'Avaliar este filme' })
    this.reviews = page.getByRole('list', { name: 'Avaliações' })
    this.noReviews = page.getByText('Nenhuma avaliação ainda. Seja o primeiro a avaliar!')
  }

  async goto(skMovieId: string): Promise<void> {
    await this.page.goto(`/filmes/${encodeURIComponent(skMovieId)}`)
  }

  title(titulo: string): Locator {
    return this.page.getByRole('heading', { level: 1, name: titulo })
  }

  /** Valor de uma linha da ficha técnica (ex.: "Direção", "Duração"). */
  fact(label: string): Locator {
    return this.page
      .getByRole('term')
      .filter({ hasText: new RegExp(`^${label}$`) })
      .locator('xpath=following-sibling::dd[1]')
  }

  /** Texto exato dentro do conteúdo principal (ano, resumo da nota, sinopse). */
  text(texto: string): Locator {
    return this.page.getByRole('main').getByText(texto, { exact: true })
  }

  review(nome: string): Locator {
    return this.reviews
      .getByRole('listitem')
      .filter({ has: this.page.getByRole('heading', { name: nome, exact: true }) })
  }

  async submitReview({ nome, estrelas, comentario }: ReviewFormInput): Promise<void> {
    const form = this.reviewForm
    await form.getByLabel('Seu nome').fill(nome)
    await form
      .getByRole('radiogroup', { name: 'Sua nota' })
      .getByRole('radio', { name: starsLabel(estrelas), exact: true })
      .check()
    await form.getByLabel('Comentário').fill(comentario)
    await form.getByRole('button', { name: 'Enviar avaliação' }).click()
  }

  async confirmRemoval(): Promise<void> {
    await this.removeButton.click()
    await this.removeDialog.getByRole('button', { name: 'Remover filme' }).click()
  }
}
