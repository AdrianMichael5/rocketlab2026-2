import { type APIRequestContext, expect } from '@playwright/test'
import { API_URL } from './env.ts'

// Espelho mínimo dos payloads/respostas da API usados para preparar os cenários.
export interface MovieInput {
  titulo: string
  ano_lancamento?: number
  sinopse?: string
  duracao_minutos?: number
  url_poster?: string
  diretores?: string[]
  generos?: string[]
}

export interface CreatedMovie {
  sk_movie_id: string
  titulo: string
}

export interface ReviewInput {
  nome: string
  nota: number
  comentario: string
}

const HTTP_NOT_FOUND = 404
const HTTP_CONFLICT = 409
const MAX_ATTEMPTS = 3

const movieUrl = (skMovieId: string) => `${API_URL}/movies/${encodeURIComponent(skMovieId)}`

/** Prepara e limpa dados direto na API, sem passar pela interface. */
export class MoviesApi {
  private readonly created = new Set<string>()
  private readonly request: APIRequestContext

  constructor(request: APIRequestContext) {
    this.request = request
  }

  async createMovie(input: MovieInput): Promise<CreatedMovie> {
    let response = await this.request.post(`${API_URL}/movies`, { data: input })
    // Workers em paralelo criando o mesmo gênero/diretor novo: a API responde 409 a um
    // deles (rede de segurança de escritas concorrentes); de novo, ele já existe.
    for (let attempt = 1; response.status() === HTTP_CONFLICT && attempt < MAX_ATTEMPTS; attempt++) {
      response = await this.request.post(`${API_URL}/movies`, { data: input })
    }
    expect(response.status(), await response.text()).toBe(201)
    const movie = (await response.json()) as CreatedMovie
    this.created.add(movie.sk_movie_id)
    return movie
  }

  async createReview(skMovieId: string, input: ReviewInput): Promise<void> {
    const response = await this.request.post(`${movieUrl(skMovieId)}/reviews`, { data: input })
    expect(response.status(), await response.text()).toBe(201)
  }

  /** Status HTTP do GET do filme (200 existe, 404 removido). */
  async movieStatus(skMovieId: string): Promise<number> {
    return (await this.request.get(movieUrl(skMovieId))).status()
  }

  /** Registra um filme criado pela interface para ser removido no fim do teste. */
  track(skMovieId: string): void {
    this.created.add(skMovieId)
  }

  /** Remove os filmes criados no teste; 404 significa que o próprio teste já removeu. */
  async cleanup(): Promise<void> {
    for (const skMovieId of this.created) {
      const response = await this.request.delete(movieUrl(skMovieId))
      if (!response.ok() && response.status() !== HTTP_NOT_FOUND) {
        throw new Error(`Falha ao remover ${skMovieId}: HTTP ${response.status()}`)
      }
    }
    this.created.clear()
  }
}
