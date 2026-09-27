import { useId } from 'react'
import styles from './Rating.module.css'
import { NOTA_OPTIONS } from './nota'

interface NotaInputProps {
  /** Nota escolhida (0 a 10); null = nada escolhido. */
  value: number | null
  onChange: (nota: number) => void
  /** Nome acessível do grupo (ex.: "Sua nota"). */
  label: string
  disabled?: boolean
  /** Liga o grupo à mensagem de erro. */
  describedBy?: string
  invalid?: boolean
}

/** Escolha da nota de 0 a 10 como grupo de rádios: setas do teclado trocam a opção. */
export function NotaInput({ value, onChange, label, disabled = false, describedBy, invalid }: NotaInputProps) {
  const name = useId()
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      aria-disabled={disabled || undefined}
      className={styles.options}
    >
      {NOTA_OPTIONS.map((nota) => (
        <label key={nota} className={styles.option}>
          <input
            type="radio"
            className={styles.radio}
            name={name}
            value={nota}
            checked={value === nota}
            disabled={disabled}
            onChange={() => onChange(nota)}
          />
          <span aria-hidden="true">{nota}</span>
          <span className={styles.visuallyHidden}>{`Nota ${nota}`}</span>
        </label>
      ))}
    </div>
  )
}
