import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { conTema, TEMI } from './aiuti'
import { simulaSupabase } from './supabase-finto'

test.beforeEach(async ({ page }) => {
  await simulaSupabase(page)
})

async function controllaAccessibilita(page: Page) {
  const risultato = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(risultato.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
}

test.describe('tab Atleti', () => {
  test('elenca chi ha l’accesso, tu in cima; la scheda mostra record e storico', async ({
    page,
  }) => {
    await page.goto('/atleti')
    const elenco = page.getByRole('region', { name: 'Compagnia' })
    const righe = elenco.getByRole('link')
    // Carla non ha ancora il link: non compare.
    await expect(righe).toHaveCount(2)
    await expect(righe.first()).toContainText('Bruno Prova')
    await expect(righe.first()).toContainText('Tu')
    await expect(righe.first()).toContainText('Ricurvo · ultima gara')
    await expect(page.getByText('Carla Esempio')).toHaveCount(0)

    await righe.first().click()
    await expect(page.getByRole('heading', { level: 1, name: 'Bruno Prova' })).toBeVisible()
    const record = page.getByRole('region', { name: 'Record personali' })
    await expect(record.getByRole('link')).toContainText('18 m · Ricurvo')
    await expect(record.getByRole('link')).toContainText('534')
    const storico = page.getByRole('region', { name: 'Storico gare' })
    await expect(storico.getByRole('link')).toContainText('2° posto')

    // Dallo storico si apre la gara.
    await storico.getByRole('link').click()
    await expect(page.getByText('Tipologia')).toBeVisible()
  })

  test('senza rete l’elenco e la scheda si vedono lo stesso', async ({ page, context }) => {
    await page.goto('/atleti')
    await expect(page.getByRole('link', { name: /Bruno Prova/ })).toBeVisible()
    await context.setOffline(true)
    await page.getByRole('link', { name: /Bruno Prova/ }).click()
    await expect(page.getByRole('region', { name: 'Record personali' })).toBeVisible()
  })

  test.describe('accessibilità', () => {
    test.use({ reducedMotion: 'reduce' })

    for (const { scelta, attributo } of TEMI) {
      test(`accessibilità di elenco e scheda, tema ${scelta}`, async ({ page }) => {
        await conTema(page, scelta)
        await page.goto('/atleti')
        await expect(page.getByRole('link', { name: /Bruno Prova/ })).toBeVisible()
        await expect(page.locator('html')).toHaveAttribute('data-theme', attributo)
        await controllaAccessibilita(page)

        await page.setViewportSize({ width: 390, height: 1800 })
        await page.getByRole('link', { name: /Bruno Prova/ }).click()
        await expect(
          page.getByRole('region', { name: 'Record personali' }).getByRole('link'),
        ).toBeVisible()
        await controllaAccessibilita(page)
      })
    }
  })
})
