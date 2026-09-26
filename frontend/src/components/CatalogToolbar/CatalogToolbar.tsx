import { type FormEvent, type KeyboardEvent, useId } from 'react'
import type { MovieOrder } from '../../api/types'
import { useDebouncedInput } from '../../hooks/useDebouncedInput'
import {
  type CatalogParams,
  MAX_ANO,
  MIN_ANO,
  ORDERS,
  parseAno,
} from '../../pages/catalog/catalogParams'
import type { UpdateCatalogParams } from '../../pages/catalog/useCatalogParams'
import styles from './CatalogToolbar.module.css'

const INPUT_DEBOUNCE_MS = 300
const MAX_BUSCA_LENGTH = 200

const ORDER_LABELS: Record<MovieOrder, string> = {
  titulo: 'Título (A–Z)',
  ano: 'Mais recentes',
  nota: 'Melhor avaliados',
}

interface CatalogToolbarProps {
  params: CatalogParams
  /** Gêneros disponíveis; pode vir vazio se a lista ainda não carregou ou falhou. */
  genres: string[]
  onChange: UpdateCatalogParams
}

/** Busca por título, filtros de gênero e ano e ordenação do catálogo. */
export function CatalogToolbar({ params, genres, onChange }: CatalogToolbarProps) {
  const [busca, setBusca] = useDebouncedInput(
    params.q,
    (q) => onChange({ q }, { replace: true }),
    INPUT_DEBOUNCE_MS,
  )
  const [ano, setAno, anoAssentou] = useDebouncedInput(
    params.ano === null ? '' : String(params.ano),
    (texto) => onChange({ ano: parseAno(texto) }, { replace: true }),
    INPUT_DEBOUNCE_MS,
    anoParaUrl,
  )
  // Só avisa depois que a pessoa para de digitar, para não acusar "19" no meio de "1994".
  const anoInvalido = anoAssentou && ano.trim() !== '' && parseAno(ano) === null
  const anoId = useId()

  // O gênero da URL continua selecionável mesmo que não esteja (ainda) na lista.
  const genreOptions =
    params.genero && !genres.includes(params.genero) ? [params.genero, ...genres] : genres

  // Sem botão de envio, o formulário não se envia com Enter (há mais de um campo de texto).
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
  }

  // Enter aplica a busca sem esperar o debounce.
  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && busca !== params.q) {
      onChange({ q: busca })
    }
  }

  return (
    <form role="search" aria-label="Buscar filmes" className={styles.toolbar} onSubmit={handleSubmit}>
      <label className={`${styles.field} ${styles.search}`}>
        <span className={styles.label}>Buscar por título</span>
        <input
          type="search"
          className={styles.control}
          value={busca}
          maxLength={MAX_BUSCA_LENGTH}
          placeholder="Ex.: O Poderoso Chefão"
          onChange={(event) => setBusca(event.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Gênero</span>
        <select
          className={styles.control}
          value={params.genero}
          onChange={(event) => onChange({ genero: event.target.value })}
        >
          <option value="">Todos os gêneros</option>
          {genreOptions.map((genero) => (
            <option key={genero} value={genero}>
              {genero}
            </option>
          ))}
        </select>
      </label>

      {/* div + htmlFor: o aviso de erro não pode entrar no nome acessível do campo. */}
      <div className={styles.field}>
        <label htmlFor={anoId} className={styles.label}>
          Ano
        </label>
        <input
          id={anoId}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          className={styles.control}
          value={ano}
          placeholder="Ex.: 1994"
          aria-invalid={anoInvalido || undefined}
          aria-describedby={anoInvalido ? `${anoId}-erro` : undefined}
          onChange={(event) => setAno(event.target.value)}
        />
        {anoInvalido && (
          <p id={`${anoId}-erro`} className={styles.error}>
            Informe um ano entre {MIN_ANO} e {MAX_ANO}.
          </p>
        )}
      </div>

      <label className={styles.field}>
        <span className={styles.label}>Ordenar por</span>
        <select
          className={styles.control}
          value={params.ordem}
          onChange={(event) => onChange({ ordem: event.target.value as MovieOrder })}
        >
          {ORDERS.map((ordem) => (
            <option key={ordem} value={ordem}>
              {ORDER_LABELS[ordem]}
            </option>
          ))}
        </select>
      </label>
    </form>
  )
}

/**
 * Valor do filtro de ano que o texto do campo produz. Vazio, incompleto ou fora dos
 * limites vira "sem filtro", para a lista nunca ficar filtrada por um ano diferente do
 * que o campo mostra. Se já não há filtro, texto inválido não muda a URL (nem a página).
 */
function anoParaUrl(texto: string): string {
  const ano = parseAno(texto)
  return ano === null ? '' : String(ano)
}
