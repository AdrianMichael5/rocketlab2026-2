import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { MovieListItem } from '../../api/types'
import { movie } from '../../test/apiMock'
import { MovieCard } from './MovieCard'
import { POSTER_PLACEHOLDER } from './poster'

function renderCard(overrides: Partial<MovieListItem> = {}) {
  return render(
    <MemoryRouter>
      <MovieCard movie={movie(overrides)} />
    </MemoryRouter>,
  )
}

describe('MovieCard', () => {
  it('mostra título, ano e gêneros', () => {
    renderCard()

    expect(screen.getByRole('heading', { name: 'Alien' })).toBeInTheDocument()
    expect(screen.getByText('1979')).toBeInTheDocument()
    expect(screen.getByText('Horror · Ficção científica')).toBeInTheDocument()
  })

  it('o título leva à página do filme', () => {
    renderCard({ sk_movie_id: 'a/b' })

    expect(screen.getByRole('link', { name: /Alien/ })).toHaveAttribute('href', '/filmes/a%2Fb')
  })

  it('mostra o pôster com texto alternativo', () => {
    renderCard()

    const poster = screen.getByRole('img', { name: 'Pôster de Alien' })
    expect(poster).toHaveAttribute('src', 'https://image.tmdb.org/t/p/w500/alien.jpg')
    expect(poster).toHaveAttribute('loading', 'lazy')
  })

  it('usa a imagem padrão quando o filme não tem pôster', () => {
    renderCard({ url_poster: null })

    expect(screen.getByRole('img', { name: 'Pôster de Alien' })).toHaveAttribute(
      'src',
      POSTER_PLACEHOLDER,
    )
  })

  it('troca para a imagem padrão quando o pôster não carrega', () => {
    renderCard()
    const poster = screen.getByRole('img', { name: 'Pôster de Alien' })

    fireEvent.error(poster)

    expect(poster).toHaveAttribute('src', POSTER_PLACEHOLDER)
  })

  it('mostra a média de 0 a 10 e a quantidade de avaliações', () => {
    renderCard({ nota_media: 9, qtd_avaliacoes: 2 })

    expect(screen.getByRole('img', { name: 'Nota média 9,0 de 10' })).toBeInTheDocument()
    expect(screen.getByText('2 avaliações')).toBeInTheDocument()
  })

  it('usa o singular com uma avaliação', () => {
    renderCard({ nota_media: 6, qtd_avaliacoes: 1 })

    expect(screen.getByText('1 avaliação')).toBeInTheDocument()
  })

  it('mostra "Sem avaliações" em vez da nota quando não há nota', () => {
    renderCard({ nota_media: null, qtd_avaliacoes: 0 })

    expect(screen.getByText('Sem avaliações')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Nota/ })).not.toBeInTheDocument()
  })

  it('omite ano e gêneros desconhecidos', () => {
    const { container } = renderCard({ ano_lancamento: null, generos: [] })

    expect(screen.queryByText('1979')).not.toBeInTheDocument()
    expect(container.querySelector('.genres')).toBeNull()
  })
})
