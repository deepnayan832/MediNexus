import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const { VITE_API_URL = '' } = loadEnv(mode, process.cwd(), 'VITE_')
  const configuredApiUrl = VITE_API_URL.trim()
  if (mode === 'production' && configuredApiUrl) {
    let apiUrl: URL
    try {
      apiUrl = new URL(configuredApiUrl)
    } catch {
      throw new Error('VITE_API_URL must be a valid HTTPS URL in production.')
    }
    if (apiUrl.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(apiUrl.hostname)) {
      throw new Error('VITE_API_URL must use a public HTTPS API origin in production.')
    }
  }

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8787',
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('error', (_error, request, response) => {
              if (!('writeHead' in response) || response.headersSent) return
              response.writeHead(request.url === '/api/health' || request.url === '/api/auth/session' ? 200 : 503, { 'Content-Type': 'application/json' })
              response.end(request.url === '/api/auth/session' ? JSON.stringify({ user: null }) : JSON.stringify({ service: 'medinexus-api', status: 'offline', database: 'unavailable' }))
            })
          },
        },
      },
    },
  }
})

