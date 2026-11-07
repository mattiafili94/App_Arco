import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Test dei componenti: girano in un browser simulato (jsdom).
export default defineConfig({
  plugins: [react()],
  define: {
    __VERSIONE_APP__: JSON.stringify('0.0.0-test'),
  },
  resolve: {
    alias: {
      // Il modulo del "motore offline" esiste solo nella build: nei test usiamo una finta.
      'virtual:pwa-register/react': fileURLToPath(
        new URL('./src/test/pwa-register-finto.ts', import.meta.url),
      ),
    },
  },
  test: {
    name: 'web',
    root: import.meta.dirname,
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
})
