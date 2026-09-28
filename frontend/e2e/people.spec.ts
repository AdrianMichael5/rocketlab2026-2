import { expect, test } from './fixtures.ts'

test.describe('Página da pessoa', () => {
  test('abre o diretor pelo detalhe e lista os filmes do mais recente ao mais antigo', async ({ api, tag, detail, page }) => {
    // Nome único: dim_people é reaproveitada pelo nome, então o diretor só tem estes filmes.
    const diretora = `${tag} Diretora`
    const antigo = await api.createMovie({ titulo: `${tag} Primeiro`, ano_lancamento: 1990, diretores: [diretora] })
    await api.createMovie({ titulo: `${tag} Segundo`, ano_lancamento: 2015, diretores: [diretora] })

    await detail.goto(antigo.sk_movie_id)
    await detail.fact('Direção').getByRole('link', { name: diretora }).click()

    await expect(page).toHaveURL(/\/pessoas\/[^/]+$/)
    await expect(page.getByRole('heading', { level: 1, name: diretora })).toBeVisible()
    await expect(page.getByText('Direção · 2 filmes')).toBeVisible()
    const grid = page.getByRole('list', { name: `Filmes de ${diretora}` })
    await expect(grid.getByRole('heading', { level: 2 })).toHaveText([`${tag} Segundo`, `${tag} Primeiro`])

    await grid.getByRole('link', { name: `${tag} Primeiro` }).click()
    await expect(detail.title(`${tag} Primeiro`)).toBeVisible()
  })

  test('mostra "Pessoa não encontrada" para um id inexistente', async ({ page }) => {
    await page.goto('/pessoas/nao-existe')

    await expect(page.getByRole('heading', { level: 1, name: 'Pessoa não encontrada' })).toBeVisible()
    await page.getByRole('link', { name: 'Voltar para os filmes' }).click()
    await expect(page).toHaveURL('/')
  })
})
