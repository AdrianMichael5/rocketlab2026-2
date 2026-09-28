import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import { PERSON_PAGE_SIZE, getPerson } from '../api/people'
import { personKeys } from '../api/queryKeys'
import type { PersonDetail, PersonType } from '../api/types'
import { LoadError } from '../components/LoadError/LoadError'
import { type LoadErrorTexts, loadErrorTitle } from '../components/LoadError/loadErrorTexts'
import { MovieCard } from '../components/MovieCard/MovieCard'
import { MovieCardSkeleton } from '../components/MovieCard/MovieCardSkeleton'
import { Pagination } from '../components/Pagination/Pagination'
import { StatusMessage } from '../components/StatusMessage/StatusMessage'
import { usePageTitle } from '../hooks/usePageTitle'
import { parsePage, totalPages } from './catalog/catalogParams'
import pageStyles from './Page.module.css'
import styles from './PersonPage.module.css'

const numberFormat = new Intl.NumberFormat('pt-BR')
const SKELETON_KEYS = Array.from({ length: PERSON_PAGE_SIZE }, (_, index) => index)

/** Papel pela função no filme (neutro em gênero, como na ficha técnica). */
const ROLE_LABELS: Record<PersonType, string> = {
  Diretor: 'Direção',
  Ator: 'Atuação',
  Roteirista: 'Roteiro',
}

const PERSON_LOAD_ERROR_TEXTS: LoadErrorTexts = {
  notFound: 'Pessoa não encontrada',
  failed: 'Não foi possível carregar a pessoa',
}

function totalLabel(total: number): string {
  return `${numberFormat.format(total)} ${total === 1 ? 'filme' : 'filmes'}`
}

/** Pessoa (diretor, ator ou roteirista) com a filmografia paginada; página em ?page=. */
export function PersonPage() {
  const { skPersonId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePage(searchParams.get('page'))
  const person = useQuery({
    queryKey: personKeys.detail(skPersonId, page),
    queryFn: ({ signal }) => getPerson(skPersonId, page, signal),
    // Mantém a página anterior na tela ao paginar, mas nunca mostra outra pessoa.
    placeholderData: (previous) => (previous?.sk_person_id === skPersonId ? previous : undefined),
  })
  usePageTitle(
    person.data?.nome ??
      (person.error ? loadErrorTitle(person.error, PERSON_LOAD_ERROR_TEXTS) : null),
  )

  function goToPage(next: number) {
    setSearchParams(next === 1 ? {} : { page: String(next) })
    window.scrollTo({ top: 0 })
  }

  if (person.data) {
    return (
      <PersonContent
        person={person.data}
        page={page}
        isStale={person.isPlaceholderData}
        onPageChange={goToPage}
      />
    )
  }
  if (person.isPending) {
    return <LoadingPerson />
  }
  return (
    <LoadError
      isPageTitle
      error={person.error}
      texts={PERSON_LOAD_ERROR_TEXTS}
      notFoundDescription="Ela pode ter sido removida ou o endereço está incorreto."
      isRetrying={person.isFetching}
      onRetry={() => person.refetch()}
    />
  )
}

function LoadingPerson() {
  return (
    <div role="status" aria-label="Carregando filmografia" aria-busy="true" className={styles.grid}>
      {SKELETON_KEYS.map((key) => (
        <MovieCardSkeleton key={key} />
      ))}
    </div>
  )
}

interface PersonContentProps {
  person: PersonDetail
  /** Página pedida na URL (a resposta pode ainda ser a anterior). */
  page: number
  isStale: boolean
  onPageChange: (page: number) => void
}

function PersonContent({ person, page, isStale, onPageChange }: PersonContentProps) {
  return (
    <>
      <section className={pageStyles.header}>
        <h1 className={pageStyles.title}>{person.nome}</h1>
        <p className={pageStyles.lead}>
          {ROLE_LABELS[person.tipo]} · {totalLabel(person.filmes.total)}
        </p>
      </section>
      <Filmography person={person} page={page} isStale={isStale} onPageChange={onPageChange} />
    </>
  )
}

function Filmography({ person, page, isStale, onPageChange }: PersonContentProps) {
  const { items, total } = person.filmes
  if (total === 0) {
    return (
      <StatusMessage
        title="Nenhum filme encontrado"
        description="Nenhum filme cadastrado para esta pessoa."
      />
    )
  }
  if (items.length === 0) {
    // Página além do fim (URL antiga ou editada à mão).
    return (
      <StatusMessage
        title={`Não há filmes na página ${numberFormat.format(page)}`}
        description={`${person.nome} tem ${totalLabel(total)}.`}
        action={
          <button type="button" onClick={() => onPageChange(1)}>
            Ir para a primeira página
          </button>
        }
      />
    )
  }

  return (
    <>
      <ul
        role="list"
        aria-label={`Filmes de ${person.nome}`}
        aria-busy={isStale}
        className={styles.grid}
      >
        {items.map((movie) => (
          <li key={movie.sk_movie_id}>
            <MovieCard movie={movie} />
          </li>
        ))}
      </ul>
      <Pagination
        page={page}
        totalPages={totalPages(total, PERSON_PAGE_SIZE)}
        onPageChange={onPageChange}
      />
    </>
  )
}
