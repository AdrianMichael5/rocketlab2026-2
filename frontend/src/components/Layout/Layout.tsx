import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import styles from './Layout.module.css'

const MAIN_ID = 'conteudo'

/** Estrutura comum das páginas: cabeçalho, conteúdo da rota e rodapé. */
export function Layout() {
  return (
    <div className={styles.shell}>
      {/* Primeiro item do Tab: permite pular o cabeçalho e ir direto ao conteúdo. */}
      <a href={`#${MAIN_ID}`} className={styles.skipLink}>
        Pular para o conteúdo
      </a>
      <Header />
      <main id={MAIN_ID} tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <p>RocketLab Filmes · Visagio Rocket Lab 2026</p>
      </footer>
    </div>
  )
}
