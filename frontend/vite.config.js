import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Use './' (relative) only for Electron builds (file:// protocol).
// For web/Render deployment, use '/' so asset URLs are absolute.
// Run `npm run build:electron` for Electron; `npm run build` for web.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'electron' ? './' : '/',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
}))
