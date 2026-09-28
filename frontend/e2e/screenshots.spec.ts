// Capturas de tela para a documentação (docs/images/). Roda só com `npm run screenshots`:
// o projeto "screenshots" do playwright.config.ts fica fora de `npm run test:e2e`.
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures.ts'
import type { MovieDetailPage } from './pages/MovieDetailPage.ts'
import type { CatalogPage } from './pages/CatalogPage.ts'
import type { MovieInput, MoviesApi, ReviewInput } from './support/api.ts'
import { GifRecorder } from './support/gifRecorder.ts'

const OUTPUT_DIR = fileURLToPath(new URL('../../docs/images/', import.meta.url))
// Mesmo arquivo que e2e/start-backend.mjs recria a cada execução.
const E2E_DB = fileURLToPath(new URL('../../backend/e2e.db', import.meta.url))
// Os gráficos do Recharts animam ao montar; a captura espera a animação terminar.
const CHART_ANIMATION_MS = 1_600
const DESKTOP = { width: 1280, height: 800 }
const MOBILE = { width: 390, height: 844 }
// Menor que as capturas: o GIF fica leve e legível no README.
const DEMO = { width: 1024, height: 640 }
const DEMO_FPS = 8
// Pausas para quem assiste acompanhar cada etapa.
const DEMO_PAUSE_MS = 1_200
const TYPING_DELAY_MS = 160
const SEARCH_TERM = 'Meirelles'
const FEATURED_TITLE = 'Cidade de Deus'
const CATALOG_GENRE = 'Comedy'

/** Métricas de fact_movies_performance (valores reais do dataset); a API não as grava. */
interface Performance {
  orcamento_usd?: number
  receita_usd?: number
  nota_imdb?: number
  nota_tmdb?: number
}

interface ShowcaseMovie extends MovieInput {
  reviews: ReviewInput[]
  performance?: Performance
}

