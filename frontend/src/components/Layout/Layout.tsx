import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import styles from './Layout.module.css'

const MAIN_ID = 'conteudo'

/** Estrutura comum das páginas: cabeçalho, conteúdo da rota e rodapé. */
export function Layout() {
  const mainRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  const previousPathname = useRef(pathname)

  // Nova página: o foco vai para o conteúdo, senão fica no link clicado (que sumiu) e o
  // leitor de tela não anuncia a troca. Só o caminho conta: filtros na query string
  // (busca do catálogo) não podem tirar o foco do campo em que se digita.
  useEffect(() => {
    if (previousPathname.current !== pathname) {
      previousPathname.current = pathname
      mainRef.current?.focus()
    }
  }, [pathname])

  return (
    <div className={styles.shell}>
      {/* Primeiro item do Tab: permite pular o cabeçalho e ir direto ao conteúdo. */}
      <a href={`#${MAIN_ID}`} className={styles.skipLink}>
        Pular para o conteúdo
      </a>
      <Header />
      <main ref={mainRef} id={MAIN_ID} tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <p>RocketLab Filmes · Visagio Rocket Lab 2026</p>
      </footer>
    </div>
  )
}
