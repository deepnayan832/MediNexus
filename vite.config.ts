import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
          configure: (proxy) => {
            proxy.on('error', (_error, request, response) => {
            if (!('writeHead' in response)) return
            if (response.headersSent) return
            response.writeHead(request.url === '/api/health' || request.url === '/api/auth/session' ? 200 : 503, { 'Content-Type': 'application/json' })
            response.end(request.url === '/api/auth/session' ? JSON.stringify({ user: null }) : JSON.stringify({ service: 'medinexus-api', status: 'offline', database: 'unavailable' }))
          })
        },
      },
    },
  },
})
