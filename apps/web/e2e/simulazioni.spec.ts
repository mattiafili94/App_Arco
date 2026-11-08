import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { conTema, TEMI } from './aiuti'
import { simulaSupabase } from './supabase-finto'

async function controllaAccessibilita(page: Page) {
  const risultato = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(risultato.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
}

const tasto = (page: Page, valore: string) =>
  page
    .getByRole('group', { name: 'Valore della freccia' })
    .getByRole('button', { name: valore, exact: true })

/** Dal tab Allenamento: oggi → nuova simulazione di 18 m a trispot → pronto a segnare. */
async function iniziaSimulazione(page: Page) {
  await page.goto('/allenamento')
  await page
    .getByRole('region', { name: 'Giorni' })
    .getByRole('link', { name: /· Oggi/ })
    .click()
  await page.getByRole('button', { name: 'Nuova simulazione' }).click()
  await page.getByRole('radio', { name: 'Trispot' }).click()
  await page.getByRole('button', { name: 'Inizia' }).click()
  await expect(page.getByRole('group', { name: 'Valore della freccia' })).toBeVisible()
}

test.describe('segnapunti', () => {
  test('si tira una volée, si corregge una freccia, i totali tornano; arriva tutto al server', async ({
    page,
  }) => {
    const { simulazioni } = await simulaSupabase(page)
    await iniziaSimulazione(page)
    await expect(page.getByRole('heading', { level: 1, name: '18 m · Trispot' })).toBeVisible()

    await tasto(page, '10').click()
    await tasto(page, '9').click()
    await tasto(page, 'M').click()
    // Finita la volée: si passa alla successiva e resta il totale di quella appena tirata.
    await expect(page.getByText(/Volée 2 di 20/)).toBeVisible()
    await expect(
      page.getByText('Volée: 0 · Volée precedente: 19 · Totale: 19 · 3 frecce su 60'),
    ).toBeVisible()

    // La M era sbagliata: era un 8.
    await page
      .getByRole('button', { name: 'Freccia 3 della volée 1: M. Tocca per correggere.' })
      .first()
      .click()
    await expect(page.getByText(/Correggi la freccia 3/)).toBeVisible()
    await tasto(page, '8').click()
    await expect(page.getByText(/Totale: 27 · 3 frecce su 60/)).toBeVisible()
    const riepilogo = page.getByRole('region', { name: 'Riepilogo' })
    await expect(riepilogo).toContainText('27')
    await expect(riepilogo).toContainText('10 e 9')
    await expect(riepilogo).toContainText('1 · 1')

    // Dopo un attimo la simulazione è sul server, con le frecce giuste.
    await expect.poll(() => simulazioni.length, { timeout: 15_000 }).toBe(1)
    await expect
      .poll(() => (simulazioni[0] as { frecce: string[] }).frecce.join(','), { timeout: 15_000 })
      .toBe('10,9,8')
    expect(simulazioni[0]).toMatchObject({ formato: '18m', bersaglio: 'trispot', eliminata: false })

    // Tornando al giorno compare con il suo punteggio, e le frecce si sommano.
    await page
      .getByRole('link', { name: /Mercoledì|Giovedì|Venerdì|Sabato|Domenica|Lunedì|Martedì/ })
      .first()
      .click()
    const elenco = page.getByRole('region', { name: 'Simulazioni di gara' })
    await expect(elenco.getByRole('link')).toContainText('18 m · Trispot')
    await expect(elenco.getByRole('link')).toContainText('3 frecce di 60 · In corso')
    await expect(page.getByText('3 frecce in tutto')).toBeVisible()
  })

  test('senza rete si segna lo stesso; al ritorno della rete le frecce partono', async ({
    page,
    context,
  }) => {
    const { simulazioni } = await simulaSupabase(page)
    await iniziaSimulazione(page)
    await context.setOffline(true)
    await tasto(page, '10').click()
    await tasto(page, '10').click()
    await expect(page.getByText(/Totale: 20 · 2 frecce su 60/)).toBeVisible()
    await context.setOffline(false)
    await expect
      .poll(() => (simulazioni[0] as { frecce?: string[] } | undefined)?.frecce?.length, {
        timeout: 20_000,
      })
      .toBe(2)
  })

  test('outdoor: tastierino con la X e conteggi 10+X e X', async ({ page }) => {
    await simulaSupabase(page)
    await page.goto('/allenamento')
    await page
      .getByRole('region', { name: 'Giorni' })
      .getByRole('link', { name: /· Oggi/ })
      .click()
    await page.getByRole('button', { name: 'Nuova simulazione' }).click()
    await page.getByLabel('Gara', { exact: true }).selectOption('70m')
    await page.getByRole('button', { name: 'Inizia' }).click()
    await tasto(page, 'X').click()
    await tasto(page, '10').click()
    await tasto(page, 'X').click()
    const riepilogo = page.getByRole('region', { name: 'Riepilogo' })
    await expect(riepilogo).toContainText('10+X e X')
    await expect(riepilogo).toContainText('3 · 2')
    await expect(riepilogo).toContainText('30')
  })

  test.describe('accessibilità', () => {
    test.use({ reducedMotion: 'reduce' })

    for (const { scelta, attributo } of TEMI) {
      test(`accessibilità di scelta della gara e tastierino, tema ${scelta}`, async ({ page }) => {
        await simulaSupabase(page)
        await conTema(page, scelta)
        await page.goto('/allenamento')
        await page
          .getByRole('region', { name: 'Giorni' })
          .getByRole('link', { name: /· Oggi/ })
          .click()
        await expect(page.locator('html')).toHaveAttribute('data-theme', attributo)
        await page.setViewportSize({ width: 390, height: 1400 })
        await page.getByRole('button', { name: 'Nuova simulazione' }).click()
        await expect(page.getByLabel('Gara', { exact: true })).toBeVisible()
        await controllaAccessibilita(page)

        await page.getByRole('radio', { name: 'Trispot' }).click()
        await page.getByRole('button', { name: 'Inizia' }).click()
        await expect(page.getByRole('group', { name: 'Valore della freccia' })).toBeVisible()
        // Tutti i colori del bersaglio: oro, rosso, blu e la mancata.
        for (const v of ['10', '9', '8', '7', '6', 'M', '10']) await tasto(page, v).click()
        await page
          .getByRole('button', { name: 'Freccia 2 della volée 1: 9. Tocca per correggere.' })
          .first()
          .click()
        await controllaAccessibilita(page)
      })
    }
  })
})
