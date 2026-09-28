import { expect, test } from './fixtures.ts'

// Mais avaliações 10 que os outros testes criam: fica no topo mesmo com empates de nota.
const NOTAS_MAXIMAS = 5

test('insights: ranking leva ao detalhe do filme', async ({ api, tag, detail, page }) => {
  const titulo = `${tag} Campeão de Notas`
  const movie = await api.createMovie({ titulo, ano_lancamento: 2020, generos: ['Drama'] })
  for (let n = 1; n <= NOTAS_MAXIMAS; n++) {
    await api.createReview(movie.sk_movie_id, { nome: `Fã ${n}`, nota: 10, comentario: 'Perfeito.' })
  }

  await page.goto('/')
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Insights' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Insights' })).toBeVisible()
  const ranking = page.getByRole('region', { name: 'Mais bem avaliados' })
  const link = ranking.getByRole('link', { name: new RegExp(titulo) })
  await expect(link).toContainText('10,0/10 · 5 avaliações')
  await expect(page.getByRole('figure', { name: 'Usuários × IMDb × TMDB por gênero' })).toBeVisible()

  await link.click()

  await expect(page).toHaveURL(`/filmes/${movie.sk_movie_id}`)
  await expect(detail.title(titulo)).toBeVisible()
})
