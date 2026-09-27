import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { MovieDetail } from '../api/types'
import { POSTER_PLACEHOLDER } from '../components/MovieCard/poster'
import {
  type MockRequest,
  jsonResponse,
  movieDetail,
  noContent,
  page,
  review,
  stubApi,
} from '../test/apiMock'
import { renderRoute } from '../test/renderWithProviders'

const PATH = '/filmes/m1'

/** Nunca responde: mantém a consulta carregando. */
const pending = () => new Promise<Response>(() => {})

/** GET do detalhe devolve `detail`; outros métodos caem em `other`. */
function movieHandler(detail: MovieDetail, other: (request: MockRequest) => Response = noContent) {
  return (_url: URL, request: MockRequest) =>
    request.method === 'GET' ? jsonResponse(detail) : other(request)
}

/** Valor exibido para um rótulo da lista de informações (<dt>/<dd>). */
function fact(label: string): string | null {
  const term = screen.queryByText(label, { selector: 'dt' })
  return term?.nextElementSibling?.textContent ?? null
}

async function findTitle(name = 'Alien') {
  return screen.findByRole('heading', { level: 1, name })
}

describe('MovieDetailPage — carregamento e erros', () => {
  it('mostra o estado de carregamento', () => {
    stubApi({ movie: pending, reviews: pending })
    renderRoute(PATH)

    expect(screen.getByRole('status', { name: 'Carregando filme' })).toBeInTheDocument()
  })

  it('mostra "Filme não encontrado" com link de volta no 404', async () => {
    stubApi()
    renderRoute(PATH)

    // É o título da página: sem ele o detalhe ficaria sem <h1>.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Filme não encontrado' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar para os filmes' })).toHaveAttribute('href', '/')
  })

  it('mostra o erro e tenta de novo', async () => {
    let calls = 0
    stubApi({
      movie: () => {
        calls += 1
        return calls === 1 ? jsonResponse({ detail: 'Falhou' }, 500) : jsonResponse(movieDetail())
      },
    })
    renderRoute(PATH)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Não foi possível carregar o filme')
    await userEvent.click(within(alert).getByRole('button', { name: 'Tentar novamente' }))

    expect(await findTitle()).toBeInTheDocument()
  })
})

