import { defineConfig } from 'vitest/config'

// Test automatici di tutto il monorepo: `npm test` (veloce) e `npm run test:coverage`
// (con la misura di quanto codice è coperto dai test, usata anche su GitHub).
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'logica',
          include: ['packages/*/src/**/*.test.ts', 'supabase/*.test.ts'],
          environment: 'node',
        },
      },
      './apps/web/vitest.config.ts',
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts', 'supabase/functions/_shared/**/*.ts'],
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
