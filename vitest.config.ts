import { defineConfig } from 'vitest/config'

// Test automatici di tutto il monorepo: `npm test`
export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.{ts,tsx}'],
  },
})
