import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { conTema, scorreInOrizzontale, TEMI } from './aiuti'
import {
  AMMINISTRATORE_PROVA,
  ATLETA_PROVA,
  SENZA_ACCESSO_PROVA,
  simulaSupabase,
} from './supabase-finto'

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

/** Bruno, collegato, è allenatore. */
const BRUNO_ALLENATORE = { ...ATLETA_PROVA, allenatore: true }

test.describe('ruolo allenatore', () => {
  test('sceglie un atleta in Impostazioni, lo trova nel suo tab e gli scrive il programma', async ({
    page,
  }) => {
    const { richiesteFunzione, allenamento } = await simulaSupabase(page, {
      collegato: BRUNO_ALLENATORE,
    })
    await page.goto('/impostazioni')
    const sezione = page.getByRole('region', { name: 'Atleti che segui' })
    await sezione.getByRole('checkbox', { name: 'Anna Prova' }).check()
    await expect
      .poll(() => richiesteFunzione)
      .toContainEqual({ azione: 'segui', p_atleta: AMMINISTRATORE_PROVA.id, p_segui: true })

    // Il quinto tab.
    await page
      .getByRole('navigation', { name: 'Navigazione principale' })
      .getByRole('link', { name: /I miei atleti/ })
      .click()
    await page
      .getByRole('region', { name: 'Atleti che segui' })
      .getByRole('link', { name: 'Anna Prova' })
      .click()
    await expect(page.getByRole('heading', { level: 1, name: 'Anna Prova' })).toBeVisible()

    // Un giorno: l'allenatore scrive il programma.
    await page
      .getByRole('region', { name: 'Giorni' })
      .getByRole('link', { name: /· Oggi/ })
      .click()
    await page.getByLabel('Programma').fill('Tecnica: 90 frecce a 18 m')
    await expect(page.getByText('Programma scritto da te.')).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'Fatto' })).toHaveCount(0)
    await expect
      .poll(
        () => allenamento.find((r) => r.atleta_id === AMMINISTRATORE_PROVA.id)?.programma ?? null,
        { timeout: 15_000 },
      )
      .toBe('Tecnica: 90 frecce a 18 m')
  })

  test('cinque tab: a 320 px la pagina non scorre in orizzontale', async ({ page }) => {
    await simulaSupabase(page, { collegato: BRUNO_ALLENATORE })
    await page.setViewportSize({ width: 320, height: 700 })
    await page.goto('/gare')
    await expect(
      page.getByRole('navigation', { name: 'Navigazione principale' }).getByRole('link'),
    ).toHaveCount(5)
    expect(await scorreInOrizzontale(page)).toBe(false)
  })

  test('chi non è allenatore ha i soliti quattro tab', async ({ page }) => {
    await simulaSupabase(page)
    await page.goto('/gare')
    await expect(
      page.getByRole('navigation', { name: 'Navigazione principale' }).getByRole('link'),
    ).toHaveCount(4)
  })

  test('l’amministratore dà il ruolo di allenatore', async ({ page }) => {
    const { richiesteFunzione } = await simulaSupabase(page, { collegato: AMMINISTRATORE_PROVA })
    await page.goto(`/amministrazione/atleti/${SENZA_ACCESSO_PROVA.id}`)
    await page.getByRole('checkbox', { name: /Allenatore/ }).check()
    await expect
      .poll(() => richiesteFunzione)
      .toContainEqual({ azione: 'ruolo', id: SENZA_ACCESSO_PROVA.id, allenatore: true })
    await expect(page.getByText('Carla ora è anche allenatore.')).toBeVisible()
  })

  test.describe('accessibilità', () => {
    test.use({ reducedMotion: 'reduce' })

    for (const { scelta, attributo } of TEMI) {
      test(`tab "I miei atleti", settimana e giorno dell’atleta, tema ${scelta}`, async ({
        page,
      }) => {
        await simulaSupabase(page, {
          collegato: BRUNO_ALLENATORE,
          segue: [AMMINISTRATORE_PROVA.id],
        })
        await conTema(page, scelta)
        await page.setViewportSize({ width: 390, height: 2000 })
        await page.goto('/allenatore')
        await expect(page.locator('html')).toHaveAttribute('data-theme', attributo)
        await expect(page.getByRole('link', { name: 'Anna Prova' })).toBeVisible()
        await controllaAccessibilita(page)

        await page.getByRole('link', { name: 'Anna Prova' }).click()
        await page.getByRole('button', { name: 'Copia il programma su…' }).isVisible()
        await expect(page.getByRole('region', { name: 'Giorni' })).toBeVisible()
        await controllaAccessibilita(page)

        await page
          .getByRole('region', { name: 'Giorni' })
          .getByRole('link', { name: /· Oggi/ })
          .click()
        await expect(page.getByLabel('Programma')).toBeVisible()
        await controllaAccessibilita(page)

        await page.goto('/impostazioni')
        await expect(page.getByRole('region', { name: 'Atleti che segui' })).toBeVisible()
        await controllaAccessibilita(page)
      })
    }
  })
})
