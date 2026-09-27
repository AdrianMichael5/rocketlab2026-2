import { useState } from 'react'
import { POSTER_PLACEHOLDER } from '../../components/MovieCard/poster'
import styles from './MovieForm.module.css'
import { isHttpUrl } from './movieFormModel'

// Proporção do pôster w500 do TMDB (2:3).
const POSTER_WIDTH = 500
const POSTER_HEIGHT = 750

interface PosterPreviewProps {
  url: string
}

/** Prévia da URL do pôster; pôster padrão enquanto a URL não é válida ou não carrega. */
export function PosterPreview({ url }: PosterPreviewProps) {
  const candidate = url.trim()
  // Guarda qual URL falhou: ao digitar outra, a nova é tentada automaticamente.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const canShow = isHttpUrl(candidate) && candidate !== failedUrl
  const failed = candidate !== '' && candidate === failedUrl

  return (
    <figure className={styles.preview}>
      <img
        className={styles.previewImage}
        src={canShow ? candidate : POSTER_PLACEHOLDER}
        alt="Prévia do pôster"
        width={POSTER_WIDTH}
        height={POSTER_HEIGHT}
        onError={() => {
          if (canShow) {
            setFailedUrl(candidate)
          }
        }}
      />
      {failed && (
        <figcaption className={styles.previewNote}>Não foi possível carregar a imagem.</figcaption>
      )}
    </figure>
  )
}
