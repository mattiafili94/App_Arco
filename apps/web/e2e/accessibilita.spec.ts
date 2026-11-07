import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { conTema, PAGINE, scorreInOrizzontale, TEMI } from './aiuti'
import { simulaSupabase } from './supabase-finto'

// Ogni test parte con un atleta che ha già fatto l'accesso (Supabase simulato).
test.beforeEach(async ({ page }) => {
  await simulaSupabase(page)
})

// Animazioni ridotte: axe controlla i colori finali, non quelli a metà dissolvenza.
test.use({ reducedMotion: 'reduce' })

for (const tema of TEMI) {
  for (const pagina of PAGINE) {
    test(`accessibilità: ${pagina.titolo}, tema ${tema.scelta}`, async ({ page }) => {
      await conTema(page, tema.scelta)
      await page.goto(pagina.percorso)
      await expect(page.locator('html')).toHaveAttribute('data-theme', tema.attributo)
      await expect(page.getByRole('heading', { level: 1, name: pagina.titolo })).toBeVisible()

      const risultato = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()
      expect(risultato.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
    })
  }
}

test.describe('schermi piccoli e testo grande', () => {
  for (const pagina of PAGINE) {
    test(`${pagina.titolo}: niente scorrimento orizzontale a 320 px`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 })
      await page.goto(pagina.percorso)
      await expect(page.getByRole('heading', { level: 1, name: pagina.titolo })).toBeVisible()
      expect(await scorreInOrizzontale(page)).toBe(false)
    })

    test(`${pagina.titolo}: con il testo al 200% nulla esce dallo schermo`, async ({ page }) => {
      await page.goto(pagina.percorso)
      await page.addStyleTag({ content: 'html { font-size: 200%; }' })
      await expect(page.getByRole('heading', { level: 1, name: pagina.titolo })).toBeVisible()
      expect(await scorreInOrizzontale(page)).toBe(false)
    })
  }

  test('i tasti della barra sono abbastanza grandi per il dito (almeno 48 px)', async ({
    page,
  }) => {
    await page.goto('/gare')
    const tasti = page.getByRole('navigation', { name: 'Navigazione principale' }).getByRole('link')
    for (const tasto of await tasti.all()) {
      const misura = await tasto.boundingBox()
      expect(misura!.height).toBeGreaterThanOrEqual(48)
      expect(misura!.width).toBeGreaterThanOrEqual(48)
    }
  })
})
