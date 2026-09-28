// Espelho dos schemas Pydantic do backend. Mantenha os nomes iguais aos de:
//   backend/app/movies/schemas.py, backend/app/reviews/schemas.py e backend/app/people/schemas.py

/** Envelope padrão de respostas paginadas. */
export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export type MovieOrder = 'titulo' | 'ano' | 'nota'

// Filtros e paginação são `type` (não `interface`) para serem aceitos como QueryParams.
export type MovieFilters = {
  q?: string
  genero?: string
  ano?: number
  ordem?: MovieOrder
  page?: number
  page_size?: number
}

export interface MovieListItem {
  sk_movie_id: string
  titulo: string
  ano_lancamento: number | null
  url_poster: string | null
  generos: string[]
  /** Média 0–10 (2 casas) ou null quando não há avaliações. */
  nota_media: number | null
  qtd_avaliacoes: number
}

export interface PerformanceOut {
  orcamento_usd: number | null
  receita_usd: number | null
  lucro_usd: number | null
  orcamento_brl: number | null
  receita_brl: number | null
  lucro_brl: number | null
  popularidade: number | null
  nota_tmdb: number | null
  qtd_tmdb: number | null
  nota_imdb: number | null
  qtd_imdb: number | null
}

export interface ReviewSummaryOut {
  nota_media: number | null
  qtd_avaliacoes: number
}

export type PersonType = 'Ator' | 'Diretor' | 'Roteirista'

/** Pessoa citada no detalhe do filme, com a chave para a página dela. */
export interface PessoaRef {
  sk_person_id: string
  nome: string
}

export interface Creditos {
  diretores: PessoaRef[]
  atores: PessoaRef[]
  roteiristas: PessoaRef[]
}

export interface MovieDetail {
  sk_movie_id: string
  id_filme: string
  titulo: string
  /** Data ISO (AAAA-MM-DD). */
  data_lancamento: string | null
  ano_lancamento: number | null
  /** 0 significa duração desconhecida. */
  duracao_minutos: number | null
  status_filme: string | null
  sinopse: string | null
  url_poster: string | null
  url_backdrop: string | null
  generos: string[]
  diretores: string[]
  atores: string[]
  roteiristas: string[]
  produtoras: string[]
  /** As mesmas pessoas de diretores/atores/roteiristas, com sk_person_id. */
  creditos: Creditos
  performance: PerformanceOut | null
  avaliacoes: ReviewSummaryOut
}

export interface PersonDetail {
  sk_person_id: string
  nome: string
  tipo: PersonType
  /** Filmes do mais recente ao mais antigo (sem ano por último). */
  filmes: Page<MovieListItem>
}

export interface MovieCreate {
  titulo: string
  id_filme?: string | null
  ano_lancamento?: number | null
  data_lancamento?: string | null
  sinopse?: string | null
  duracao_minutos?: number | null
  status_filme?: string | null
  url_poster?: string | null
  diretores?: string[]
  generos?: string[]
}

/**
 * PATCH: só os campos enviados mudam; listas substituem as atuais.
 * titulo, id_filme, diretores e generos não aceitam null (NON_NULLABLE_UPDATE_FIELDS).
 */
export interface MovieUpdate {
  titulo?: string
  id_filme?: string
  ano_lancamento?: number | null
  data_lancamento?: string | null
  sinopse?: string | null
  duracao_minutos?: number | null
  status_filme?: string | null
  url_poster?: string | null
  diretores?: string[]
  generos?: string[]
}

export interface ReviewOut {
  sk_movie_review_id: string
  sk_movie_id: string
  nome: string
  /** 0–10. */
  nota: number
  comentario: string
  /** ISO 8601 em UTC (ex.: 2026-09-25T16:53:25Z). */
  created_at: string
}

export interface ReviewCreate {
  nome: string
  /** 0–10 em passos de 0.5. */
  nota: number
  comentario: string
}

export type ReviewPageParams = {
  page?: number
  page_size?: number
}

// --- GET /stats (backend/app/stats/schemas.py) ---

export interface StatsResumo {
  total_filmes: number
  total_avaliacoes: number
  /** Média 0–10 de todas as avaliações (1 casa) ou null sem avaliações. */
  media_geral: number | null
}

export interface RankedMovie {
  sk_movie_id: string
  titulo: string
  ano_lancamento: number | null
  url_poster: string | null
}

export interface TopAvaliado extends RankedMovie {
  nota_media: number
  qtd_avaliacoes: number
}

export interface TopLucro extends RankedMovie {
  lucro_usd: number
}

/** Médias 0–10 por gênero, só sobre filmes com avaliação de usuário. */
export interface GeneroStats {
  genero: string
  qtd_filmes_avaliados: number
  qtd_avaliacoes: number
  media_usuarios: number
  media_imdb: number | null
  media_tmdb: number | null
}

export interface AnoStats {
  ano: number
  qtd_filmes: number
}

export interface StatsOut {
  resumo: StatsResumo
  top_avaliados: TopAvaliado[]
  top_lucro: TopLucro[]
  generos: GeneroStats[]
  filmes_por_ano: AnoStats[]
}
