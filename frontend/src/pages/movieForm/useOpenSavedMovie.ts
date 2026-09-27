import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { genreKeys, movieKeys } from '../../api/queryKeys'
import type { MovieDetail } from '../../api/types'

/**
 * Depois de salvar: guarda o filme devolvido pela API no cache (o detalhe abre sem
 * outra busca), marca catálogo e gêneros como desatualizados e abre o detalhe.
 */
export function useOpenSavedMovie(): (movie: MovieDetail) => void {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return (movie) => {
    queryClient.setQueryData(movieKeys.detail(movie.sk_movie_id), movie)
    void queryClient.invalidateQueries({ queryKey: movieKeys.lists() })
    // Um gênero novo passa a existir ao salvar.
    void queryClient.invalidateQueries({ queryKey: genreKeys.all() })
    // replace: "Voltar" no navegador não retorna ao formulário já enviado.
    navigate(`/filmes/${encodeURIComponent(movie.sk_movie_id)}`, { replace: true })
  }
}
