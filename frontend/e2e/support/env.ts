// Portas próprias dos testes E2E: não colidem com `npm run dev` (5173) nem com a API local (8000).
export const API_PORT = Number(process.env.E2E_API_PORT ?? 8001)
export const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 5174)

export const API_ORIGIN = `http://localhost:${API_PORT}`
export const API_URL = `${API_ORIGIN}/api/v1`
export const WEB_URL = `http://localhost:${WEB_PORT}`
