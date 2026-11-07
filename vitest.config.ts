import { defineConfig } from 'vitest/config'

// Test automatici di tutto il monorepo: `npm test` (veloce) e `npm run test:coverage`
// (con la misura di quanto codice è coperto dai test, usata anche su GitHub).
export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['packages/shared/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts'],
      reporter: ['text', 'html'],
      // Regola di CLAUDE.md: la logica condivisa deve essere coperta almeno al 90%.
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
})