describe('MovieDetailPage — informações', () => {
  it('mostra título, ano, pôster e imagem de fundo', async () => {
    stubApi({ movie: movieHandler(movieDetail()) })
    const { container } = renderRoute(PATH)

    await findTitle()
    expect(screen.getByText('1979')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Pôster de Alien' })).toHaveAttribute(
      'src',
      'https://image.tmdb.org/t/p/w500/alien.jpg',
    )
    // Fundo é decorativo: alt vazio, fora da árvore de acessibilidade.
    const backdrop = container.querySelector('img[alt=""]')
    expect(backdrop).toHaveAttribute('src', 'https://image.tmdb.org/t/p/w1280/alien.jpg')
  })

  it('usa o pôster padrão e nenhuma imagem de fundo quando faltam', async () => {
    stubApi({ movie: movieHandler(movieDetail({ url_poster: null, url_backdrop: null })) })
    const { container } = renderRoute(PATH)

    await findTitle()
    expect(screen.getByRole('img', { name: 'Pôster de Alien' })).toHaveAttribute(
      'src',
      POSTER_PLACEHOLDER,
    )
    expect(container.querySelector('img[alt=""]')).not.toBeInTheDocument()
  })

  it('troca para o pôster padrão e remove o fundo quando as imagens falham', async () => {
    stubApi({ movie: movieHandler(movieDetail()) })
    const { container } = renderRoute(PATH)

    await findTitle()
    const poster = screen.getByRole('img', { name: 'Pôster de Alien' })
    fireEvent.error(poster)
    fireEvent.error(container.querySelector('img[alt=""]') as HTMLImageElement)

    expect(poster).toHaveAttribute('src', POSTER_PLACEHOLDER)
    expect(container.querySelector('img[alt=""]')).not.toBeInTheDocument()
  })

  it('lista diretores, gêneros, duração, status, lançamento, roteiro e produtoras', async () => {
    stubApi({
      movie: movieHandler(
        movieDetail({ diretores: ['Lana Wachowski', 'Lilly Wachowski'], duracao_minutos: 136 }),
      ),
    })
    renderRoute(PATH)

    await findTitle()
    expect(fact('Direção')).toBe('Lana Wachowski, Lilly Wachowski')
    expect(fact('Gêneros')).toBe('Horror, Ficção científica')
    expect(fact('Duração')).toBe('2h 16min')
    expect(fact('Status')).toBe('Lançado')
    expect(fact('Lançamento')).toBe('25 de maio de 1979')
    expect(fact('Roteiro')).toBe('Dan O’Bannon')
    expect(fact('Produtoras')).toBe('Brandywine Productions')
  })

  it('mostra "—" para duração 0 e omite as informações vazias', async () => {
    stubApi({
      movie: movieHandler(
        movieDetail({
          duracao_minutos: 0,
          diretores: [],
          generos: [],
          status_filme: null,
          data_lancamento: null,
          roteiristas: [],
          produtoras: [],
        }),
      ),
    })
    renderRoute(PATH)

    await findTitle()
    expect(fact('Duração')).toBe('—')
    for (const label of ['Direção', 'Gêneros', 'Status', 'Lançamento', 'Roteiro', 'Produtoras']) {
      expect(fact(label)).toBeNull()
    }
  })

  it('mostra sinopse e elenco', async () => {
    stubApi({ movie: movieHandler(movieDetail()) })
    renderRoute(PATH)

    await findTitle()
    expect(screen.getByRole('heading', { name: 'Sinopse' })).toBeInTheDocument()
    expect(screen.getByText('A tripulação da Nostromo recebe um sinal misterioso.')).toBeInTheDocument()
    const cast = screen.getByRole('list', { name: 'Elenco' })
    expect(within(cast).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Sigourney Weaver',
      'Tom Skerritt',
    ])
  })

  it('omite sinopse e elenco quando não existem', async () => {
    stubApi({ movie: movieHandler(movieDetail({ sinopse: null, atores: [] })) })
    renderRoute(PATH)

    await findTitle()
    expect(screen.queryByRole('heading', { name: 'Sinopse' })).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Elenco' })).not.toBeInTheDocument()
  })

  it('mostra a bilheteria quando existe', async () => {
    const performance = {
      orcamento_usd: 11_000_000,
      receita_usd: null,
      lucro_usd: null,
      orcamento_brl: null,
      receita_brl: null,
      lucro_brl: null,
      popularidade: null,
      nota_tmdb: null,
      qtd_tmdb: null,
      nota_imdb: 8.5,
      qtd_imdb: 900_000,
    }
    stubApi({ movie: movieHandler(movieDetail({ performance })) })
    renderRoute(PATH)

    await findTitle()
    expect(screen.getByRole('heading', { name: 'Bilheteria e notas externas' })).toBeInTheDocument()
    expect(fact('Orçamento')?.replace(/\s/g, ' ')).toBe('US$ 11 mi')
    expect(fact('Nota IMDb')).toBe('8,5 (900.000 votos)')
    expect(fact('Receita')).toBeNull()
  })

  it('omite a bilheteria sem dados', async () => {
    stubApi({ movie: movieHandler(movieDetail({ performance: null })) })
    renderRoute(PATH)

    await findTitle()
    expect(
      screen.queryByRole('heading', { name: 'Bilheteria e notas externas' }),
    ).not.toBeInTheDocument()
  })
})

