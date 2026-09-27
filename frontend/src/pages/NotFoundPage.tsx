import { Link } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'
import styles from './Page.module.css'

export function NotFoundPage() {
  usePageTitle('Página não encontrada')
  return (
    <section className={styles.header}>
      <h1 className={styles.title}>Página não encontrada</h1>
      <p className={styles.lead}>O endereço acessado não existe.</p>
      <Link to="/" className={styles.backLink}>
        Voltar para os filmes
      </Link>
    </section>
  )
}
