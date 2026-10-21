/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env['CI'] || process.env['GH_PAGES'] ? '/guandan/' : '/',
  plugins: [react(), tailwindcss()],
  test: {
    // 400 局自动对局回归要跑十几秒，CI 机器更慢——给足超时，别让机器慢变成测试红
    testTimeout: 180_000,
    hookTimeout: 60_000,
  },
})
