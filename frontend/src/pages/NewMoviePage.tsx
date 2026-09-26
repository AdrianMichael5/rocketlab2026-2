import styles from './Page.module.css'

// Provisória: o formulário de cadastro vem na tarefa de criação de filmes.
export function NewMoviePage() {
  return (
    <section className={styles.header}>
      <h1 className={styles.title}>Adicionar filme</h1>
      <p className={styles.lead}>O formulário de cadastro aparecerá aqui.</p>
    </section>
  )
}
