import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom não implementa rolagem; a página rola ao topo ao trocar de página.
window.scrollTo = () => {}

afterEach(() => {
  cleanup()
})
