import { defineConfig, devices } from '@playwright/test'

const suGitHub = Boolean(process.env.CI)

/**
 * Test nel browser vero (Chromium) su schermo da telefono: percorsi, offline e accessibilità.
 * Usano la versione costruita dell'app (build + preview), come quella pubblicata.
 *   npm run test:e2e
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: suGitHub,
  retries: suGitHub ? 1 : 0,
  reporter: suGitHub ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'telefono', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !suGitHub,
    timeout: 120_000,
  },
})
