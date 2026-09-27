import { createMovie } from '../api/movies'
import { usePageTitle } from '../hooks/usePageTitle'
import styles from './Page.module.css'
import { MovieForm } from './movieForm/MovieForm'
import { EMPTY_MOVIE_FORM, type MovieFormValues, toCreatePayload } from './movieForm/movieFormModel'
import { useOpenSavedMovie } from './movieForm/useOpenSavedMovie'

/** Cadastro de filme; ao salvar, abre o detalhe do filme criado. */
export function NewMoviePage() {
  usePageTitle('Novo filme')
  const openSavedMovie = useOpenSavedMovie()

  async function save(values: MovieFormValues) {
    openSavedMovie(await createMovie(toCreatePayload(values)))
  }

  return (
    <>
      <section className={styles.header}>
        <h1 className={styles.title}>Novo filme</h1>
      </section>
      <MovieForm
        initial={EMPTY_MOVIE_FORM}
        submitLabel="Cadastrar filme"
        cancelTo="/"
        onSubmit={save}
      />
    </>
  )
}
