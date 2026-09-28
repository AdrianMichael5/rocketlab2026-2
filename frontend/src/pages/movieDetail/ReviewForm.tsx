import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useId, useState } from 'react'
import { splitFieldErrors } from '../../api/fieldErrors'
import { movieKeys, personKeys } from '../../api/queryKeys'
import { createReview } from '../../api/reviews'
import type { ReviewCreate } from '../../api/types'
import { NotaInput } from '../../components/Rating/NotaInput'
import styles from './Reviews.module.css'

// Limites de backend/app/reviews/schemas.py (MAX_NOME, MAX_COMENTARIO).
const MAX_NOME = 120
const MAX_COMENTARIO = 4000

type Campo = 'nome' | 'nota' | 'comentario'
type FieldErrors = Partial<Record<Campo, string>>

interface ReviewValues {
  nome: string
  nota: number | null
  comentario: string
}

const EMPTY_VALUES: ReviewValues = { nome: '', nota: null, comentario: '' }
const CAMPOS: readonly Campo[] = ['nome', 'nota', 'comentario']

function validate(values: ReviewValues): FieldErrors {
  return {
    ...(values.nome.trim() === '' && { nome: 'Informe seu nome.' }),
    ...(values.nota === null && { nota: 'Escolha uma nota.' }),
    ...(values.comentario.trim() === '' && { comentario: 'Escreva um comentário.' }),
  }
}

interface ReviewFormProps {
  skMovieId: string
  /** Chamado depois que a avaliação é criada. */
  onCreated: () => void
}

export function ReviewForm({ skMovieId, onCreated }: ReviewFormProps) {
  const queryClient = useQueryClient()
  const id = useId()
  const [values, setValues] = useState<ReviewValues>(EMPTY_VALUES)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [sent, setSent] = useState(false)

  const mutation = useMutation({
    mutationFn: (payload: ReviewCreate) => createReview(skMovieId, payload),
    onSuccess: () => {
      setValues(EMPTY_VALUES)
      setErrors({})
      setSent(true)
      onCreated()
      // ['movie', id] cobre o detalhe (média) e as páginas de avaliações.
      void queryClient.invalidateQueries({ queryKey: movieKeys.detail(skMovieId) })
      void queryClient.invalidateQueries({ queryKey: movieKeys.lists() })
      // Os cards da página da pessoa também mostram a média.
      void queryClient.invalidateQueries({ queryKey: personKeys.all() })
    },
    onError: (error) => setErrors(splitFieldErrors(error, CAMPOS).fields),
  })
  const generalError = mutation.error ? splitFieldErrors(mutation.error, CAMPOS).general : null

  function update<K extends Campo>(campo: K, value: ReviewValues[K]) {
    setValues((current) => ({ ...current, [campo]: value }))
    setSent(false)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    mutation.reset()
    setSent(false)
    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length > 0 || values.nota === null) {
      return
    }
    mutation.mutate({
      nome: values.nome.trim(),
      nota: values.nota,
      comentario: values.comentario.trim(),
    })
  }

  // Bloqueados durante o envio: o sucesso limpa o formulário e apagaria o que fosse digitado.
  const fieldProps = (campo: Campo) => ({
    id: `${id}-${campo}`,
    disabled: mutation.isPending,
    'aria-invalid': errors[campo] ? true : undefined,
    'aria-describedby': errors[campo] ? `${id}-${campo}-erro` : undefined,
  })

  return (
    <form noValidate onSubmit={handleSubmit} aria-labelledby={`${id}-titulo`} className={styles.form}>
      <h3 id={`${id}-titulo`} className={styles.formTitle}>
        Avaliar este filme
      </h3>

      <div className={styles.field}>
        <label htmlFor={`${id}-nome`} className={styles.label}>
          Seu nome
        </label>
        <input
          {...fieldProps('nome')}
          type="text"
          autoComplete="name"
          maxLength={MAX_NOME}
          className={styles.input}
          value={values.nome}
          onChange={(event) => update('nome', event.target.value)}
        />
        <FieldError id={`${id}-nome-erro`} message={errors.nome} />
      </div>

      <div className={styles.field}>
        {/* O grupo de rádios já se anuncia como "Sua nota"; o rótulo visível é só visual. */}
        <span className={styles.label} aria-hidden="true">
          Sua nota (0 a 10)
        </span>
        <NotaInput
          value={values.nota}
          onChange={(nota) => update('nota', nota)}
          label="Sua nota (0 a 10)"
          disabled={mutation.isPending}
          invalid={errors.nota ? true : undefined}
          describedBy={errors.nota ? `${id}-nota-erro` : undefined}
        />
        <FieldError id={`${id}-nota-erro`} message={errors.nota} />
      </div>

      <div className={styles.field}>
        <label htmlFor={`${id}-comentario`} className={styles.label}>
          Comentário
        </label>
        <textarea
          {...fieldProps('comentario')}
          rows={4}
          maxLength={MAX_COMENTARIO}
          className={styles.input}
          value={values.comentario}
          onChange={(event) => update('comentario', event.target.value)}
        />
        <FieldError id={`${id}-comentario-erro`} message={errors.comentario} />
      </div>

      {generalError && (
        <p role="alert" className={styles.error}>
          {generalError}
        </p>
      )}
      <div className={styles.formFooter}>
        <button type="submit" className={styles.submit} disabled={mutation.isPending}>
          {mutation.isPending ? 'Enviando…' : 'Enviar avaliação'}
        </button>
        <p role="status" className={styles.success}>
          {sent ? 'Avaliação enviada.' : ''}
        </p>
      </div>
    </form>
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
