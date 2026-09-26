import styles from './Page.module.css'

// Provisória: a listagem com busca, filtros e paginação vem na próxima tarefa.
export function MoviesPage() {
  return (
    <section className={styles.header}>
      <h1 className={styles.title}>Filmes</h1>
      <p className={styles.lead}>O catálogo de filmes aparecerá aqui.</p>
    </section>
  )
}
