import { type ReactNode, type SyntheticEvent, useEffect, useId, useRef } from 'react'
import styles from './ConfirmDialog.module.css'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel: string
  /** Texto do botão de confirmação enquanto a ação roda (ex.: "Removendo…"). */
  pendingLabel?: string
  cancelLabel?: string
  isPending?: boolean
  /** Falha da ação confirmada, exibida dentro do modal. */
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Modal de confirmação com <dialog> nativo: foco preso, fundo inerte e Esc vêm do
 * navegador. Quem controla a abertura é `open`; Esc e Cancelar só pedem o fechamento.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pendingLabel = confirmLabel,
  cancelLabel = 'Cancelar',
  isPending = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) {
      return
    }
    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    // Sem isso o navegador fecharia o modal sozinho, fora do controle de `open`.
    event.preventDefault()
    if (!isPending) {
      onCancel()
    }
  }

  // Alguns navegadores fecham mesmo com preventDefault (Esc repetido). Durante a ação,
  // reabre para o resultado (inclusive o erro) continuar visível; fora dela, cancela.
  function handleClose(event: SyntheticEvent<HTMLDialogElement>) {
    if (!open) {
      return
    }
    if (isPending) {
      event.currentTarget.showModal()
    } else {
      onCancel()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={handleCancel}
      onClose={handleClose}
    >
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
      <p id={descriptionId} className={styles.description}>
        {description}
      </p>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <button type="button" className={styles.cancel} disabled={isPending} onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" className={styles.confirm} disabled={isPending} onClick={onConfirm}>
          {isPending ? pendingLabel : confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
