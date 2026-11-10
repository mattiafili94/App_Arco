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
  test('elenca chi ha l’accesso, tu in cima; la scheda apre le prove', async ({ page }) => {
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
    // La scheda: i pulsanti delle prove e "Tutte le gare".
    const prove = page.getByRole('navigation', { name: 'Prove' })
    await prove.getByRole('link', { name: '18 m · Ricurvo' }).click()
    await expect(page.getByRole('heading', { level: 1, name: '18 m · Ricurvo' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Record personale' })).toContainText('534')
    // Andamento: tutta la carriera dalla tendina degli anni (i due punteggi possono essere in anni diversi).
    const andamento = page.getByRole('region', { name: 'Andamento' })
    await andamento.locator('summary').first().click()
    await andamento.getByRole('checkbox', { name: 'Tutta la carriera' }).check()
    await andamento.getByRole('button', { name: /^520 punti/ }).click()
    await expect(andamento).toContainText('520 · Terni (TR)')
    await expect(page.getByRole('region', { name: 'Media per anno' })).toBeVisible()

    // Dal record si apre la gara, e la freccia torna alla prova.
    await page.getByRole('region', { name: 'Record personale' }).getByRole('link').click()
    await expect(page.getByText('Tipologia')).toBeVisible()
    await page.getByRole('link', { name: '18 m · Ricurvo' }).click()
    await expect(page.getByRole('heading', { level: 1, name: '18 m · Ricurvo' })).toBeVisible()

    // Tutte le gare, con la posizione.
    await page.getByRole('link', { name: 'Bruno Prova' }).first().click()
    await page.getByRole('link', { name: 'Tutte le gare' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Tutte le gare' })).toBeVisible()
    await expect(page.getByText('2° posto').first()).toBeVisible()
  })

  test('senza rete l’elenco e la scheda si vedono lo stesso', async ({ page, context }) => {
    await page.goto('/atleti')
    await expect(page.getByRole('link', { name: /Bruno Prova/ })).toBeVisible()
    await context.setOffline(true)
    await page.getByRole('link', { name: /Bruno Prova/ }).click()
    await page.getByRole('navigation', { name: 'Prove' }).getByRole('link').first().click()
    await expect(page.getByRole('region', { name: 'Record personale' })).toBeVisible()
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
        await expect(page.getByRole('navigation', { name: 'Prove' })).toBeVisible()
        await controllaAccessibilita(page)
        // La pagina della prova: grafico con la tendina degli anni aperta e la tabella aperta.
        await page.getByRole('navigation', { name: 'Prove' }).getByRole('link').first().click()
        const andamento = page.getByRole('region', { name: 'Andamento' })
        await andamento.locator('summary').first().click()
        await andamento.getByRole('checkbox', { name: 'Tutta la carriera' }).check()
        await expect(
          andamento.getByRole('group', { name: /^Andamento 18 m · Ricurvo/ }),
        ).toBeVisible()
        await andamento.getByText('Mostra come tabella').click()
        await controllaAccessibilita(page)
        await page.getByRole('link', { name: 'Bruno Prova' }).first().click()
        await page.getByRole('link', { name: 'Tutte le gare' }).click()
        await expect(page.getByRole('heading', { level: 1, name: 'Tutte le gare' })).toBeVisible()
        await controllaAccessibilita(page)
      })
    }
  })
})
