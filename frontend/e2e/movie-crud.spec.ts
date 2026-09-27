import { expect, test } from './fixtures.ts'

const DETAIL_URL = /\/filmes\/([^/?#]+)$/

test.describe('Cadastrar filme', () => {
  test('cadastra pelo formulário e abre o detalhe', async ({ api, tag, movieForm, detail, catalog, page }) => {
    const titulo = `${tag} Interestelar`
    await movieForm.gotoNew()

    await movieForm.fill({
      titulo,
      diretores: ['Christopher Nolan'],
      ano: '2014',
      duracao: '169',
      generos: ['Ficção científica', 'Drama'],
      status: 'Lançado',
      sinopse: 'Exploradores atravessam um buraco de minhoca.',
    })
    await expect(movieForm.tags('Gêneros').getByRole('listitem')).toHaveCount(2)
    await movieForm.createButton.click()

    await expect(page).toHaveURL(DETAIL_URL)
    api.track(decodeURIComponent(DETAIL_URL.exec(page.url())?.[1] ?? ''))
    await expect(detail.title(titulo)).toBeVisible()
    await expect(detail.text('2014')).toBeVisible()
    await expect(detail.fact('Direção')).toHaveText('Christopher Nolan')
    // A API devolve os gêneros em ordem alfabética.
    await expect(detail.fact('Gêneros')).toHaveText('Drama, Ficção científica')
    await expect(detail.fact('Duração')).toHaveText('2h 49min')
    await expect(detail.fact('Status')).toHaveText('Lançado')
    await expect(detail.text('Exploradores atravessam um buraco de minhoca.')).toBeVisible()

    // Persistido: aparece na busca do catálogo.
    await catalog.goto()
    await catalog.search(tag)
    await expect(catalog.movieLink(titulo)).toBeVisible()
  })

  test('não cadastra sem título e mostra o erro no campo', async ({ movieForm, page }) => {
    await movieForm.gotoNew()

    await movieForm.fill({ ano: '2020' })
    await movieForm.createButton.click()

    await expect(movieForm.formAlert).toHaveText('Corrija os campos destacados.')
    await expect(page.getByText('Informe o título.')).toBeVisible()
    await expect(movieForm.titulo).toHaveAttribute('aria-invalid', 'true')
    await expect(page).toHaveURL('/filmes/novo')
  })
})

test.describe('Editar filme', () => {
  test('edita título, diretores e duração a partir do detalhe', async ({ api, tag, movieForm, detail, catalog, page }) => {
    const antigo = `${tag} Titulo Antigo`
    const novo = `${tag} Titulo Novo`
    const movie = await api.createMovie({
      titulo: antigo,
      ano_lancamento: 2000,
      diretores: ['Diretor Antigo'],
      generos: ['Drama'],
    })
    const detailUrl = `/filmes/${encodeURIComponent(movie.sk_movie_id)}`
    await detail.goto(movie.sk_movie_id)

    await detail.editLink.click()

    await expect(page).toHaveURL(`${detailUrl}/editar`)
    await expect(movieForm.titulo).toHaveValue(antigo)
    await expect(movieForm.ano).toHaveValue('2000')
    await expect(movieForm.tags('Diretores')).toContainText('Diretor Antigo')

    await movieForm.titulo.fill(novo)
    await movieForm.removeTag('Diretor Antigo')
    await movieForm.fill({ diretores: ['Diretora Nova'], duracao: '95' })
    await movieForm.saveButton.click()

    await expect(page).toHaveURL(detailUrl)
    await expect(detail.title(novo)).toBeVisible()
    await expect(detail.fact('Direção')).toHaveText('Diretora Nova')
    await expect(detail.fact('Duração')).toHaveText('1h 35min')
    await expect(detail.fact('Gêneros')).toHaveText('Drama')

    // Recarregar busca da API: a alteração foi gravada, não só mantida no cache.
    await page.reload()
    await expect(detail.title(novo)).toBeVisible()

    await catalog.goto()
    await catalog.search(tag)
    await expect(catalog.movieLink(novo)).toBeVisible()
    await expect(catalog.movieLink(antigo)).toHaveCount(0)
  })

  test('cancelar a edição não altera o filme', async ({ api, tag, movieForm, detail, page }) => {
    const titulo = `${tag} Intocado`
    const movie = await api.createMovie({ titulo })
    await movieForm.gotoEdit(movie.sk_movie_id)
    await expect(movieForm.titulo).toHaveValue(titulo)

    await movieForm.titulo.fill(`${tag} Rascunho`)
    await page.getByRole('link', { name: 'Cancelar' }).click()

    await expect(page).toHaveURL(`/filmes/${encodeURIComponent(movie.sk_movie_id)}`)
    await expect(detail.title(titulo)).toBeVisible()
  })
})

test.describe('Remover filme', () => {
  test('remove após confirmar e volta ao catálogo', async ({ api, tag, detail, catalog, page }) => {
    const titulo = `${tag} Para Remover`
    const movie = await api.createMovie({ titulo })
    await api.createReview(movie.sk_movie_id, { nome: 'Davi', nota: 6, comentario: 'Ok.' })
    await detail.goto(movie.sk_movie_id)
    await expect(detail.title(titulo)).toBeVisible()

    await detail.removeButton.click()
    await expect(detail.removeDialog).toBeVisible()
    await expect(detail.removeDialog).toContainText(`“${titulo}” e todas as avaliações dele`)
    await detail.removeDialog.getByRole('button', { name: 'Remover filme' }).click()

    await expect(page).toHaveURL('/')
    await expect(catalog.heading).toBeVisible()
    await catalog.search(tag)
    await expect(catalog.noResults).toBeVisible()
    expect(await api.movieStatus(movie.sk_movie_id)).toBe(404)
  })

  test('cancelar a confirmação mantém o filme', async ({ api, tag, detail, page }) => {
    const titulo = `${tag} Fica`
    const movie = await api.createMovie({ titulo })
    await detail.goto(movie.sk_movie_id)

    await detail.removeButton.click()
    await detail.removeDialog.getByRole('button', { name: 'Cancelar' }).click()

    await expect(detail.removeDialog).toBeHidden()
    await expect(page).toHaveURL(`/filmes/${encodeURIComponent(movie.sk_movie_id)}`)
    await expect(detail.title(titulo)).toBeVisible()
    expect(await api.movieStatus(movie.sk_movie_id)).toBe(200)
  })

  test('Esc fecha a confirmação sem remover', async ({ api, tag, detail, page }) => {
    const movie = await api.createMovie({ titulo: `${tag} Esc` })
    await detail.goto(movie.sk_movie_id)

    await detail.removeButton.click()
    await expect(detail.removeDialog).toBeVisible()
    await page.keyboard.press('Escape')

    await expect(detail.removeDialog).toBeHidden()
    expect(await api.movieStatus(movie.sk_movie_id)).toBe(200)
  })
})
