import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/MediNexus/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/three')) {
            return 'three'
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react'
          }
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_error, request, response) => {
            if (!('writeHead' in response)) return
            if (response.headersSent) return
            response.writeHead(
              request.url === '/api/health' || request.url === '/api/auth/session' ? 200 : 503,
              { 'Content-Type': 'application/json' },
            )
            response.end(
              request.url === '/api/auth/session'
                ? JSON.stringify({ user: null })
                : JSON.stringify({
                    service: 'medinexus-api',
                    status: 'offline',
                    database: 'unavailable',
                  }),
            )
          })
        },
      },
    },
  },
})
