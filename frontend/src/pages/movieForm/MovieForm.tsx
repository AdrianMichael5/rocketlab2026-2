import { useMutation, useQuery } from '@tanstack/react-query'
import { type FormEvent, type ReactNode, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { splitFieldErrors } from '../../api/fieldErrors'
import { listGenres } from '../../api/genres'
import { genreKeys } from '../../api/queryKeys'
import { TagInput } from '../../components/TagInput/TagInput'
import styles from './MovieForm.module.css'
import {
  MAX_ANO,
  MAX_NOMES_POR_LISTA,
  MOVIE_FIELDS,
  type MovieField,
  type MovieFormErrors,
  type MovieFormValues,
  STATUS_OPTIONS,
  validateMovie,
  withReleaseDate,
  yearFollowsDate,
} from './movieFormModel'
import { PosterPreview } from './PosterPreview'

// Tamanho de cada nome, como em schemas.py (Diretores/Generos).
const MAX_NOME_DIRETOR = 255
const MAX_NOME_GENERO = 50

interface MovieFormProps {
  initial: MovieFormValues
  submitLabel: string
  /** Destino do "Cancelar". */
  cancelTo: string
  /** Salva os valores já validados; se rejeitar, os erros aparecem no formulário. */
  onSubmit: (values: MovieFormValues) => Promise<void>
}

/** Formulário de filme compartilhado por cadastro e edição. */
export function MovieForm({ initial, submitLabel, cancelTo, onSubmit }: MovieFormProps) {
  const id = useId()
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<MovieFormErrors>({})
  const [hasClientErrors, setHasClientErrors] = useState(false)
  // Enquanto o ano não for digitado à parte, ele acompanha a data de lançamento.
  const [yearFollows, setYearFollows] = useState(() => yearFollowsDate(initial))
  const genres = useQuery({
    queryKey: genreKeys.all(),
    queryFn: ({ signal }) => listGenres(signal),
    staleTime: Infinity,
  })
  const mutation = useMutation({
    mutationFn: onSubmit,
    onError: (error) => setErrors(splitFieldErrors(error, MOVIE_FIELDS).fields),
  })
  const generalError = hasClientErrors
    ? 'Corrija os campos destacados.'
    : mutation.error && splitFieldErrors(mutation.error, MOVIE_FIELDS).general

  function change(next: MovieFormValues, ...campos: MovieField[]) {
    setValues(next)
    // Editar o campo tira o erro dele; o resto continua até o próximo envio.
    setErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([campo]) => !campos.includes(campo as MovieField)),
      ),
    )
  }

  function update<K extends MovieField>(campo: K, value: MovieFormValues[K]) {
    change({ ...values, [campo]: value }, campo)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    mutation.reset()
    const found = validateMovie(values)
    setErrors(found)
    const invalid = Object.keys(found).length > 0
    setHasClientErrors(invalid)
    if (!invalid) {
      mutation.mutate(values)
    }
  }

  const fieldId = (campo: MovieField) => `${id}-${campo}`
  const errorId = (campo: MovieField) => `${id}-${campo}-erro`
  const a11y = (campo: MovieField) => ({
    id: fieldId(campo),
    'aria-invalid': errors[campo] ? true : undefined,
    'aria-describedby': errors[campo] ? errorId(campo) : undefined,
  })
  const fieldMeta = (campo: MovieField) => ({
    htmlFor: fieldId(campo),
    error: errors[campo],
    errorId: errorId(campo),
  })
  const knownStatus = (STATUS_OPTIONS as readonly string[]).includes(values.status_filme)
  // Status fora da lista (vindo dos dados) continua selecionável na edição.
  const statusOptions =
    values.status_filme === '' || knownStatus
      ? STATUS_OPTIONS
      : [...STATUS_OPTIONS, values.status_filme]

  return (
    <form noValidate onSubmit={handleSubmit} className={styles.form}>
      <fieldset disabled={mutation.isPending} className={styles.fields}>
        <Field label="Título" {...fieldMeta('titulo')}>
          <input
            {...a11y('titulo')}
            type="text"
            className={styles.input}
            value={values.titulo}
            onChange={(event) => update('titulo', event.target.value)}
          />
        </Field>

        <div className={styles.field}>
          <TagInput
            label="Diretores"
            values={values.diretores}
            onChange={(diretores) => update('diretores', diretores)}
            maxItems={MAX_NOMES_POR_LISTA}
            maxLength={MAX_NOME_DIRETOR}
            invalid={Boolean(errors.diretores)}
            describedBy={errors.diretores ? errorId('diretores') : undefined}
          />
          <FieldError id={errorId('diretores')} message={errors.diretores} />
        </div>

        <div className={styles.row}>
          <Field label="Ano" {...fieldMeta('ano_lancamento')}>
            <input
              {...a11y('ano_lancamento')}
              type="text"
              inputMode="numeric"
              maxLength={String(MAX_ANO).length}
              className={styles.input}
              value={values.ano_lancamento}
              onChange={(event) => {
                update('ano_lancamento', event.target.value)
                // Ano apagado volta a acompanhar a data; digitado, passa a valer por si.
                setYearFollows(event.target.value.trim() === '')
              }}
            />
          </Field>
          <Field label="Data de lançamento" {...fieldMeta('data_lancamento')}>
            <input
              {...a11y('data_lancamento')}
              type="date"
              className={styles.input}
              value={values.data_lancamento}
              onChange={(event) =>
                change(
                  withReleaseDate(values, event.target.value, yearFollows),
                  'data_lancamento',
                  'ano_lancamento',
                )
              }
            />
          </Field>
          <Field label="Duração (minutos)" {...fieldMeta('duracao_minutos')}>
            <input
              {...a11y('duracao_minutos')}
              type="text"
              inputMode="numeric"
              className={styles.input}
              value={values.duracao_minutos}
              onChange={(event) => update('duracao_minutos', event.target.value)}
            />
          </Field>
        </div>

        <div className={styles.field}>
          <TagInput
            label="Gêneros"
            values={values.generos}
            onChange={(generos) => update('generos', generos)}
            suggestions={genres.data ?? []}
            maxItems={MAX_NOMES_POR_LISTA}
            maxLength={MAX_NOME_GENERO}
            invalid={Boolean(errors.generos)}
            describedBy={errors.generos ? errorId('generos') : undefined}
          />
          <FieldError id={errorId('generos')} message={errors.generos} />
        </div>

        <Field label="Status" {...fieldMeta('status_filme')}>
          <select
            {...a11y('status_filme')}
            className={styles.input}
            value={values.status_filme}
            onChange={(event) => update('status_filme', event.target.value)}
          >
            <option value="">Não informado</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Sinopse" {...fieldMeta('sinopse')}>
          <textarea
            {...a11y('sinopse')}
            rows={5}
            className={styles.input}
            value={values.sinopse}
            onChange={(event) => update('sinopse', event.target.value)}
          />
        </Field>

        <Field label="URL do pôster" {...fieldMeta('url_poster')}>
          <input
            {...a11y('url_poster')}
            type="url"
            inputMode="url"
            placeholder="https://…"
            className={styles.input}
            value={values.url_poster}
            onChange={(event) => update('url_poster', event.target.value)}
          />
        </Field>
      </fieldset>

      <aside className={styles.side}>
        <PosterPreview url={values.url_poster} />
      </aside>

      <div className={styles.footer}>
        {generalError && (
          <p role="alert" className={styles.alert}>
            {generalError}
          </p>
        )}
        <div className={styles.actions}>
          <button type="submit" className={styles.submit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Salvando…' : submitLabel}
          </button>
          <Link to={cancelTo} className={styles.cancel}>
            Cancelar
          </Link>
        </div>
      </div>
    </form>
  )
}

interface FieldProps {
  label: string
  htmlFor: string
  error: string | undefined
  errorId: string
  children: ReactNode
}

function Field({ label, htmlFor, error, errorId, children }: FieldProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={htmlFor} className={styles.label}>
        {label}
      </label>
      {children}
      <FieldError id={errorId} message={error} />
    </div>
  )
}

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) {
    return null
  }
  return (
    <p id={id} className={styles.error}>
      {message}
    </p>
  )
}
