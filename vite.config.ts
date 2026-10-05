import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { setupDevApiMiddleware } from './src/dev-mock'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    setupDevApiMiddleware()
  ],
  server: {
    port: 5173,
    host: true
  }
})
