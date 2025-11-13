import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: 'https://test-flip.vercel.app/',
  plugins: [react()],
  publicDir: 'public',
  build: {
    assetsInlineLimit: 0,
  }
})
