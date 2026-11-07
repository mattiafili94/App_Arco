import { defineConfig, devices } from '@playwright/test'

const suGitHub = Boolean(process.env.CI)

/**
 * Indirizzo da provare. Di base è la versione costruita sul PC (build + preview); con
 * E2E_BASE_URL si provano le versioni pubblicate su Cloudflare, per esempio:
 *   E2E_BASE_URL=https://arcieri-eugubini.pages.dev npm run test:e2e
 */
const indirizzoPubblicato = process.env.E2E_BASE_URL
const indirizzoLocale = 'http://localhost:4173'

/**
 * Test nel browser vero (Chromium) su schermo da telefono: percorsi, offline e accessibilità.
 *   npm run test:e2e
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: suGitHub,
  retries: suGitHub ? 1 : 0,
  reporter: suGitHub ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: indirizzoPubblicato ?? indirizzoLocale,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'telefono', use: { ...devices['Pixel 7'] } }],
  webServer: indirizzoPubblicato
    ? undefined
    : {
        command: 'npm run build && npm run preview -- --port 4173 --strictPort',
        url: indirizzoLocale,
        reuseExistingServer: !suGitHub,
        timeout: 120_000,
      },
})
