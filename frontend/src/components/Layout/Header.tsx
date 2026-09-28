import { Link, NavLink } from 'react-router-dom'
import styles from './Header.module.css'

interface NavItem {
  to: string
  label: string
  /** Só ativo na rota exata (evita "/" ativo em todas as páginas). */
  end?: boolean
  /** Ação principal, com visual de botão. */
  primary?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Filmes', end: true },
  { to: '/insights', label: 'Insights' },
  { to: '/filmes/novo', label: 'Novo filme', primary: true },
]

function navLinkClass(item: NavItem) {
  return ({ isActive }: { isActive: boolean }): string =>
    [item.primary ? styles.primary : styles.link, isActive && styles.active]
      .filter(Boolean)
      .join(' ')
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
                <NavLink to={item.to} end={item.end} className={navLinkClass(item)}>
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
