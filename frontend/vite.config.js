import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'https://web-cz9z.onrender.com',
        changeOrigin: true,
        secure: true,
      },
      '/ws': {
        target: 'wss://web-cz9z.onrender.com',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
