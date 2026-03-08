import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      proxy: {
        '/api/mail': { target: 'http://localhost:8099', changeOrigin: true },
        '/api/backup': { target: 'http://localhost:8099', changeOrigin: true },
        '/api/state': { target: 'http://localhost:8099', changeOrigin: true },
        '/api/briefing': { target: 'http://localhost:8099', changeOrigin: true },
        '/api/photos': { target: 'http://localhost:8099', changeOrigin: true },
        ...(env.VITE_HA_URL ? {
          '/api': {
            target: env.VITE_HA_URL,
            changeOrigin: true,
          }
        } : {})
      },
    },
  }
})
