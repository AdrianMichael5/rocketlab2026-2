import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it } from 'vitest'
import { POSTER_PLACEHOLDER } from '../components/MovieCard/poster'
import { jsonResponse, stats, stubApi } from '../test/apiMock'
import { renderRoute } from '../test/renderWithProviders'

// A rota /insights é lazy: carrega o módulo (e o Recharts) antes dos testes, para o
// primeiro findBy não depender do tempo de import.
beforeAll(async () => {
  await import('./InsightsPage')
}, 30_000)

/** Nunca responde: mantém a consulta carregando. */
const pending = () => new Promise<Response>(() => {})

async function findSection(name: string) {
  return screen.findByRole('region', { name })
}

/** Abre a tabela de dados de um gráfico (dentro de <details>) e a devolve. */
async function openDataTable(figureName: string) {
  const figure = await screen.findByRole('figure', { name: figureName })
  await userEvent.click(within(figure).getByText('Ver dados em tabela'))
  return within(figure).getByRole('table')
}

/** Linhas do corpo da tabela: cabeçalho da linha (th scope="row") seguido das células. */
function rowTexts(table: HTMLElement): string[][] {
  return Array.from(table.querySelectorAll('tbody tr'), (row) =>
    Array.from(row.querySelectorAll('th, td'), (cell) => cell.textContent ?? ''),
  )
}

