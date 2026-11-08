import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { conTema, scorreInOrizzontale, TEMI } from './aiuti'
import { simulaSupabase } from './supabase-finto'

async function controllaAccessibilita(page: Page) {
  // Aspetta che finiscano le transizioni dei pulsanti (un pulsante appena abilitato è ancora semitrasparente).
  await page.waitForTimeout(500)
  const risultato = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(
    risultato.violations.map(
      (v) => `${v.id}: ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
    ),
  ).toEqual([])
}

const tasto = (page: Page, valore: string) =>
  page
    .getByRole('group', { name: 'Valore della freccia' })
    .getByRole('button', { name: valore, exact: true })

/** Dal tab Allenamento: oggi → nuova simulazione della gara scelta → pronto a segnare. */
async function iniziaSimulazione(page: Page, gara: string) {
  await page.goto('/allenamento')
  await page
    .getByRole('region', { name: 'Giorni' })
    .getByRole('link', { name: /· Oggi/ })
    .click()
  await page.getByRole('button', { name: 'Nuova simulazione' }).click()
  await page.getByLabel('Gara', { exact: true }).selectOption(gara)
  await page.getByRole('button', { name: 'Inizia' }).click()
  await expect(page.getByRole('group', { name: 'Valore della freccia' })).toBeVisible()
}

test.describe('campagna e 3D', () => {
  test('3D: si segna per piazzola, niente timer, i totali tornano e arrivano al server', async ({
    page,
  }) => {
    const { simulazioni } = await simulaSupabase(page)
    await iniziaSimulazione(page, '3d')
    await expect(page.getByRole('heading', { level: 1, name: '3D' })).toBeVisible()
    await expect(page.getByText('Piazzola 1 di 24')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Avvia timer' })).toHaveCount(0)
    await expect(page.getByRole('radiogroup', { name: 'Come segni le frecce' })).toHaveCount(0)

    for (const v of ['11', '10', '8']) await tasto(page, v).click()
    await expect(page.getByText('Piazzola 2 di 24')).toBeVisible()
    await expect(
      page.getByText('Piazzola: 0 · Piazzola precedente: 29 · Totale: 29 · 3 frecce su 72'),
    ).toBeVisible()

    // L'8 era un 5.
    await page
      .getByRole('button', { name: 'Freccia 3 della piazzola 1: 8. Tocca per correggere.' })
      .first()
      .click()
    await tasto(page, '5').click()
    const riepilogo = page.getByRole('region', { name: 'Riepilogo' })
    await expect(riepilogo).toContainText('26')
    await expect(riepilogo).toContainText('11 e 10')
    await expect(riepilogo).toContainText('1 · 1')

    await expect.poll(() => simulazioni.length, { timeout: 15_000 }).toBe(1)
    await expect
      .poll(() => (simulazioni[0] as { frecce: string[] }).frecce.join(','), { timeout: 15_000 })
      .toBe('11,10,5')
    expect(simulazioni[0]).toMatchObject({
      formato: '3d',
      bersaglio: '3d',
      distanza: null,
      eliminata: false,
    })
  })

  test('campagna 24+24: 48 piazzole, valori da 6 a 1, conteggi 6 e 5', async ({ page }) => {
    const { simulazioni } = await simulaSupabase(page)
    await iniziaSimulazione(page, '24+24')
    await expect(page.getByRole('heading', { level: 1, name: 'Campagna 24+24' })).toBeVisible()
    await expect(page.getByText('Piazzola 1 di 48')).toBeVisible()
    await expect(
      page.getByRole('group', { name: 'Valore della freccia' }).getByRole('button'),
    ).toHaveText(['6', '5', '4', '3', '2', '1', 'M'])

    for (const v of ['6', '6', '5', '4', 'M', '5']) await tasto(page, v).click()
    const riepilogo = page.getByRole('region', { name: 'Riepilogo' })
    await expect(riepilogo).toContainText('26')
    await expect(riepilogo).toContainText('6 e 5')
    await expect(riepilogo).toContainText('2 · 2')
    await expect(page.getByText(/6 frecce su 144/)).toBeVisible()

    await expect.poll(() => simulazioni.length, { timeout: 15_000 }).toBe(1)
    expect(simulazioni[0]).toMatchObject({ formato: '24+24', bersaglio: 'campagna' })
  })

  test('la pagina non scorre in orizzontale', async ({ page }) => {
    await simulaSupabase(page)
    await iniziaSimulazione(page, '12+12')
    for (const v of ['6', '5', '4', 'M']) await tasto(page, v).click()
    expect(await scorreInOrizzontale(page)).toBe(false)
  })

  test.describe('accessibilità', () => {
    test.use({ reducedMotion: 'reduce' })

    for (const { scelta, attributo } of TEMI) {
      test(`scelta della gara e segnapunti di campagna e 3D, tema ${scelta}`, async ({ page }) => {
        await simulaSupabase(page)
        await conTema(page, scelta)
        await page.goto('/allenamento')
        await page
          .getByRole('region', { name: 'Giorni' })
          .getByRole('link', { name: /· Oggi/ })
          .click()
        await page.getByRole('button', { name: 'Nuova simulazione' }).click()
        await expect(page.locator('html')).toHaveAttribute('data-theme', attributo)
        await page.getByLabel('Gara', { exact: true }).selectOption('12+12')
        await controllaAccessibilita(page)
        await page.getByRole('button', { name: 'Inizia' }).click()
        await expect(page.getByRole('group', { name: 'Valore della freccia' })).toBeVisible()
        // Pagina alta: la barra dei tab non copre niente.
        await page.setViewportSize({ width: 390, height: 3000 })
        for (const v of ['6', '5', '4', '3', '2', '1', 'M']) await tasto(page, v).click()
        await controllaAccessibilita(page)
      })
    }
  })
})
