import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom não implementa rolagem; a página rola ao topo ao trocar de página.
window.scrollTo = () => {}

// jsdom não implementa showModal/close do <dialog>; simula o essencial (atributo open e evento close).
HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
  this.open = true
}
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  if (this.open) {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
}

// jsdom não implementa ResizeObserver, exigido pelo ResponsiveContainer do Recharts.
globalThis.ResizeObserver ??= class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

afterEach(() => {
  cleanup()
})
