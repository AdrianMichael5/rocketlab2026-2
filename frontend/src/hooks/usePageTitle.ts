import { useEffect } from 'react'

export const APP_NAME = 'RocketLab Filmes'

/**
 * Título da aba por página ("Alien · RocketLab Filmes"): identifica a página no
 * histórico, nas abas e para leitores de tela. `null` enquanto ainda não se sabe.
 */
export function usePageTitle(title: string | null): void {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME
  }, [title])
}
