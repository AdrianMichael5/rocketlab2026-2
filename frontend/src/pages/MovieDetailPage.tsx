import { Link } from 'react-router-dom'
import styles from './Page.module.css'

// Provisória: destino dos cards do catálogo; o detalhe completo vem na tarefa de detalhe.
export function MovieDetailPage() {
  return (
    <section className={styles.header}>
      <h1 className={styles.title}>Detalhes do filme</h1>
      <p className={styles.lead}>Os detalhes deste filme aparecerão aqui.</p>
      <Link to="/" className={styles.backLink}>
        Voltar para os filmes
      </Link>
    </section>
  )
}
