import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { aspettaMotoreOffline, conTema, TEMI } from './aiuti'
import { GARE_PROVA, simulaSupabase } from './supabase-finto'

test.beforeEach(async ({ page }) => {
  await simulaSupabase(page)
})

async function controllaAccessibilita(page: Page) {
  const risultato = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(risultato.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
}

test.describe('tab Gare', () => {
  test('elenca le gare prossime e passate con il loro stato', async ({ page }) => {
    await page.goto('/gare')
    const prossime = page.getByRole('region', { name: 'Prossime' })
    await expect(prossime.getByRole('link', { name: /Perugia/ })).toContainText(
      'Invito disponibile',
    )
    const passate = page.getByRole('region', { name: 'Passate' })
    await expect(passate.getByRole('link', { name: /Gubbio/ })).toContainText(
      'Risultati definitivi',
    )
  })

  test('dalla gara si apre la scheda con invito e "Aggiungi al calendario", e si torna indietro', async ({
    page,
  }) => {
    await page.goto('/gare')
    await page.getByRole('link', { name: /Perugia/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: '18 m' })).toBeVisible()
    await expect(page.getByText(/ISCRIZIONI dal 3 ottobre/)).toBeVisible()
    await expect(page.getByRole('link', { name: /societa@example.com/ })).toHaveAttribute(
      'href',
      'mailto:societa@example.com',
    )
    await expect(page.getByRole('link', { name: /Google Calendar/ })).toBeVisible()

    // Il file per il calendario del telefono si scarica davvero.
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: /Calendario del telefono/ }).click()
    const file = await download
    expect(file.suggestedFilename()).toBe('gara-R9900002.ics')

    await page.getByRole('main').getByRole('link', { name: /Gare/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Gare' })).toBeVisible()
  })

  test('senza rete le gare e gli inviti si vedono lo stesso', async ({ page, context }) => {
    await page.goto('/gare')
    await expect(page.getByRole('link', { name: /Perugia/ })).toBeVisible()
    await aspettaMotoreOffline(page)

    await context.setOffline(true)
    await page.reload()
    await page.getByRole('link', { name: /Perugia/ }).click()
    await expect(page.getByText(/ISCRIZIONI dal 3 ottobre/)).toBeVisible()
  })

  test('dal tab si aprono il calendario dell’anno e lo storico completo', async ({ page }) => {
    await page.goto('/gare')
    // L'anno della gara di Perugia (fra 30 giorni: a dicembre può essere già l'anno dopo).
    const anno = GARE_PROVA[1]!.dal.slice(0, 4)
    await page.getByRole('link', { name: `Calendario ${anno}` }).click()
    await expect(page.getByRole('heading', { level: 1, name: `Calendario ${anno}` })).toBeVisible()
    await expect(page.getByRole('link', { name: /Perugia/ })).toBeVisible()
    await page.getByRole('link', { name: 'Gare', exact: true }).first().click()
    await page.getByRole('link', { name: 'Storico completo' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Storico gare' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Gubbio/ })).toBeVisible()
  })

  test.describe('accessibilità', () => {
    // Senza animazione di ingresso: i colori si misurano a pagina ferma.
    test.use({ reducedMotion: 'reduce' })

    for (const { scelta, attributo } of TEMI) {
      test(`accessibilità di elenco e scheda gara, tema ${scelta}`, async ({ page }) => {
        await conTema(page, scelta)
        await page.goto('/gare')
        await expect(page.getByRole('link', { name: /Perugia/ })).toBeVisible()
        await expect(page.locator('html')).toHaveAttribute('data-theme', attributo)
        await controllaAccessibilita(page)

        // La scheda con l'invito è lunga: si guarda per intero, senza che la barra dei tab ne copra un pezzo.
        await page.setViewportSize({ width: 390, height: 1800 })
        await page.getByRole('link', { name: /Perugia/ }).click()
        await expect(page.getByText(/ISCRIZIONI dal 3 ottobre/)).toBeVisible()
        await controllaAccessibilita(page)
      })

      test(`accessibilità di calendario e storico, tema ${scelta}`, async ({ page }) => {
        await conTema(page, scelta)
        await page.setViewportSize({ width: 390, height: 1800 })
        await page.goto(`/gare/calendario/${GARE_PROVA[1]!.dal.slice(0, 4)}`)
        await expect(page.getByRole('link', { name: /Perugia/ })).toBeVisible()
        await expect(page.locator('html')).toHaveAttribute('data-theme', attributo)
        await controllaAccessibilita(page)
        await page.goto('/gare/storico')
        await expect(page.getByRole('link', { name: /Gubbio/ })).toBeVisible()
        await controllaAccessibilita(page)
      })
    }
  })
})

test.describe('risultati di una gara', () => {
  test('dalla scheda si apre la classifica: i nostri atleti, poi le categorie con i nostri evidenziati', async ({
    page,
  }) => {
    await page.goto('/gare')
    await page.getByRole('link', { name: /Gubbio/ }).click()
    await page
      .getByRole('main')
      .getByRole('link', { name: /Classifica/ })
      .click()

    const nostri = page.getByRole('region', { name: /I nostri atleti/ })
    await expect(nostri).toContainText('Prova Bruno')
    await expect(nostri).toContainText('534')

    await page.getByRole('link', { name: /Arco Ricurvo - Senior Maschile/ }).click()
    const classifica = page.getByRole('region', { name: 'Classifica' })
    await expect(classifica).toContainText('1° Verdi Luca')
    await expect(classifica).toContainText('2° Prova Bruno')
    await expect(classifica).toContainText('263 + 271')
    await expect(classifica).toContainText('10: 17 · 9: 25')
  })

  test.describe('accessibilità', () => {
    test.use({ reducedMotion: 'reduce' })

    for (const { scelta } of TEMI) {
      test(`classifica e categoria, tema ${scelta}`, async ({ page }) => {
        await conTema(page, scelta)
        await page.goto('/gare/R9900001/risultati')
        await expect(page.getByRole('region', { name: /I nostri atleti/ })).toBeVisible()
        await controllaAccessibilita(page)

        await page.goto('/gare/R9900001/risultati?categoria=Arco%20Ricurvo%20-%20Senior%20Maschile')
        await expect(page.getByRole('region', { name: 'Classifica' })).toBeVisible()
        await controllaAccessibilita(page)
      })
    }
  })
})
