import { Link, NavLink } from 'react-router-dom'
import styles from './Header.module.css'

interface NavItem {
  to: string
  label: string
  /** Só ativo na rota exata (evita "/" ativo em todas as páginas). */
  end?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Filmes', end: true },
  { to: '/filmes/novo', label: 'Adicionar filme' },
]

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return isActive ? `${styles.link} ${styles.active}` : styles.link
}

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to="/" className={styles.brand}>
          <svg className={styles.logo} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
          </svg>
          RocketLab Filmes
        </Link>
        <nav aria-label="Principal">
          <ul className={styles.nav}>
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className={navLinkClass}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}
