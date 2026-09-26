import { type PointerEvent, useId, useState } from 'react'
import styles from './StarRating.module.css'
import {
  STAR_COUNT,
  STAR_STEP,
  type StarFill,
  formatStars,
  notaToStars,
  starFill,
  starsLabel,
  starsToNota,
} from './rating'

type StarSize = 'sm' | 'md' | 'lg'

interface BaseProps {
  /** Nota 0–10 da API; null = sem avaliação / nada escolhido. */
  value: number | null
  size?: StarSize
}

interface DisplayProps extends BaseProps {
  onChange?: undefined
  label?: undefined
  disabled?: undefined
  name?: undefined
}

interface InputProps extends BaseProps {
  /** Recebe a nota 0–10 escolhida (sempre múltiplo de 1, de 1 a 10). */
  onChange: (nota: number) => void
  /** Nome acessível do grupo (ex.: "Sua nota"). */
  label: string
  disabled?: boolean
  /** Nome do grupo de rádios; gerado automaticamente se omitido. */
  name?: string
}

export type StarRatingProps = DisplayProps | InputProps

const POSITIONS = Array.from({ length: STAR_COUNT }, (_, index) => index + 1)
// Mesma estrela de 5 pontas em todas as posições (viewBox 24×24).
const STAR_PATH =
  'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z'

/** Exibe uma nota 0–10 como 5 estrelas com meia, ou permite escolhê-la (com `onChange`). */
export function StarRating(props: StarRatingProps) {
  return props.onChange ? <StarInput {...props} /> : <StarDisplay {...props} />
}

function StarDisplay({ value, size = 'md' }: DisplayProps) {
  const estrelas = notaToStars(value)
  const label = estrelas === null ? 'Sem avaliações' : `Nota ${formatStars(estrelas)} de 5 estrelas`
  return (
    <span role="img" aria-label={label} className={`${styles.rating} ${styles[size]}`}>
      {POSITIONS.map((posicao) => (
        <Star key={posicao} fill={starFill(estrelas, posicao)} />
      ))}
    </span>
  )
}

function StarInput({ value, onChange, label, disabled = false, name, size = 'lg' }: InputProps) {
  const generatedName = useId()
  const [preview, setPreview] = useState<number | null>(null)
  const [valorAnterior, setValorAnterior] = useState(value)
  // Valor mudou (clique, teclado ou formulário reiniciado): a prévia antiga não vale mais.
  if (value !== valorAnterior) {
    setValorAnterior(value)
    setPreview(null)
  }
  const selecionadas = notaToStars(value)
  const exibidas = preview ?? selecionadas

  // Só mouse: no toque não há "sair", e a prévia ficaria presa após o toque.
  function handlePointerEnter(event: PointerEvent<HTMLLabelElement>, estrelas: number) {
    if (!disabled && event.pointerType === 'mouse') {
      setPreview(estrelas)
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={`${styles.rating} ${styles.input} ${styles[size]}`}
      onPointerLeave={() => setPreview(null)}
    >
      {POSITIONS.map((posicao) => (
        <span key={posicao} className={styles.slot}>
          <Star fill={starFill(exibidas, posicao)} />
          {[posicao - STAR_STEP, posicao].map((estrelas) => (
            <label
              key={estrelas}
              className={estrelas < posicao ? styles.leftHalf : styles.rightHalf}
              onPointerEnter={(event) => handlePointerEnter(event, estrelas)}
            >
              <input
                type="radio"
                className={styles.radio}
                name={name ?? generatedName}
                value={starsToNota(estrelas)}
                aria-label={starsLabel(estrelas)}
                checked={selecionadas === estrelas}
                disabled={disabled}
                onChange={() => onChange(starsToNota(estrelas))}
              />
            </label>
          ))}
        </span>
      ))}
    </div>
  )
}

function Star({ fill }: { fill: StarFill }) {
  return (
    <svg viewBox="0 0 24 24" className={styles.star} data-fill={fill} aria-hidden="true">
      <path d={STAR_PATH} className={styles.track} />
      {fill !== 'empty' && <path d={STAR_PATH} className={styles.filled} />}
    </svg>
  )
}
