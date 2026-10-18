import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env['CI'] || process.env['GH_PAGES'] ? '/guandan/' : '/',
  plugins: [react(), tailwindcss()],
})
