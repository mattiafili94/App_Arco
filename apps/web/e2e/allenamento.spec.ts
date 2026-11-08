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

const oggi = () => {
  const d = new Date()
  const due = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`
}

test.describe('tab Allenamento', () => {
  test('si scrive un giorno: resta sul telefono, arriva al server e compare nella settimana', async ({
    page,
  }) => {
    const { allenamento } = await simulaSupabase(page)
    await page.goto('/allenamento')
    const giorni = page.getByRole('region', { name: 'Giorni' })
    await expect(giorni.getByRole('link')).toHaveCount(7)
    await giorni.getByRole('link', { name: /· Oggi/ }).click()

    await page.getByLabel('Cosa devo fare').fill('100 frecce a 70 m')
    await page.getByLabel('Fatto').check()
    await page.getByLabel('Frecce tirate').fill('100')
    await page.getByLabel('Note').fill('bene la trazione')

    // Dopo un attimo l'allenamento arriva al server, che lo conferma.
    await expect(page.getByText('Salvato.')).toBeVisible({ timeout: 10_000 })
    expect(allenamento).toHaveLength(1)
    expect(allenamento[0]).toMatchObject({
      giorno: oggi(),
      programma: '100 frecce a 70 m',
      fatto: true,
      frecce_libere: 100,
      nota: 'bene la trazione',
    })

    // Nella settimana: il giorno ha le frecce e il riepilogo le somma.
    await page.getByRole('link', { name: 'Allenamento' }).first().click()
    const riga = page.getByRole('region', { name: 'Giorni' }).getByRole('link', { name: /· Oggi/ })
    await expect(riga).toContainText('100 frecce')
    await expect(riga).toContainText('Fatto · 100 frecce a 70 m')
    await expect(page.getByRole('region', { name: 'Riepilogo della settimana' })).toContainText(
      'libere 100',
    )

    // Ricaricando la pagina c'è ancora tutto (copia sul telefono).
    await page.reload()
    await expect(
      page.getByRole('region', { name: 'Giorni' }).getByRole('link', { name: /· Oggi/ }),
    ).toContainText('100 frecce')
  })

  test('senza rete si scrive lo stesso; al ritorno della rete le modifiche partono', async ({
    page,
    context,
  }) => {
    const { allenamento } = await simulaSupabase(page)
    await page.goto('/allenamento')
    await page
      .getByRole('region', { name: 'Giorni' })
      .getByRole('link', { name: /· Oggi/ })
      .click()
    await expect(page.getByLabel('Cosa devo fare')).toBeVisible()

    await context.setOffline(true)
    await page.getByLabel('Cosa devo fare').fill('tiro a casa')
    await expect(
      page.getByText('Salvato sul telefono. Si invia al server appena c’è la rete.'),
    ).toBeVisible()
    expect(allenamento).toHaveLength(0)

    await context.setOffline(false)
    await expect.poll(() => allenamento.length, { timeout: 15_000 }).toBe(1)
    expect(allenamento[0]!.programma).toBe('tiro a casa')
    await expect(page.getByText('Salvato.')).toBeVisible({ timeout: 10_000 })
  })

  test('"Copia la settimana scorsa" porta i programmi in questa settimana', async ({ page }) => {
    const { allenamento } = await simulaSupabase(page)
    // Un programma nella settimana scorsa (7 giorni fa).
    const ieriSettimana = new Date()
    ieriSettimana.setDate(ieriSettimana.getDate() - 7)
    const due = (n: number) => String(n).padStart(2, '0')
    const giornoScorso = `${ieriSettimana.getFullYear()}-${due(ieriSettimana.getMonth() + 1)}-${due(ieriSettimana.getDate())}`
    allenamento.push({
      atleta_id: '10000000-0000-0000-0000-00000000000b',
      giorno: giornoScorso,
      programma: 'lavoro sul trispot',
      fatto: false,
      frecce_libere: 0,
      nota: '',
      modificato_il: '2026-01-01T10:00:00.000Z',
      aggiornato_il: '2026-01-01T10:00:00+00:00',
    })
    await page.goto('/allenamento')
    await page.getByRole('button', { name: 'Copia la settimana scorsa' }).click()
    await expect(page.getByText('Copiato 1 programma.')).toBeVisible()
    await expect(
      page.getByRole('region', { name: 'Giorni' }).getByText('lavoro sul trispot'),
    ).toBeVisible()
  })

  test.describe('accessibilità', () => {
    test.use({ reducedMotion: 'reduce' })

    for (const { scelta, attributo } of TEMI) {
      test(`accessibilità di settimana e giorno, tema ${scelta}`, async ({ page }) => {
        await simulaSupabase(page)
        await conTema(page, scelta)
        await page.goto('/allenamento')
        await expect(page.getByRole('region', { name: 'Giorni' }).getByRole('link')).toHaveCount(7)
        await expect(page.locator('html')).toHaveAttribute('data-theme', attributo)
        await controllaAccessibilita(page)

        await page.setViewportSize({ width: 390, height: 1400 })
        await page
          .getByRole('region', { name: 'Giorni' })
          .getByRole('link', { name: /· Oggi/ })
          .click()
        await expect(page.getByLabel('Cosa devo fare')).toBeVisible()
        await page.getByLabel('Frecce tirate').fill('abc')
        await expect(page.getByText('Scrivi un numero da 0 a 9999.')).toBeVisible()
        await controllaAccessibilita(page)
      })
    }
  })
})
