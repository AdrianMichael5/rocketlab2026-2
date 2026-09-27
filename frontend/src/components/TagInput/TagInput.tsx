import { type ChangeEvent, type KeyboardEvent, useId, useState } from 'react'
import styles from './TagInput.module.css'

export interface TagInputProps {
  /** Rótulo visível do campo; também nomeia a lista ("<label> selecionados"). */
  label: string
  values: string[]
  onChange: (values: string[]) => void
  /** Opções existentes; escolher uma usa a grafia dela. */
  suggestions?: string[]
  maxItems?: number
  /** Tamanho máximo de cada item. */
  maxLength?: number
  disabled?: boolean
  invalid?: boolean
  /** id do elemento com a mensagem de erro. */
  describedBy?: string
}

const sameName = (a: string, b: string): boolean =>
  a.toLocaleLowerCase('pt-BR') === b.toLocaleLowerCase('pt-BR')

// Chrome/Firefox disparam este inputType ao escolher uma opção do <datalist>.
const DATALIST_PICK = 'insertReplacementText'

/** Entrada de vários valores como etiquetas: Enter ou vírgula adicionam, "×" remove. */
export function TagInput({
  label,
  values,
  onChange,
  suggestions = [],
  maxItems,
  maxLength,
  disabled = false,
  invalid = false,
  describedBy,
}: TagInputProps) {
  const id = useId()
  const [draft, setDraft] = useState('')
  const isFull = maxItems !== undefined && values.length >= maxItems
  const available = suggestions.filter((option) => !values.some((value) => sameName(value, option)))

  function add(text: string) {
    const name = text.trim()
    setDraft('')
    if (name === '' || isFull || values.some((value) => sameName(value, name))) {
      return
    }
    const existing = suggestions.find((option) => sameName(option, name))
    onChange([...values, existing ?? name])
  }

  function remove(index: number) {
    onChange(values.filter((_, position) => position !== index))
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { value } = event.target
    const inputType = (event.nativeEvent as InputEvent).inputType
    if (inputType === DATALIST_PICK && suggestions.some((option) => sameName(option, value))) {
      add(value)
    } else if (value.endsWith(',')) {
      add(value.slice(0, -1))
    } else {
      setDraft(value)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      // Enter adiciona o item em vez de enviar o formulário.
      event.preventDefault()
      add(draft)
    } else if (event.key === 'Backspace' && draft === '' && values.length > 0) {
      remove(values.length - 1)
    }
  }

  return (
    <div className={styles.tagInput}>
      <label htmlFor={`${id}-input`} className={styles.label}>
        {label}
      </label>
      {values.length > 0 && (
        <ul role="list" aria-label={`${label} selecionados`} className={styles.tags}>
          {values.map((value, index) => (
            <li key={value} className={styles.tag}>
              {value}
              <button
                type="button"
                className={styles.remove}
                aria-label={`Remover ${value}`}
                disabled={disabled}
                onClick={() => remove(index)}
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={`${id}-input`}
        type="text"
        className={styles.input}
        list={available.length > 0 ? `${id}-sugestoes` : undefined}
        value={draft}
        maxLength={maxLength}
        disabled={disabled || isFull}
        placeholder={isFull ? `Limite de ${maxItems} atingido` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={[`${id}-dica`, describedBy].filter(Boolean).join(' ')}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => add(draft)}
      />
      <p id={`${id}-dica`} className={styles.hint}>
        Pressione Enter ou vírgula para adicionar.
      </p>
      {available.length > 0 && (
        <datalist id={`${id}-sugestoes`}>
          {available.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
    </div>
  )
}
