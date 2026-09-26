import { useEffect, useEffectEvent, useState } from 'react'
import { useDebouncedValue } from './useDebouncedValue'

const identity = (value: string): string => value

/**
 * Campo de texto cujo valor "oficial" (ex.: na URL) só muda após `delayMs` sem digitação.
 *
 * Devolve [rascunho, setRascunho, assentou]. `assentou` fica true após `delayMs` sem
 * digitação (útil para só validar quando a pessoa para de digitar).
 *
 * `toCommitted` diz qual valor confirmado o rascunho produz (ex.: ano "19" → "" = sem
 * filtro). Se `committed` mudar para algo que o rascunho não produz (voltar do navegador,
 * "limpar filtros"), o rascunho é substituído e o texto antigo não é reconfirmado.
 */
export function useDebouncedInput(
  committed: string,
  onCommit: (value: string) => void,
  delayMs: number,
  toCommitted: (draft: string) => string = identity,
): [string, (value: string) => void, boolean] {
  const [draft, setDraft] = useState(committed)
  const [previousCommitted, setPreviousCommitted] = useState(committed)
  if (committed !== previousCommitted) {
    setPreviousCommitted(committed)
    if (toCommitted(draft) !== committed) {
      setDraft(committed)
    }
  }

  const debounced = useDebouncedValue(draft, delayMs)

  // Só reage quando o valor com debounce muda; o rascunho precisa ter "assentado".
  const handleSettled = useEffectEvent((value: string) => {
    if (value === draft && toCommitted(value) !== committed) {
      onCommit(value)
    }
  })
  useEffect(() => {
    handleSettled(debounced)
  }, [debounced])

  return [draft, setDraft, debounced === draft]
}
