import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures.ts'

const WIDTHS = [320, 768, 1280] as const
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']
// WCAG 2.5.8: alvo mínimo de toque/clique.
const MIN_TARGET_PX = 24

/** Sem violações do axe e sem rolagem horizontal (WCAG 1.4.10: nada vaza em 320px). */
async function expectAccessibleLayout(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
  const summary = violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
  expect(summary).toEqual([])

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, 'largura extra causando rolagem horizontal').toBeLessThanOrEqual(0)
}

for (const width of WIDTHS) {
  test.describe(`Acessibilidade e layout em ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    test('catálogo com resultados e sem resultados', async ({ api, tag, catalog }) => {
      for (const n of [1, 2, 3]) {
        await api.createMovie({ titulo: `${tag} Filme ${n}`, ano_lancamento: 2000 + n, generos: ['Drama'] })
      }
      await catalog.goto()
      await catalog.search(tag)
      await expect(catalog.results.getByRole('listitem')).toHaveCount(3)
      await expectAccessibleLayout(catalog.page)

      await catalog.search(`${tag} nada`)
      await expect(catalog.noResults).toBeVisible()
      await expectAccessibleLayout(catalog.page)
    })

    test('detalhe, erros da avaliação e modal de remoção', async ({ api, tag, detail, page }) => {
      const titulo = `${tag} Um Título Bem Comprido Para Quebrar Linha Em Telas Estreitas`
      const movie = await api.createMovie({
        titulo,
        ano_lancamento: 1994,
        duracao_minutos: 142,
        sinopse: 'Uma sinopse longa o bastante para ocupar várias linhas. '.repeat(6),
        diretores: ['Frank Darabont'],
        generos: ['Drama', 'Crime'],
      })
      await api.createReview(movie.sk_movie_id, { nome: 'Ana', nota: 9, comentario: 'Ótimo. '.repeat(40) })
      await detail.goto(movie.sk_movie_id)
      await expect(detail.review('Ana')).toBeVisible()
      await expectAccessibleLayout(page)

      await detail.reviewForm.getByRole('button', { name: 'Enviar avaliação' }).click()
      await expect(detail.reviewForm.getByText('Informe seu nome.')).toBeVisible()
      await expectAccessibleLayout(page)

      await detail.removeButton.click()
      await expect(detail.removeDialog).toBeVisible()
      await expectAccessibleLayout(page)
    })

    test('cadastro com erros e edição', async ({ api, tag, movieForm, page }) => {
      await movieForm.gotoNew()
      await movieForm.createButton.click()
      await expect(movieForm.formAlert).toBeVisible()
      await expectAccessibleLayout(page)

      const movie = await api.createMovie({ titulo: `${tag} Editável`, diretores: ['Alguém'] })
      await movieForm.gotoEdit(movie.sk_movie_id)
      await expect(movieForm.titulo).toHaveValue(`${tag} Editável`)
      await expectAccessibleLayout(page)
    })

    test('filme inexistente e rota desconhecida', async ({ detail, page }) => {
      await detail.goto('nao-existe-a11y')
      await expect(page.getByRole('heading', { level: 1, name: 'Filme não encontrado' })).toBeVisible()
      await expectAccessibleLayout(page)

      await page.goto('/rota-que-nao-existe')
      await expect(page.getByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeVisible()
      await expectAccessibleLayout(page)
    })
  })
}

test.describe('Layout em telas estreitas (320px)', () => {
  test.use({ viewport: { width: 320, height: 900 } })

  test('catálogo mostra duas colunas de cards', async ({ api, tag, catalog }) => {
    await api.createMovie({ titulo: `${tag} A` })
    await api.createMovie({ titulo: `${tag} B` })
    await catalog.goto()
    await catalog.search(tag)
    await expect(catalog.results.getByRole('listitem')).toHaveCount(2)

    const [first, second] = await catalog.results.getByRole('listitem').all()
    const a = await first.boundingBox()
    const b = await second.boundingBox()
    expect(b?.y).toBe(a?.y)
  })

  test('título do filme usa a largura toda, sem ficar espremido ao lado do pôster', async ({ api, tag, detail, page }) => {
    const titulo = `${tag} Título Longo Para Conferir A Largura`
    const movie = await api.createMovie({ titulo })
    await detail.goto(movie.sk_movie_id)

    const box = await detail.title(titulo).boundingBox()
    const viewport = page.viewportSize()
    expect(box?.width ?? 0).toBeGreaterThan((viewport?.width ?? 0) * 0.75)
  })

  test('cada meia estrela da nota é um alvo de pelo menos 24px', async ({ api, tag, detail }) => {
    const movie = await api.createMovie({ titulo: `${tag} Alvos` })
    await detail.goto(movie.sk_movie_id)

    const radios = detail.reviewForm.getByRole('radio')
    await expect(radios).toHaveCount(10)
    for (const radio of await radios.all()) {
      const box = await radio.boundingBox()
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(MIN_TARGET_PX)
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(MIN_TARGET_PX)
    }
  })
})

test.describe('Navegação por teclado', () => {
  test('abrir um filme com Enter leva o foco ao conteúdo e muda o título da aba', async ({ api, tag, catalog, detail, page }) => {
    const titulo = `${tag} Teclado`
    await api.createMovie({ titulo })
    await catalog.goto()
    await catalog.search(tag)

    await catalog.movieLink(titulo).focus()
    await page.keyboard.press('Enter')

    await expect(detail.title(titulo)).toBeVisible()
    await expect(page.getByRole('main')).toBeFocused()
    await expect(page).toHaveTitle(`${titulo} · RocketLab Filmes`)
    // O próximo Tab segue do início do conteúdo: primeira ação do filme.
    await page.keyboard.press('Tab')
    await expect(detail.editLink).toBeFocused()
  })

  test('avaliação pode ser dada só pelo teclado', async ({ api, tag, detail, page }) => {
    const movie = await api.createMovie({ titulo: `${tag} Só Teclado` })
    await detail.goto(movie.sk_movie_id)

    await detail.reviewForm.getByLabel('Seu nome').focus()
    await page.keyboard.type('Bia')
    await page.keyboard.press('Tab')
    // Setas percorrem as meias estrelas: da 1ª (0,5) até a 8ª (4 estrelas).
    for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Tab')
    await page.keyboard.type('Muito bom.')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')

    await expect(detail.review('Bia')).toBeVisible()
    await expect(detail.review('Bia').getByRole('img', { name: 'Nota 4 de 5 estrelas' })).toBeVisible()
  })
})
