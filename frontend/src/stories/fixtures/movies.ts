import type { MovieListItem } from '../../api/types'
// no-inline: o Vite embutiria o SVG pequeno como data: URL, que o formulário recusa.
import posterAsset from './poster.svg?no-inline'

/**
 * Pôster local com URL absoluta: o formulário só mostra prévia de URLs http(s),
 * e nenhuma story depende da rede ou do TMDB.
 */
export const MOCK_POSTER_URL = new URL(posterAsset, window.location.origin).href

export function mockMovie(overrides: Partial<MovieListItem> = {}): MovieListItem {
  return {
    sk_movie_id: 'm1',
    titulo: 'Alien, o Oitavo Passageiro',
    ano_lancamento: 1979,
    url_poster: MOCK_POSTER_URL,
    generos: ['Ficção científica', 'Horror'],
    nota_media: 8.4,
    qtd_avaliacoes: 12,
    ...overrides,
  }
}
