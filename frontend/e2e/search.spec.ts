import { expect, test } from './fixtures.ts'

test.describe('Buscar filme e abrir detalhe', () => {
  test('busca por parte do título, sem diferenciar maiúsculas', async ({ api, tag, catalog, page }) => {
    await api.createMovie({ titulo: `${tag} Laranja Mecânica`, ano_lancamento: 1971 })
    await api.createMovie({ titulo: `${tag} Laranja Azeda` })
    await api.createMovie({ titulo: `${tag} Outro Filme` })
    await catalog.goto()

    await catalog.search(`${tag} LARANJA`)

    await expect(page).toHaveURL(/[?&]q=/)
    await expect(catalog.results.getByRole('listitem')).toHaveCount(2)
    await expect(catalog.movieLink(`${tag} Laranja Mecânica`)).toBeVisible()
    await expect(catalog.movieLink(`${tag} Laranja Azeda`)).toBeVisible()
    await expect(catalog.movieCard(`${tag} Laranja Mecânica`)).toContainText('1971')
    await expect(page.getByText('2 filmes', { exact: true })).toBeVisible()
  })

  test('mostra estado vazio sem resultados e limpa a busca', async ({ api, tag, catalog, page }) => {
    await api.createMovie({ titulo: `${tag} Existente` })
    await catalog.goto()

    await catalog.search(`${tag} inexistente`)

    await expect(catalog.noResults).toBeVisible()
    await expect(catalog.results).toHaveCount(0)

    await catalog.clearFilters.click()

    await expect(catalog.searchInput).toHaveValue('')
    await expect(page).not.toHaveURL(/[?&]q=/)
    await expect(catalog.results).toBeVisible()
  })

  test('abre o detalhe pelo card com a ficha do filme', async ({ api, tag, catalog, detail, page }) => {
    const titulo = `${tag} O Poderoso Chefão`
    const movie = await api.createMovie({
      titulo,
      ano_lancamento: 1972,
      duracao_minutos: 175,
      sinopse: 'A saga da família Corleone.',
      diretores: ['Francis Ford Coppola'],
      generos: ['Crime', 'Drama'],
    })
    await catalog.goto()
    await catalog.search(tag)

    await catalog.openMovie(titulo)

    await expect(page).toHaveURL(`/filmes/${encodeURIComponent(movie.sk_movie_id)}`)
    await expect(detail.title(titulo)).toBeVisible()
    await expect(detail.text('1972')).toBeVisible()
    await expect(detail.fact('Direção')).toHaveText('Francis Ford Coppola')
    await expect(detail.fact('Gêneros')).toHaveText('Crime, Drama')
    await expect(detail.fact('Duração')).toHaveText('2h 55min')
    await expect(detail.text('A saga da família Corleone.')).toBeVisible()
    await expect(detail.text('Sem avaliações')).toBeVisible()
    await expect(detail.noReviews).toBeVisible()
  })

  test('voltar do detalhe preserva a busca no catálogo', async ({ api, tag, catalog, detail, page }) => {
    const titulo = `${tag} Cidade de Deus`
    await api.createMovie({ titulo })
    await catalog.goto()
    await catalog.search(tag)
    await catalog.openMovie(titulo)
    await expect(detail.title(titulo)).toBeVisible()

    await page.goBack()

    await expect(catalog.searchInput).toHaveValue(tag)
    await expect(catalog.movieLink(titulo)).toBeVisible()
  })

  test('endereço de filme inexistente mostra "Filme não encontrado"', async ({ detail, page }) => {
    await detail.goto('nao-existe-e2e')

    await expect(page.getByRole('heading', { name: 'Filme não encontrado' })).toBeVisible()
    await expect(detail.editLink).toHaveCount(0)
    await page.getByRole('link', { name: 'Voltar para os filmes' }).click()
    await expect(page).toHaveURL('/')
  })
})
