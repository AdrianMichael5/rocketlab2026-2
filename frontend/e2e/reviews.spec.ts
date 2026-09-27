import { expect, test } from './fixtures.ts'

test.describe('Avaliar filme', () => {
  test('envia avaliação e atualiza a lista e a média', async ({ api, tag, detail }) => {
    const titulo = `${tag} Central do Brasil`
    const movie = await api.createMovie({ titulo })
    await detail.goto(movie.sk_movie_id)
    await expect(detail.noReviews).toBeVisible()

    await detail.submitReview({ nome: 'Ana', estrelas: 4, comentario: 'Emocionante do início ao fim.' })

    await expect(detail.reviewForm.getByRole('status')).toHaveText('Avaliação enviada.')
    const review = detail.review('Ana')
    await expect(review).toContainText('Emocionante do início ao fim.')
    await expect(review.getByRole('img', { name: 'Nota 4 de 5 estrelas' })).toBeVisible()
    await expect(detail.text('4,0 ★ · 8,0/10 · 1 avaliação')).toBeVisible()
    await expect(detail.noReviews).toHaveCount(0)
    // O formulário volta ao estado inicial para uma nova avaliação.
    await expect(detail.reviewForm.getByLabel('Seu nome')).toHaveValue('')
    await expect(detail.reviewForm.getByLabel('Comentário')).toHaveValue('')
  })

  test('média combina as avaliações e aparece no catálogo', async ({ api, tag, detail, catalog }) => {
    const titulo = `${tag} Bacurau`
    const movie = await api.createMovie({ titulo })
    await api.createReview(movie.sk_movie_id, { nome: 'Bruno', nota: 10, comentario: 'Obra-prima.' })
    await detail.goto(movie.sk_movie_id)
    await expect(detail.text('5,0 ★ · 10,0/10 · 1 avaliação')).toBeVisible()

    // Meia estrela: 2,5 estrelas = nota 5 → média (10 + 5) / 2 = 7,5.
    await detail.submitReview({ nome: 'Carla', estrelas: 2.5, comentario: 'Achei irregular.' })

    await expect(detail.text('3,8 ★ · 7,5/10 · 2 avaliações')).toBeVisible()
    // Mais recente primeiro.
    await expect(detail.reviews.getByRole('listitem').first()).toContainText('Carla')

    await catalog.goto()
    await catalog.search(tag)
    await expect(catalog.movieCard(titulo)).toContainText('2 avaliações')
  })

  test('não envia avaliação incompleta e aponta os campos', async ({ api, tag, detail }) => {
    const movie = await api.createMovie({ titulo: `${tag} Sem Nota` })
    await detail.goto(movie.sk_movie_id)

    await detail.reviewForm.getByRole('button', { name: 'Enviar avaliação' }).click()

    await expect(detail.reviewForm.getByText('Informe seu nome.')).toBeVisible()
    await expect(detail.reviewForm.getByText('Escolha uma nota.')).toBeVisible()
    await expect(detail.reviewForm.getByText('Escreva um comentário.')).toBeVisible()
    await expect(detail.reviewForm.getByLabel('Seu nome')).toHaveAttribute('aria-invalid', 'true')
    await expect(detail.noReviews).toBeVisible()
  })
})
