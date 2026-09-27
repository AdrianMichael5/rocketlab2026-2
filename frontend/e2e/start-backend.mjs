// Sobe a API para os testes E2E com um banco SQLite descartável (backend/e2e.db).
// O schema vem do Alembic, como em produção; o banco de desenvolvimento não é tocado.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const backendDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'backend')
const DB_FILE = 'e2e.db'
const port = process.env.E2E_API_PORT ?? '8001'
const webOrigin = `http://localhost:${process.env.E2E_WEB_PORT ?? '5174'}`

function defaultPython() {
  const venvPython =
    process.platform === 'win32'
      ? join(backendDir, '.venv', 'Scripts', 'python.exe')
      : join(backendDir, '.venv', 'bin', 'python')
  return existsSync(venvPython) ? venvPython : 'python'
}

const python = process.env.E2E_PYTHON ?? defaultPython()
const env = {
  ...process.env,
  DATABASE_URL: `sqlite+aiosqlite:///./${DB_FILE}`,
  BACKEND_CORS_ORIGINS: JSON.stringify([webOrigin]),
  // Fora de "local" o engine não ecoa cada SQL no console.
  ENVIRONMENT: 'e2e',
  LOG_LEVEL: 'WARNING',
}

for (const suffix of ['', '-wal', '-shm', '-journal']) {
  rmSync(join(backendDir, DB_FILE + suffix), { force: true })
}

const migration = spawnSync(python, ['-m', 'alembic', 'upgrade', 'head'], {
  cwd: backendDir,
  env,
  stdio: 'inherit',
})
if (migration.status !== 0) {
  console.error('Falha ao aplicar as migrações do banco E2E.')
  process.exit(migration.status ?? 1)
}

const server = spawn(
  python,
  ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', port],
  { cwd: backendDir, env, stdio: 'inherit' },
)
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.kill(signal))
}
server.on('exit', (code) => process.exit(code ?? 0))