describe('MovieDetailPage — média', () => {
  it('mostra a média em estrelas e em número', async () => {
    stubApi({
      movie: movieHandler(movieDetail({ avaliacoes: { nota_media: 7.8, qtd_avaliacoes: 5 } })),
    })
    renderRoute(PATH)

    await findTitle()
    expect(screen.getByRole('img', { name: 'Nota 4 de 5 estrelas' })).toBeInTheDocument()
    expect(screen.getByText('3,9 ★ · 7,8/10 · 5 avaliações')).toBeInTheDocument()
  })

  it('mostra "Sem avaliações" quando não há média', async () => {
    stubApi({
      movie: movieHandler(movieDetail({ avaliacoes: { nota_media: null, qtd_avaliacoes: 0 } })),
    })
    renderRoute(PATH)

    await findTitle()
    expect(screen.getByText('Sem avaliações')).toBeInTheDocument()
  })
})

describe('MovieDetailPage — lista de avaliações', () => {
  it('lista as avaliações com nome, nota, data e comentário', async () => {
    stubApi({
      movie: movieHandler(movieDetail()),
      reviews: () =>
        jsonResponse(
          page([
            review({ nome: 'Ana', nota: 9, comentario: 'Obra-prima.' }),
            review({ sk_movie_review_id: 'r2', nome: 'Bruno', nota: 4, comentario: 'Lento.' }),
          ]),
        ),
    })
    renderRoute(PATH)

    const list = await screen.findByRole('list', { name: 'Avaliações' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByRole('heading', { name: 'Ana' })).toBeInTheDocument()
    expect(within(items[0]).getByRole('img', { name: 'Nota 4,5 de 5 estrelas' })).toBeInTheDocument()
    expect(within(items[0]).getByText('25 de set. de 2026')).toBeInTheDocument()
    expect(within(items[0]).getByText('Obra-prima.')).toBeInTheDocument()
  })

  it('avisa quando o filme ainda não tem avaliações', async () => {
    stubApi({ movie: movieHandler(movieDetail()) })
    renderRoute(PATH)

    expect(
      await screen.findByText('Nenhuma avaliação ainda. Seja o primeiro a avaliar!'),
    ).toBeInTheDocument()
  })

  it('mostra o erro ao carregar as avaliações', async () => {
    stubApi({
      movie: movieHandler(movieDetail()),
      reviews: () => jsonResponse({ detail: 'Falhou' }, 500),
    })
    renderRoute(PATH)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar as avaliações',
    )
  })

  it('pagina as avaliações de 10 em 10', async () => {
    const { requestsTo } = stubApi({
      movie: movieHandler(movieDetail()),
      reviews: (url) =>
        jsonResponse(
          page([review()], { total: 12, page: Number(url.searchParams.get('page')), page_size: 10 }),
        ),
    })
    renderRoute(PATH)

    const nav = await screen.findByRole('navigation', { name: 'Paginação' })
    await userEvent.click(within(nav).getByRole('button', { name: /Próxima/ }))

    await waitFor(() => {
      const pages = requestsTo('GET', '/reviews').map(({ url }) => url.searchParams.get('page'))
      expect(pages).toEqual(['1', '2'])
    })
    expect(requestsTo('GET', '/reviews')[0].url.searchParams.get('page_size')).toBe('10')
  })
})

