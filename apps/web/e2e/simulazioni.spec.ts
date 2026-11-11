import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { conTema, TEMI } from './aiuti'
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

/** Trispot: l'anello della mancata arriva a 1,2 (5 anelli larghi 0,2), più 0,02 di bordo nel disegno. */
const MEZZO = 1.22

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
    await expect(page.getByRole('heading', { level: 1, name: '18 m' })).toBeVisible()

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

  test('il timer facoltativo segue la sequenza di gara: preparazione, tiro, ultimi 30 secondi, tempo scaduto', async ({
    page,
  }) => {
    await page.clock.install()
    await simulaSupabase(page)
    await iniziaSimulazione(page)
    const timer = page.getByRole('region', { name: 'Timer della volée' })
    await expect(timer).toHaveCount(0)

    await page.getByRole('button', { name: 'Avvia timer' }).click()
    await expect(timer).toHaveAttribute('data-fase', 'preparazione')
    await expect(page.getByRole('timer')).toHaveText('0:10')
    // I tasti restano utilizzabili mentre il timer corre.
    await tasto(page, '10').click()
    await expect(page.getByText(/Totale: 10 · 1 frecce su 60/)).toBeVisible()

    await page.clock.runFor(10_000)
    await expect(timer).toHaveAttribute('data-fase', 'tiro')
    await expect(page.getByRole('timer')).toHaveText('2:00')

    await page.clock.runFor(90_000)
    await expect(timer).toHaveAttribute('data-fase', 'ultimi30')
    await expect(timer).toContainText('Ultimi 30 secondi')

    await page.clock.runFor(30_000)
    await expect(timer).toHaveAttribute('data-fase', 'finito')
    await expect(timer).toContainText('Tempo scaduto')
    await page.getByRole('button', { name: 'Chiudi' }).click()
    await expect(page.getByRole('button', { name: 'Avvia timer' })).toBeVisible()
  })

  test('si segna toccando il bersaglio, con la lente; valore e posizione arrivano al server', async ({
    page,
  }) => {
    const { simulazioni } = await simulaSupabase(page)
    await iniziaSimulazione(page)
    await page.getByRole('radio', { name: 'Bersaglio' }).click()
    const bersaglio = page.getByRole('img', { name: /Bersaglio: tocca/ })
    await expect(bersaglio).toBeVisible()
    await bersaglio.scrollIntoViewIfNeeded()
    const r = (await bersaglio.boundingBox())!
    const punto = (x: number, y: number) => ({
      x: r.x + ((x + MEZZO) / (2 * MEZZO)) * r.width,
      y: r.y + ((y + MEZZO) / (2 * MEZZO)) * r.height,
    })

    // Tenendo premuto la lente mostra il valore, e si può trascinare; alzando il dito si segna.
    const vicino = punto(0.05, 0)
    await page.mouse.move(vicino.x, vicino.y)
    await page.mouse.down()
    await expect(page.getByRole('img', { name: "Lente d'ingrandimento" })).toBeVisible()
    await expect(page.locator('p', { hasText: /Valore: 10$/ })).toBeVisible()
    const lontano = punto(0.5, 0)
    await page.mouse.move(lontano.x, lontano.y, { steps: 4 })
    await expect(page.locator('p', { hasText: /Valore: 8$/ })).toBeVisible()
    await page.mouse.up()
    await expect(page.getByRole('img', { name: "Lente d'ingrandimento" })).toHaveCount(0)
    await expect(page.getByText(/Totale: 8 · 1 frecce su 60/)).toBeVisible()

    // Un tocco veloce al centro: 10.
    const centro = punto(0, 0)
    await page.mouse.click(centro.x, centro.y)
    await expect(page.getByText(/Totale: 18 · 2 frecce su 60/)).toBeVisible()

    // Un tocco nell'angolo in alto a sinistra, fuori dall'anello della mancata, non segna niente.
    // (In basso c'è la barra dei tab, che il tocco aprirebbe.)
    const angolo = punto(-1.21, -1.21)
    await page.mouse.click(angolo.x, angolo.y)
    await page.waitForTimeout(300)
    await expect(page.getByText(/Totale: 18 · 2 frecce su 60/)).toBeVisible()

    await expect
      .poll(() => (simulazioni[0] as { frecce?: string[] } | undefined)?.frecce?.join(','), {
        timeout: 15_000,
      })
      .toBe('8,10')
    const posizioni = (simulazioni[0] as { posizioni: number[][] }).posizioni
    expect(posizioni).toHaveLength(2)
    expect(posizioni[0]![0]).toBeCloseTo(0.5, 1)
    expect(posizioni[1]![0]).toBeCloseTo(0, 1)
  })

  test('la nota di una volée arriva al server', async ({ page }) => {
    const { simulazioni } = await simulaSupabase(page)
    await iniziaSimulazione(page)
    await tasto(page, '10').click()
    // La nota si scrive dall'elenco delle volée.
    const lista = page.getByRole('list', { name: 'Volée' })
    await lista.getByRole('button', { name: /Nota della volée 1:/ }).click()
    await lista.getByLabel('Nota della volée 1', { exact: true }).fill('vento da destra')
    await expect
      .poll(() => (simulazioni[0] as { note?: Record<string, string> } | undefined)?.note?.['0'], {
        timeout: 15_000,
      })
      .toBe('vento da destra')
  })

  test.describe('accessibilità', () => {
    test.use({ reducedMotion: 'reduce' })

    for (const { scelta, attributo } of TEMI) {
      test(`accessibilità del bersaglio da toccare, con la lente, tema ${scelta}`, async ({
        page,
      }) => {
        await simulaSupabase(page)
        await conTema(page, scelta)
        await iniziaSimulazione(page)
        await expect(page.locator('html')).toHaveAttribute('data-theme', attributo)
        await page.setViewportSize({ width: 390, height: 6000 })
        await page.getByRole('radio', { name: 'Bersaglio' }).click()
        const bersaglio = page.getByRole('img', { name: /Bersaglio: tocca/ })
        await expect(bersaglio).toBeVisible()
        const r = (await bersaglio.boundingBox())!
        const dove = (x: number, y: number) => ({
          x: r.x + ((x + MEZZO) / (2 * MEZZO)) * r.width,
          y: r.y + ((y + MEZZO) / (2 * MEZZO)) * r.height,
        })
        // Qualche freccia in zone diverse, poi la lente aperta (dito premuto).
        for (const [x, y] of [
          [0.05, 0],
          [0.3, 0.1],
          [-0.5, 0.2],
          [0.9, -0.3],
        ] as const) {
          const p = dove(x, y)
          await page.mouse.click(p.x, p.y)
        }
        await controllaAccessibilita(page)
        const p = dove(0.1, 0.1)
        await page.mouse.move(p.x, p.y)
        await page.mouse.down()
        await expect(page.getByRole('img', { name: "Lente d'ingrandimento" })).toBeVisible()
        await controllaAccessibilita(page)
        await page.mouse.up()
        // Il riepilogo con il bersaglio di sola lettura.
        await expect(
          page.getByRole('region', { name: 'Dove sono arrivate le frecce' }),
        ).toBeVisible()
        await controllaAccessibilita(page)
      })

      test(`accessibilità del timer in ogni fase, tema ${scelta}`, async ({ page }) => {
        await page.clock.install()
        await simulaSupabase(page)
        await conTema(page, scelta)
        await iniziaSimulazione(page)
        await expect(page.locator('html')).toHaveAttribute('data-theme', attributo)
        await page.setViewportSize({ width: 390, height: 1500 })
        await page.getByRole('button', { name: 'Avvia timer' }).click()
        const timer = page.getByRole('region', { name: 'Timer della volée' })
        // Rosso (preparazione), verde (tiro), giallo (ultimi 30 secondi), rosso (tempo scaduto).
        for (const [attesa, fase] of [
          [0, 'preparazione'],
          [10_000, 'tiro'],
          [90_000, 'ultimi30'],
          [30_000, 'finito'],
        ] as const) {
          if (attesa > 0) await page.clock.runFor(attesa)
          await expect(timer).toHaveAttribute('data-fase', fase)
          await controllaAccessibilita(page)
        }
      })
    }
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
        await page.setViewportSize({ width: 390, height: 3000 })
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
