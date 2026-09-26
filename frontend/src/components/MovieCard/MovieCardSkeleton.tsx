import styles from './MovieCard.module.css'

/** Marcador com o formato do card enquanto a lista carrega. */
export function MovieCardSkeleton() {
  return (
    <div className={styles.skeleton} data-testid="movie-card-skeleton" aria-hidden="true">
      <div className={styles.skeletonPoster} />
      <div className={styles.skeletonBody}>
        <div className={styles.skeletonLine} />
        <div className={styles.skeletonLine} />
        <div className={styles.skeletonLine} />
      </div>
    </div>
  )
}