describe('MovieDetailPage — nova avaliação', () => {
  async function fillForm(nome: string, estrelas: string, comentario: string) {
    await userEvent.type(await screen.findByLabelText('Seu nome'), nome)
    await userEvent.click(screen.getByRole('radio', { name: estrelas }))
    await userEvent.type(screen.getByLabelText('Comentário'), comentario)
  }

  it('envia a nota como estrelas × 2 e atualiza média e lista', async () => {
    let created = false
    const { requestsTo } = stubApi({
      movie: () =>
        jsonResponse(
          movieDetail({
            avaliacoes: created
              ? { nota_media: 7, qtd_avaliacoes: 6 }
              : { nota_media: 7.8, qtd_avaliacoes: 5 },
          }),
        ),
      reviews: (_url, request) => {
        if (request.method === 'POST') {
          created = true
          return jsonResponse(review({ nome: 'Carla', nota: 7 }), 201)
        }
        return jsonResponse(page(created ? [review({ nome: 'Carla', nota: 7 })] : []))
      },
    })
    renderRoute(PATH)
    await findTitle()

    await fillForm('Carla', '3,5 estrelas', 'Bom suspense.')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar avaliação' }))

    expect(await screen.findByText('3,5 ★ · 7,0/10 · 6 avaliações')).toBeInTheDocument()
    expect(requestsTo('POST', '/movies/m1/reviews')[0].body).toEqual({
      nome: 'Carla',
      nota: 7,
      comentario: 'Bom suspense.',
    })
    const list = await screen.findByRole('list', { name: 'Avaliações' })
    expect(within(list).getByRole('heading', { name: 'Carla' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Avaliação enviada.')
    // Formulário volta vazio para uma nova avaliação.
    expect(screen.getByLabelText('Seu nome')).toHaveValue('')
    expect(screen.getByLabelText('Comentário')).toHaveValue('')
    expect(screen.getByRole('radio', { name: '3,5 estrelas' })).not.toBeChecked()
  })

  it('valida os campos antes de enviar', async () => {
    const { requestsTo } = stubApi({ movie: movieHandler(movieDetail()) })
    renderRoute(PATH)
    await findTitle()

    await userEvent.click(await screen.findByRole('button', { name: 'Enviar avaliação' }))

    expect(screen.getByText('Informe seu nome.')).toBeInTheDocument()
    expect(screen.getByText('Escolha uma nota.')).toBeInTheDocument()
    expect(screen.getByText('Escreva um comentário.')).toBeInTheDocument()
    expect(screen.getByLabelText('Seu nome')).toHaveAttribute('aria-invalid', 'true')
    expect(requestsTo('POST', '/reviews')).toHaveLength(0)
  })

  it('não aceita nome e comentário só com espaços', async () => {
    const { requestsTo } = stubApi({ movie: movieHandler(movieDetail()) })
    renderRoute(PATH)

    await fillForm('   ', '5 estrelas', '   ')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar avaliação' }))

    expect(screen.getByText('Informe seu nome.')).toBeInTheDocument()
    expect(screen.getByText('Escreva um comentário.')).toBeInTheDocument()
    expect(requestsTo('POST', '/reviews')).toHaveLength(0)
  })

  it('mostra os erros de validação da API no campo', async () => {
    stubApi({
      movie: movieHandler(movieDetail()),
      reviews: (_url, request) =>
        request.method === 'POST'
          ? jsonResponse(
              { detail: [{ loc: ['body', 'comentario'], msg: 'Texto longo demais' }] },
              422,
            )
          : jsonResponse(page([])),
    })
    renderRoute(PATH)

    await fillForm('Ana', '5 estrelas', 'Ótimo')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar avaliação' }))

    expect(await screen.findByText('Texto longo demais')).toBeInTheDocument()
    expect(screen.getByLabelText('Comentário')).toHaveAttribute('aria-invalid', 'true')
    // O que foi digitado continua no formulário.
    expect(screen.getByLabelText('Seu nome')).toHaveValue('Ana')
  })

  it('mostra erros gerais da API como alerta', async () => {
    stubApi({
      movie: movieHandler(movieDetail()),
      reviews: (_url, request) =>
        request.method === 'POST'
          ? jsonResponse({ detail: 'Erro interno' }, 500)
          : jsonResponse(page([])),
    })
    renderRoute(PATH)

    await fillForm('Ana', '5 estrelas', 'Ótimo')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar avaliação' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Erro interno')
  })

  it('desativa o envio enquanto a avaliação é enviada', async () => {
    stubApi({
      movie: movieHandler(movieDetail()),
      reviews: (_url, request) => (request.method === 'POST' ? pending() : jsonResponse(page([]))),
    })
    renderRoute(PATH)

    await fillForm('Ana', '5 estrelas', 'Ótimo')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar avaliação' }))

    expect(await screen.findByRole('button', { name: 'Enviando…' })).toBeDisabled()
  })

  it('bloqueia nome e comentário durante o envio (o sucesso limparia o que fosse digitado)', async () => {
    stubApi({
      movie: movieHandler(movieDetail()),
      reviews: (_url, request) => (request.method === 'POST' ? pending() : jsonResponse(page([]))),
    })
    renderRoute(PATH)

    await fillForm('Ana', '5 estrelas', 'Ótimo')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar avaliação' }))

    await screen.findByRole('button', { name: 'Enviando…' })
    expect(screen.getByLabelText('Seu nome')).toBeDisabled()
    expect(screen.getByLabelText('Comentário')).toBeDisabled()
  })

  it('não mostra "Avaliação enviada." junto com erros de validação', async () => {
    stubApi({
      movie: movieHandler(movieDetail()),
      reviews: (_url, request) =>
        request.method === 'POST'
          ? jsonResponse(review({ nome: 'Ana' }), 201)
          : jsonResponse(page([])),
    })
    renderRoute(PATH)
    await fillForm('Ana', '5 estrelas', 'Ótimo')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar avaliação' }))
    expect(await screen.findByText('Avaliação enviada.')).toBeInTheDocument()

    // Formulário vazio depois do sucesso: enviar de novo só mostra os erros.
    await userEvent.click(screen.getByRole('button', { name: 'Enviar avaliação' }))

    expect(screen.getByText('Informe seu nome.')).toBeInTheDocument()
    expect(screen.queryByText('Avaliação enviada.')).not.toBeInTheDocument()
  })
})

describe('MovieDetailPage — editar e remover', () => {
  it('leva à página de edição', async () => {
    stubApi({ movie: movieHandler(movieDetail()) })
    const view = renderRoute(PATH)

    await userEvent.click(await screen.findByRole('link', { name: 'Editar' }))

    expect(view.pathname()).toBe('/filmes/m1/editar')
    expect(await screen.findByRole('heading', { name: 'Editar filme' })).toBeInTheDocument()
  })

  it('pede confirmação e não remove ao cancelar', async () => {
    const { requestsTo } = stubApi({ movie: movieHandler(movieDetail()) })
    renderRoute(PATH)

    await userEvent.click(await screen.findByRole('button', { name: 'Remover' }))
    const dialog = screen.getByRole('dialog', { name: 'Remover filme?' })
    expect(dialog).toHaveTextContent('Alien')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(requestsTo('DELETE', '/movies/m1')).toHaveLength(0)
  })

  it('remove o filme e volta para o catálogo', async () => {
    const { requestsTo } = stubApi({ movie: movieHandler(movieDetail()) })
    const view = renderRoute(PATH)

    await userEvent.click(await screen.findByRole('button', { name: 'Remover' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remover filme' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Filmes' })).toBeInTheDocument()
    expect(view.pathname()).toBe('/')
    expect(requestsTo('DELETE', '/movies/m1')).toHaveLength(1)
    // O detalhe removido não é buscado de novo (o que daria 404).
    expect(requestsTo('GET', '/movies/m1')).toHaveLength(1)
  })

  it('mantém o modal aberto com o erro quando a remoção falha', async () => {
    stubApi({
      movie: movieHandler(movieDetail(), () => jsonResponse({ detail: 'Erro interno' }, 500)),
    })
    const view = renderRoute(PATH)

    await userEvent.click(await screen.findByRole('button', { name: 'Remover' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remover filme' }))

    const dialog = screen.getByRole('dialog', { name: 'Remover filme?' })
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Erro interno')
    expect(view.pathname()).toBe(PATH)
  })
})
