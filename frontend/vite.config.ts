import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // e2e/ roda no Playwright (npm run test:e2e), não no Vitest.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    // Nomes de classe previsíveis nos testes (ex.: "filled") em vez de hashes.
    css: { modules: { classNameStrategy: 'non-scoped' } },
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
  },
})