describe('InsightsPage — carregamento e erro', () => {
  it('mostra o título e o estado de carregamento', async () => {
    stubApi({ stats: pending })
    renderRoute('/insights')

    expect(await screen.findByRole('heading', { level: 1, name: 'Insights' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Carregando insights' })).toBeInTheDocument()
    expect(document.title).toBe('Insights · RocketLab Filmes')
  })

  it('mostra o erro e tenta de novo', async () => {
    let calls = 0
    stubApi({
      stats: () => {
        calls += 1
        return calls === 1 ? jsonResponse({ detail: 'Falha no servidor' }, 500) : jsonResponse(stats())
      },
    })
    renderRoute('/insights')

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('Não foi possível carregar os insights')).toBeInTheDocument()
    expect(within(alert).getByText('Falha no servidor')).toBeInTheDocument()

    await userEvent.click(within(alert).getByRole('button', { name: 'Tentar novamente' }))

    expect(await findSection('Números gerais')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('InsightsPage — dados', () => {
  it('mostra os números gerais formatados', async () => {
    stubApi()
    renderRoute('/insights')

    const resumo = await findSection('Números gerais')

    expect(within(resumo).getByText('Filmes').nextElementSibling).toHaveTextContent('95.645')
    expect(within(resumo).getByText('Avaliações').nextElementSibling).toHaveTextContent('43.667')
    expect(within(resumo).getByText('Média geral').nextElementSibling).toHaveTextContent('5,0/10')
  })

  it('mostra "—" como média geral quando não há avaliações', async () => {
    stubApi({
      stats: () =>
        jsonResponse(stats({ resumo: { total_filmes: 1, total_avaliacoes: 0, media_geral: null } })),
    })
    renderRoute('/insights')

    const resumo = await findSection('Números gerais')

    expect(within(resumo).getByText('Média geral').nextElementSibling).toHaveTextContent('—')
  })

  it('lista os mais bem avaliados com link para o detalhe', async () => {
    stubApi()
    const view = renderRoute('/insights')

    const ranking = await findSection('Mais bem avaliados')
    const link = within(ranking).getByRole('link', { name: /Alien/ })

    expect(link).toHaveAttribute('href', '/filmes/m1')
    expect(link).toHaveTextContent('1979')
    expect(link).toHaveTextContent('9,2/10 · 4 avaliações')

    await userEvent.click(link)

    expect(view.pathname()).toBe('/filmes/m1')
  })

  it('troca o pôster do ranking pelo placeholder se a imagem falhar ou faltar', async () => {
    stubApi()
    renderRoute('/insights')

    const avaliados = await findSection('Mais bem avaliados')
    const poster = avaliados.querySelector('img') as HTMLImageElement
    expect(poster).toHaveAttribute('src', 'https://image.tmdb.org/t/p/w500/alien.jpg')

    fireEvent.error(poster)

    expect(poster).toHaveAttribute('src', POSTER_PLACEHOLDER)
    // Endgame não tem url_poster: já começa com o placeholder.
    const lucro = screen.getByRole('region', { name: 'Maior lucro' })
    expect(lucro.querySelector('img')).toHaveAttribute('src', POSTER_PLACEHOLDER)
  })

  it('lista os de maior lucro com o valor em dólares', async () => {
    stubApi()
    renderRoute('/insights')

    const ranking = await findSection('Maior lucro')
    const link = within(ranking).getByRole('link', { name: /Avengers: Endgame/ })

    expect(link).toHaveAttribute('href', '/filmes/m2')
    expect(link).toHaveTextContent('US$ 2,4 bi')
  })

  it('oferece a média por gênero em tabela', async () => {
    stubApi()
    renderRoute('/insights')

    const table = await openDataTable('Média dos usuários por gênero')

    expect(rowTexts(table)).toEqual([['Drama', '9,0/10', '4 avaliações']])
  })

  it('oferece a comparação usuários × IMDb × TMDB em tabela', async () => {
    stubApi()
    renderRoute('/insights')

    const table = await openDataTable('Usuários × IMDb × TMDB por gênero')

    expect(rowTexts(table)).toEqual([['Drama', '9,0/10', '7,0/10', '—']])
  })

  it('oferece os filmes por ano em tabela', async () => {
    stubApi()
    renderRoute('/insights')

    const table = await openDataTable('Filmes lançados por ano')

    expect(rowTexts(table)).toEqual([['2019', '13.349']])
  })

  it('preenche com zero os anos sem filmes, sem buracos no eixo do tempo', async () => {
    stubApi({
      stats: () =>
        jsonResponse(
          stats({
            filmes_por_ano: [
              { ano: 2018, qtd_filmes: 5 },
              { ano: 2021, qtd_filmes: 2 },
            ],
          }),
        ),
    })
    renderRoute('/insights')

    const table = await openDataTable('Filmes lançados por ano')

    expect(rowTexts(table)).toEqual([
      ['2018', '5'],
      ['2019', '0'],
      ['2020', '0'],
      ['2021', '2'],
    ])
  })

  it('avisa quando há anos futuros (lançamentos anunciados)', async () => {
    const futuro = new Date().getFullYear() + 3
    stubApi({
      stats: () => jsonResponse(stats({ filmes_por_ano: [{ ano: futuro, qtd_filmes: 1 }] })),
    })
    renderRoute('/insights')

    const figure = await screen.findByRole('figure', { name: 'Filmes lançados por ano' })

    expect(within(figure).getByText(/lançamentos anunciados/)).toBeInTheDocument()
  })

  it('mostra mensagens de vazio quando ainda não há dados', async () => {
    stubApi({
      stats: () =>
        jsonResponse(
          stats({
            resumo: { total_filmes: 0, total_avaliacoes: 0, media_geral: null },
            top_avaliados: [],
            top_lucro: [],
            generos: [],
            filmes_por_ano: [],
          }),
        ),
    })
    renderRoute('/insights')

    expect(
      within(await findSection('Mais bem avaliados')).getByText(
        'Nenhum filme com 3 ou mais avaliações ainda.',
      ),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: 'Maior lucro' })).getByText(
        'Nenhum filme com orçamento e receita informados.',
      ),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Ainda não há avaliações de usuários.')).toHaveLength(2)
    expect(screen.getByText('Nenhum filme com ano de lançamento.')).toBeInTheDocument()
    expect(screen.queryByRole('figure')).not.toBeInTheDocument()
  })
})
