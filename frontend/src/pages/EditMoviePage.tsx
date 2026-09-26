import { Link, useParams } from 'react-router-dom'
import styles from './Page.module.css'

// Provisória: o formulário de edição vem na tarefa de criação/edição de filmes.
export function EditMoviePage() {
  const { skMovieId = '' } = useParams()
  return (
    <section className={styles.header}>
      <h1 className={styles.title}>Editar filme</h1>
      <p className={styles.lead}>O formulário de edição aparecerá aqui.</p>
      <Link to={`/filmes/${encodeURIComponent(skMovieId)}`} className={styles.backLink}>
        Voltar para o filme
      </Link>
    </section>
  )
}
