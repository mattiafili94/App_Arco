import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Test dei componenti: girano in un browser simulato (jsdom).
export default defineConfig({
  plugins: [react()],
  test: {
    name: 'web',
    root: import.meta.dirname,
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
})
