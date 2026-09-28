import { defineConfig, devices } from '@playwright/test'
import { API_ORIGIN, API_PORT, API_URL, WEB_PORT, WEB_URL } from './e2e/support/env.ts'

const isCI = Boolean(process.env.CI)
// Padrão: Chrome instalado na máquina. Em CI (ou após `npx playwright install chromium`),
// use PW_CHANNEL=chromium para o navegador que acompanha o Playwright.
const channel = process.env.PW_CHANNEL ?? 'chrome'
const SCREENSHOTS_SPEC = /screenshots\.spec\.ts$/
const portsEnv ={ E2E_API_PORT: String(API_PORT), E2E_WEB_PORT: String(WEB_PORT) }

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // SQLite aceita um escritor por vez: poucos workers evitam "database is locked".
  workers: isCI ? 1 : 2,
  reporter: [[isCI ? 'github' : 'list'], ['html', { open: 'never' }]],
  use: {
    baseURL: WEB_URL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel },
      testIgnore: SCREENSHOTS_SPEC,
    },
    // Só via `npm run screenshots`: grava as capturas da documentação em docs/images/.
    {
      name: 'screenshots',
      use: { ...devices['Desktop Chrome'], channel },
      testMatch: SCREENSHOTS_SPEC,
    },
  ],
  webServer: [
    {
      command: 'node e2e/start-backend.mjs',
      url: `${API_ORIGIN}/health`,
      env: portsEnv,
      // Sempre um banco novo: nunca reaproveita uma API rodando com outros dados.
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npm run dev -- --port ${WEB_PORT} --strictPort`,
      url: WEB_URL,
      env: { ...portsEnv, VITE_API_URL: API_URL },
      // Um Vite já aberto nessa porta poderia apontar para outra API.
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
