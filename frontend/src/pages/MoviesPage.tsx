import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { listGenres } from '../api/genres'
import { listMovies } from '../api/movies'
import { movieKeys } from '../api/queryKeys'
import type { MovieListItem, Page } from '../api/types'
import { CatalogToolbar } from '../components/CatalogToolbar/CatalogToolbar'
import { MovieCard } from '../components/MovieCard/MovieCard'
import { MovieCardSkeleton } from '../components/MovieCard/MovieCardSkeleton'
import { Pagination } from '../components/Pagination/Pagination'
import { StatusMessage } from '../components/StatusMessage/StatusMessage'
import {
  CATALOG_PAGE_SIZE,
  type CatalogParams,
  toMovieFilters,
  totalPages,
} from './catalog/catalogParams'
import { useCatalogParams } from './catalog/useCatalogParams'
import styles from './MoviesPage.module.css'
import pageStyles from './Page.module.css'

const numberFormat = new Intl.NumberFormat('pt-BR')
const SKELETON_KEYS = Array.from({ length: CATALOG_PAGE_SIZE }, (_, index) => index)

function totalLabel(total: number): string {
  return `${numberFormat.format(total)} ${total === 1 ? 'filme' : 'filmes'}`
}

function hasActiveFilters(params: CatalogParams): boolean {
  return params.q.trim() !== '' || params.genero !== '' || params.ano !== null
}

/** Catálogo: busca, filtros, ordenação e paginação, com o estado na URL. */
export function MoviesPage() {
  const { params, update, clear } = useCatalogParams()
  const filters = toMovieFilters(params)
  const movies = useQuery({
    queryKey: movieKeys.list(filters),
    queryFn: ({ signal }) => listMovies(filters, signal),
    // Mantém a página anterior na tela enquanto a próxima carrega (sem piscar o esqueleto).
    placeholderData: keepPreviousData,
  })
  const genres = useQuery({
    queryKey: ['genres'],
    queryFn: ({ signal }) => listGenres(signal),
    staleTime: Infinity,
  })

  function goToPage(page: number) {
    update({ page })
    window.scrollTo({ top: 0 })
  }

  return (
    <>
      <section className={pageStyles.header}>
        <h1 className={pageStyles.title}>Filmes</h1>
        <p className={pageStyles.lead} aria-live="polite">
          {movies.data ? totalLabel(movies.data.total) : ' '}
        </p>
      </section>

      <CatalogToolbar params={params} genres={genres.data ?? []} onChange={update} />

      {movies.isPending ? (
        <LoadingGrid />
      ) : movies.isError ? (
        <StatusMessage
          tone="error"
          title="Não foi possível carregar os filmes"
          description={movies.error.message}
          action={
            <button type="button" disabled={movies.isFetching} onClick={() => movies.refetch()}>
              {movies.isFetching ? 'Tentando…' : 'Tentar novamente'}
            </button>
          }
        />
      ) : (
        <Results
          page={movies.data}
          params={params}
          isStale={movies.isPlaceholderData}
          onPageChange={goToPage}
          onClear={clear}
        />
      )}
    </>
  )
}

function LoadingGrid() {
  return (
    <div role="status" aria-label="Carregando filmes" aria-busy="true" className={styles.grid}>
      {SKELETON_KEYS.map((key) => (
        <MovieCardSkeleton key={key} />
      ))}
    </div>
  )
}

interface ResultsProps {
  page: Page<MovieListItem>
  params: CatalogParams
  /** Resultados da consulta anterior, exibidos enquanto a nova carrega. */
  isStale: boolean
  onPageChange: (page: number) => void
  onClear: () => void
}

function Results({ page, params, isStale, onPageChange, onClear }: ResultsProps) {
  if (page.items.length === 0) {
    return <EmptyResults page={page} params={params} onPageChange={onPageChange} onClear={onClear} />
  }

  return (
    <>
      <ul role="list" aria-label="Filmes" aria-busy={isStale} className={styles.grid}>
        {page.items.map((movie) => (
          <li key={movie.sk_movie_id}>
            <MovieCard movie={movie} />
          </li>
        ))}
      </ul>
      <Pagination
        page={params.page}
        totalPages={totalPages(page.total, CATALOG_PAGE_SIZE)}
        onPageChange={onPageChange}
      />
    </>
  )
}

type EmptyResultsProps = Omit<ResultsProps, 'isStale'>

function EmptyResults({ page, params, onPageChange, onClear }: EmptyResultsProps) {
  // Página além do fim (URL antiga ou editada à mão), mas há filmes nas anteriores.
  if (page.total > 0) {
    return (
      <StatusMessage
        title={`Não há filmes na página ${numberFormat.format(params.page)}`}
        description={`A busca tem ${totalLabel(page.total)}.`}
        action={
          <button type="button" onClick={() => onPageChange(1)}>
            Ir para a primeira página
          </button>
        }
      />
    )
  }
  if (hasActiveFilters(params)) {
    return (
      <StatusMessage
        title="Nenhum filme encontrado"
        description="Tente outros termos ou remova os filtros."
        action={
          <button type="button" onClick={onClear}>
            Limpar filtros
          </button>
        }
      />
    )
  }
  return (
    <StatusMessage
      title="Nenhum filme cadastrado"
      description="O catálogo está vazio."
      action={<Link to="/filmes/novo">Adicionar filme</Link>}
    />
  )
}
