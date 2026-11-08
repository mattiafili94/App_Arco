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

test.describe('tab Classifica', () => {
  test('in primo piano la tua posizione; da lì si apre la classifica completa, partendo da te', async ({
    page,
  }) => {
    await page.goto('/classifica')
    const mia = page.getByRole('region', { name: 'La tua posizione' })
    const riga = mia.getByRole('link', { name: /Indoor · Ricurvo · Senior M/ })
    await expect(riga).toContainText('2°')
    await expect(riga).toContainText('1.198 punti')
    await expect(riga).toContainText('Terni (TR) 598 · Roma (RM) 600')

    await riga.click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Indoor · Ricurvo · Senior M' }),
    ).toBeVisible()
    await expect(page.getByText('60 atleti · letta da Fitarco')).toBeVisible()
    const classifica = page.getByRole('region', { name: 'Classifica' })
    await expect(classifica.getByText('2. Prova Bruno · Tu')).toBeVisible()
    await expect(classifica.getByText('Della compagnia:').first()).toBeAttached()
  })

  test('la ricerca per nome e il filtro Umbria', async ({ page }) => {
    await page.goto('/classifica/I/OL/S/M')
    await expect(page.getByText('Atleti da 1 a 50 su 60.')).toBeVisible()
    await page.getByLabel('Cerca per nome o società').fill('cognome7 ')
    await expect(page.getByText('Atleti da 1 a 1 su 1.')).toBeVisible()
    await page.getByLabel('Cerca per nome o società').fill('')
    await page.getByRole('radio', { name: 'Umbria' }).click()
    // 15 atleti dell'Umbria (un quarto) + Bruno.
    await expect(page.getByText('Atleti da 1 a 16 su 16.')).toBeVisible()
  })

  test('dal tab si cerca una classifica non scaricata: lo dice e propone di scaricarla', async ({
    page,
  }) => {
    await page.goto('/classifica')
    await page.getByLabel('Arco').selectOption('CO')
    await page.getByRole('button', { name: 'Mostra' }).click()
    await expect(page.getByText('Questa classifica non è ancora scaricata')).toBeVisible()
    // Il pulsante: la classifica è stata letta da poco, quindi il server rifiuta e dice quando riprovare.
    await page.getByRole('button', { name: 'Scarica da Fitarco' }).click()
    await expect(page.getByText(/ogni 6 ore\. Riprova/)).toBeVisible()
  })

  test('senza rete la classifica già aperta si vede lo stesso', async ({ page, context }) => {
    await page.goto('/classifica/I/OL/S/M')
    await expect(page.getByText('Atleti da 1 a 50 su 60.')).toBeVisible()
    await page.goto('/classifica')
    await expect(page.getByRole('link', { name: /Indoor · Ricurvo · Senior M/ })).toBeVisible()
    await context.setOffline(true)
    await page.getByRole('link', { name: /Indoor · Ricurvo · Senior M/ }).click()
    await expect(page.getByText(/Sei offline: vedi l’ultima copia/)).toBeVisible()
    await expect(page.getByText('Atleti da 1 a 50 su 60.')).toBeVisible()
  })

  test.describe('accessibilità', () => {
    test.use({ reducedMotion: 'reduce' })

    for (const { scelta, attributo } of TEMI) {
      test(`accessibilità di tab e classifica completa, tema ${scelta}`, async ({ page }) => {
        await conTema(page, scelta)
        await page.goto('/classifica')
        await expect(page.getByRole('link', { name: /Indoor · Ricurvo · Senior M/ })).toBeVisible()
        await expect(page.locator('html')).toHaveAttribute('data-theme', attributo)
        await controllaAccessibilita(page)

        await page.setViewportSize({ width: 390, height: 2600 })
        await page.getByRole('link', { name: /Indoor · Ricurvo · Senior M/ }).click()
        await expect(page.getByText('Atleti da 1 a 50 su 60.')).toBeVisible()
        await controllaAccessibilita(page)
      })
    }
  })
})
