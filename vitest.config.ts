import path from 'node:path'
import process from 'node:process'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'src/uni_modules/**'],
  },
  resolve: {
    alias: {
      // 生成物 src/pages.json 为 JSONC(带注释),vite:json 无法解析,测试环境映射到合法 mock
      '@/pages.json': path.resolve(process.cwd(), 'src/test-mocks/pages.json'),
      '@': path.resolve(process.cwd(), 'src'),
      '@img': path.resolve(process.cwd(), 'src/static/images'),
    },
  },
})