// O banco E2E começa vazio: estes filmes são tudo o que aparece nas capturas.
const SHOWCASE: ShowcaseMovie[] = [
  {
    titulo: FEATURED_TITLE,
    ano_lancamento: 2002,
    duracao_minutos: 130,
    diretores: ['Fernando Meirelles', 'Kátia Lund'],
    generos: ['Crime', 'Drama'],
    sinopse:
      'Buscapé cresce na Cidade de Deus, no Rio de Janeiro, e registra com sua câmera a escalada do crime na comunidade entre os anos 60 e 80.',
    reviews: [
      { nome: 'Ana', nota: 10, comentario: 'Montagem vibrante e atuações impressionantes. Um clássico.' },
      { nome: 'Bruno', nota: 9, comentario: 'Narrativa ágil, difícil tirar os olhos da tela.' },
      { nome: 'Carla', nota: 8, comentario: 'Pesado, mas necessário. A fotografia é marcante.' },
    ],
  },
  {
    titulo: 'O Jardineiro Fiel',
    ano_lancamento: 2005,
    duracao_minutos: 129,
    diretores: ['Fernando Meirelles'],
    generos: ['Drama', 'Thriller'],
    reviews: [{ nome: 'Davi', nota: 7, comentario: 'Bom suspense político.' }],
  },
  {
    titulo: 'Central do Brasil',
    ano_lancamento: 1998,
    duracao_minutos: 110,
    diretores: ['Walter Salles'],
    generos: ['Drama'],
    reviews: [
      { nome: 'Elisa', nota: 9, comentario: 'Fernanda Montenegro está perfeita.' },
      { nome: 'Fábio', nota: 8, comentario: 'Emocionante do início ao fim.' },
      { nome: 'Gustavo', nota: 9, comentario: 'Road movie brasileiro essencial.' },
    ],
  },
  {
    titulo: 'Bacurau',
    ano_lancamento: 2019,
    duracao_minutos: 131,
    diretores: ['Kleber Mendonça Filho', 'Juliano Dornelles'],
    generos: ['Thriller', 'Western'],
    performance: { nota_imdb: 7.3, nota_tmdb: 7.682 },
    reviews: [{ nome: 'Gabi', nota: 8, comentario: 'Original e provocador.' }],
  },
  {
    titulo: 'Tropa de Elite',
    ano_lancamento: 2007,
    duracao_minutos: 115,
    diretores: ['José Padilha'],
    generos: ['Action', 'Crime'],
    reviews: [{ nome: 'João', nota: 7, comentario: 'Intenso.' }],
  },
  {
    titulo: 'Que Horas Ela Volta?',
    ano_lancamento: 2015,
    duracao_minutos: 112,
    diretores: ['Anna Muylaert'],
    generos: ['Drama'],
    reviews: [],
  },
  {
    titulo: 'Aquarius',
    ano_lancamento: 2016,
    duracao_minutos: 146,
    diretores: ['Kleber Mendonça Filho'],
    generos: ['Drama'],
    performance: { orcamento_usd: 762_241, receita_usd: 285_930, nota_imdb: 7.4, nota_tmdb: 7.48 },
    reviews: [],
  },
  // Comédias com pôster (URLs do TMDB, como em dim_movies.csv): o catálogo é capturado
  // com o filtro CATALOG_GENRE para mostrar os cards com capa.
  {
    titulo: 'Coco',
    ano_lancamento: 2017,
    duracao_minutos: 105,
    url_poster: 'https://image.tmdb.org/t/p/w500/gGEsBPAijhVUFoiNpgZXqRVWJt2.jpg',
    diretores: ['Lee Unkrich'],
    generos: ['Adventure', 'Animation', 'Comedy', 'Family'],
    performance: { orcamento_usd: 175_000_000, receita_usd: 800_526_015, nota_tmdb: 8.222 },
    reviews: [
      { nome: 'Luana', nota: 10, comentario: 'Chorei no final, lindo demais.' },
      { nome: 'Marcos', nota: 9, comentario: 'Visual e trilha incríveis.' },
      { nome: 'Lia', nota: 9, comentario: 'Para ver com a família toda.' },
    ],
  },
  {
    titulo: 'Green Book',
    ano_lancamento: 2018,
    duracao_minutos: 130,
    url_poster: 'https://image.tmdb.org/t/p/w500/7BsvSuDQuoqhWmU2fL7W2GOcZHU.jpg',
    diretores: ['Peter Farrelly'],
    generos: ['Comedy', 'Drama'],
    performance: { orcamento_usd: 23_000_000, receita_usd: 319_700_000, nota_imdb: 8.2, nota_tmdb: 8.242 },
    reviews: [{ nome: 'Nina', nota: 8, comentario: 'Dupla de protagonistas afiada.' }],
  },
  {
    titulo: 'Jojo Rabbit',
    ano_lancamento: 2019,
    duracao_minutos: 108,
    url_poster: 'https://image.tmdb.org/t/p/w500/7GsM4mtM0worCtIVeiQt28HieeN.jpg',
    diretores: ['Taika Waititi'],
    generos: ['Comedy', 'Drama', 'War'],
    performance: { orcamento_usd: 14_000_000, receita_usd: 82_468_705, nota_imdb: 7.9, nota_tmdb: 8.042 },
    reviews: [
      { nome: 'Otávio', nota: 9, comentario: 'Engraçado e comovente na medida.' },
      { nome: 'Paula', nota: 8, comentario: 'Sátira corajosa.' },
      { nome: 'Quésia', nota: 9, comentario: 'Scarlett Johansson rouba a cena.' },
    ],
  },
  {
    titulo: 'Knives Out',
    ano_lancamento: 2019,
    duracao_minutos: 131,
    url_poster: 'https://image.tmdb.org/t/p/w500/pThyQovXQrw2m0s9x82twj48Jq4.jpg',
    diretores: ['Rian Johnson'],
    generos: ['Comedy', 'Crime', 'Mystery'],
    performance: { orcamento_usd: 40_000_000, receita_usd: 312_897_920, nota_imdb: 7.9, nota_tmdb: 7.847 },
    reviews: [
      { nome: 'Rafael', nota: 9, comentario: 'Mistério divertido do começo ao fim.' },
      { nome: 'Sara', nota: 8, comentario: 'Elenco em ótima forma.' },
      { nome: 'Teo', nota: 8, comentario: 'Roteiro esperto.' },
    ],
  },
  {
    titulo: 'Lady Bird',
    ano_lancamento: 2017,
    duracao_minutos: 94,
    url_poster: 'https://image.tmdb.org/t/p/w500/iySFtKLrWvVzXzlFj7x1zalxi5G.jpg',
    diretores: ['Greta Gerwig'],
    generos: ['Comedy', 'Drama'],
    performance: { orcamento_usd: 10_000_000, receita_usd: 78_966_486, nota_imdb: 7.4, nota_tmdb: 7.271 },
    reviews: [],
  },
  {
    titulo: 'Parasite',
    ano_lancamento: 2019,
    duracao_minutos: 133,
    url_poster: 'https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg',
    diretores: ['Bong Joon-ho'],
    generos: ['Comedy', 'Drama', 'Thriller'],
    performance: { orcamento_usd: 11_363_000, receita_usd: 257_591_776, nota_imdb: 8.5, nota_tmdb: 8.515 },
    reviews: [
      { nome: 'Sofia', nota: 10, comentario: 'Reviravoltas geniais.' },
      { nome: 'Tiago', nota: 10, comentario: 'Merecia todos os prêmios.' },
      { nome: 'Úrsula', nota: 9, comentario: 'Tenso e engraçado ao mesmo tempo.' },
    ],
  },
  {
    titulo: 'Soul',
    ano_lancamento: 2020,
    duracao_minutos: 101,
    url_poster: 'https://image.tmdb.org/t/p/w500/hm58Jw4Lw8OIeECIq5qyPYhAeRJ.jpg',
    diretores: ['Pete Docter'],
    generos: ['Animation', 'Comedy', 'Drama', 'Family'],
    performance: { orcamento_usd: 150_000_000, receita_usd: 136_384_442, nota_imdb: 8.0, nota_tmdb: 8.15 },
    reviews: [{ nome: 'Vitor', nota: 8, comentario: 'Reflexivo e bonito.' }],
  },
  {
    titulo: 'Zootopia',
    ano_lancamento: 2016,
    duracao_minutos: 109,
    url_poster: 'https://image.tmdb.org/t/p/w500/hlK0e0wAQ3VLuJcsfIYPvb4JVud.jpg',
    diretores: ['Byron Howard', 'Rich Moore'],
    generos: ['Adventure', 'Animation', 'Comedy', 'Family'],
    performance: { orcamento_usd: 150_000_000, receita_usd: 1_023_784_195, nota_imdb: 8.0, nota_tmdb: 7.748 },
    reviews: [{ nome: 'Wagner', nota: 9, comentario: 'Diverte crianças e adultos.' }],
  },
]
/** Grava as métricas direto no banco E2E, antes de qualquer GET /stats (que é cacheado). */
function insertPerformance(rows: { skMovieId: string; performance: Performance }[]): void {
  const db = new DatabaseSync(E2E_DB)
  try {
    db.exec('PRAGMA busy_timeout = 5000')
    const insert = db.prepare(
      `INSERT INTO fact_movies_performance
         (sk_movie_id, orcamento_usd, receita_usd, lucro_usd, lucro_brl, nota_imdb, nota_tmdb)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
    )
    for (const { skMovieId, performance: p } of rows) {
      // Como no CSV: lucro = receita − orçamento, 0 quando falta um dos dois.
      const lucro = p.orcamento_usd && p.receita_usd ? p.receita_usd - p.orcamento_usd : 0
      insert.run(
        skMovieId,
        p.orcamento_usd ?? null,
        p.receita_usd ?? null,
        lucro,
        p.nota_imdb ?? null,
        p.nota_tmdb ?? null,
      )
    }
  } finally {
    db.close()
  }
}

/** Cadastra o SHOWCASE (filmes, avaliações e métricas); devolve o id do filme em destaque. */
async function seedShowcase(api: MoviesApi): Promise<string> {
  let featuredId = ''
  const performances: { skMovieId: string; performance: Performance }[] = []
  for (const { reviews, performance, ...input } of SHOWCASE) {
    const movie = await api.createMovie(input)
    for (const review of reviews) await api.createReview(movie.sk_movie_id, review)
    if (input.titulo === FEATURED_TITLE) featuredId = movie.sk_movie_id
    if (performance) performances.push({ skMovieId: movie.sk_movie_id, performance })
  }
  insertPerformance(performances)
  return featuredId
}

const CATALOG_MOVIES = SHOWCASE.filter((movie) => movie.generos?.includes(CATALOG_GENRE)).length

async function showCatalog(catalog: CatalogPage): Promise<void> {
  await catalog.goto()
  // O <select> fica dentro do <label>: o nome acessível inclui a opção atual.
  await catalog.page.getByRole('combobox', { name: /^Gênero/ }).selectOption(CATALOG_GENRE)
  await expect(catalog.results.getByRole('listitem')).toHaveCount(CATALOG_MOVIES)
  // Espera as capas visíveis carregarem (vêm do TMDB). Os pôsteres têm loading="lazy":
  // os que estão abaixo da dobra não carregam e não aparecem na captura.
  await expect
    .poll(() =>
      catalog.results.locator('img').evaluateAll((imgs) =>
        (imgs as HTMLImageElement[])
          .filter((img) => img.getBoundingClientRect().top < window.innerHeight)
          .every((img) => img.complete && img.naturalWidth > 0),
      ),
    )
    .toBe(true)
}

async function capture(page: Page, name: string, { fullPage = false } = {}): Promise<void> {
  // Sem "carregando" nem pôsteres pela metade na imagem.
  await page.waitForLoadState('networkidle')
  await page.screenshot({
    path: `${OUTPUT_DIR}${name}.png`,
    fullPage,
    animations: 'disabled',
    caret: 'hide',
  })
}

// Os dois testes cadastram o mesmo SHOWCASE no mesmo banco: um de cada vez.
test.describe.configure({ mode: 'serial' })
test.use({ viewport: DESKTOP })

test('gera as capturas da documentação', async ({ api, catalog, detail, movieForm, page }) => {
  const featuredId = await seedShowcase(api)

  await test.step('catálogo', async () => {
    await showCatalog(catalog)
    await capture(page, 'catalogo')
  })

  await test.step('busca', async () => {
    await catalog.goto()
    await catalog.search(SEARCH_TERM)
    await expect(catalog.results.getByRole('listitem')).toHaveCount(2)
    await capture(page, 'busca')
  })

  await test.step('detalhe com avaliações', async () => {
    await detail.goto(featuredId)
    await expect(detail.title(FEATURED_TITLE)).toBeVisible()
    await expect(detail.reviews.getByRole('listitem')).toHaveCount(3)
    await capture(page, 'detalhe-filme')
  })

  await test.step('formulário de nova avaliação', async () => {
    const form = detail.reviewForm
    await form.getByLabel('Seu nome').fill('Marina')
    await form
      .getByRole('radiogroup', { name: 'Sua nota (0 a 10)' })
      .getByRole('radio', { name: 'Nota 9', exact: true })
      .check()
    await form.getByLabel('Comentário').fill('Revi ontem e continua atual. Trilha sonora excelente.')
    await form.scrollIntoViewIfNeeded()
    await capture(page, 'nova-avaliacao')
  })

  await test.step('cadastro de filme', async () => {
    await movieForm.gotoNew()
    await movieForm.fill({
      titulo: 'O Som ao Redor',
      diretores: ['Kleber Mendonça Filho'],
      ano: '2012',
      duracao: '131',
      generos: ['Drama', 'Thriller'],
      status: 'Lançado',
      sinopse: 'O cotidiano de uma rua de classe média no Recife muda com a chegada de uma milícia.',
    })
    await movieForm.titulo.focus()
    await capture(page, 'cadastro-filme')
  })

  await test.step('insights', async () => {
    await page.goto('/insights')
    await expect(page.getByRole('heading', { level: 1, name: 'Insights' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Maior lucro' }).getByRole('link')).not.toHaveCount(0)
    await expect(page.getByRole('figure', { name: 'Usuários × IMDb × TMDB por gênero' })).toBeVisible()
    await page.waitForTimeout(CHART_ANIMATION_MS)
    await capture(page, 'insights', { fullPage: true })
  })

  await test.step('catálogo no celular', async () => {
    await page.setViewportSize(MOBILE)
    await showCatalog(catalog)
    await capture(page, 'catalogo-mobile')
  })
})

test.describe('demo', () => {
  test.use({ viewport: DEMO })

  test('grava o GIF de demonstração', async ({ api, catalog, detail, page }) => {
    await seedShowcase(api)
    await catalog.goto()
    await expect(catalog.results.getByRole('listitem')).toHaveCount(SHOWCASE.length)
    await page.waitForLoadState('networkidle')

    const recorder = new GifRecorder(page, { fps: DEMO_FPS })
    recorder.start()
    try {
      await playDemo(catalog, detail)
    } finally {
      await recorder.stop()
    }

    const frames = recorder.save(`${OUTPUT_DIR}demo.gif`)
    expect(frames).toBeGreaterThan(1)
  })
})

/** Busca → detalhe → nova avaliação, no ritmo de uma pessoa usando o app. */
async function playDemo(catalog: CatalogPage, detail: MovieDetailPage): Promise<void> {
  const page = catalog.page
  await page.waitForTimeout(DEMO_PAUSE_MS)

  await catalog.searchInput.click()
  await catalog.searchInput.pressSequentially(SEARCH_TERM, { delay: TYPING_DELAY_MS })
  await catalog.searchInput.press('Enter')
  await expect(catalog.results.getByRole('listitem')).toHaveCount(2)
  await page.waitForTimeout(DEMO_PAUSE_MS)

  await catalog.openMovie(FEATURED_TITLE)
  await expect(detail.title(FEATURED_TITLE)).toBeVisible()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(DEMO_PAUSE_MS)

  const form = detail.reviewForm
  await form.evaluate((element) => element.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  await page.waitForTimeout(DEMO_PAUSE_MS)
  await form.getByLabel('Seu nome').pressSequentially('Marina', { delay: TYPING_DELAY_MS })
  await form
    .getByRole('radiogroup', { name: 'Sua nota (0 a 10)' })
    .getByRole('radio', { name: 'Nota 9', exact: true })
    .check()
  await form
    .getByLabel('Comentário')
    .pressSequentially('Revi ontem e continua atual.', { delay: TYPING_DELAY_MS / 2 })
  await form.getByRole('button', { name: 'Enviar avaliação' }).click()
  await expect(form.getByRole('status')).toHaveText('Avaliação enviada.')
  await expect(detail.review('Marina')).toBeVisible()
  await page.waitForTimeout(DEMO_PAUSE_MS)
}
