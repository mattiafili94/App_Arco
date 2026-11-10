import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { conTema, scorreInOrizzontale, TEMI } from './aiuti'
import {
  AMMINISTRATORE_PROVA,
  CODICE_PROVA,
  SENZA_ACCESSO_PROVA,
  simulaSupabase,
} from './supabase-finto'

const titolo = (page: Page, nome: string) => page.getByRole('heading', { level: 1, name: nome })

async function controllaAccessibilita(page: Page) {
  const risultato = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(risultato.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
}

test.describe('senza accesso', () => {
  test.beforeEach(async ({ page }) => {
    await simulaSupabase(page, { collegato: null })
  })

  test('qualunque indirizzo mostra solo la pagina Accedi, senza i tab', async ({ page }) => {
    await page.goto('/classifica')
    await expect(titolo(page, 'Accedi')).toBeVisible()
    await expect(page.getByRole('navigation')).toHaveCount(0)
  })

  test('con un codice sbagliato lo dice; con quello giusto entra', async ({ page }) => {
    await page.goto('/gare')
    await page.getByLabel('Matricola').fill('900002')
    await page.getByLabel(/Codice personale/).fill('AAAAA-BBBBB')
    await page.getByRole('button', { name: 'Entra' }).click()
    await expect(page.getByRole('alert')).toContainText('Matricola o codice non corretti')

    await page.getByLabel(/Codice personale/).fill('k7pm3-xqr9a')
    await page.getByRole('button', { name: 'Entra' }).click()
    await expect(titolo(page, 'Gare')).toBeVisible()
  })

  test('dal link personale entra, toglie il codice dall indirizzo e spiega l installazione', async ({
    page,
  }) => {
    await page.goto(`/accesso#m=900002&c=${CODICE_PROVA}`)
    await expect(titolo(page, 'Benvenuto, Bruno')).toBeVisible()
    expect(new URL(page.url()).hash).toBe('')
    await expect(page.getByText('K7PM3-XQR9A')).toBeVisible()

    await page.getByRole('button', { name: 'Continua nel browser' }).click()
    await expect(titolo(page, 'Gare')).toBeVisible()
    // L'accesso resta dopo aver ricaricato la pagina.
    await page.reload()
    await expect(titolo(page, 'Gare')).toBeVisible()
  })

  test.describe('accessibilità della pagina Accedi', () => {
    test.use({ reducedMotion: 'reduce' })
    for (const tema of TEMI) {
      test(`tema ${tema.scelta}, anche a 320 px`, async ({ page }) => {
        await conTema(page, tema.scelta)
        await page.setViewportSize({ width: 320, height: 640 })
        await page.goto('/gare')
        await expect(titolo(page, 'Accedi')).toBeVisible()
        await controllaAccessibilita(page)
        expect(await scorreInOrizzontale(page)).toBe(false)
      })
    }
  })
})

test.describe('uscita', () => {
  test('Esci chiede conferma e riporta alla pagina Accedi', async ({ page }) => {
    await simulaSupabase(page)
    await page.goto('/impostazioni')
    await expect(page.getByText('Bruno Prova')).toBeVisible()
    await page.getByRole('button', { name: 'Esci', exact: true }).click()
    await page.getByRole('button', { name: 'Esci da questo telefono' }).click()
    await expect(titolo(page, 'Accedi')).toBeVisible()
  })
})

test.describe('amministrazione', () => {
  let richiesteFunzione: unknown[] = []
  test.beforeEach(async ({ page }) => {
    ;({ richiesteFunzione } = await simulaSupabase(page, { collegato: AMMINISTRATORE_PROVA }))
  })

  test('dalle Impostazioni si apre l elenco degli atleti', async ({ page }) => {
    await page.goto('/impostazioni')
    await page.getByRole('link', { name: 'Amministrazione' }).click()
    await expect(titolo(page, 'Amministrazione')).toBeVisible()
    await expect(page.getByRole('link', { name: /Esempio Carla/ })).toContainText('Senza accesso')
  })

  test('aggiunge un atleta, genera il suo link e poi lo revoca', async ({ page }) => {
    await page.goto('/amministrazione')
    await page.getByLabel('Matricola').fill('900004')
    await page.getByLabel('Nome', { exact: true }).fill('Dario')
    await page.getByLabel('Cognome').fill('Esempio')
    await page.getByRole('button', { name: 'Aggiungi atleta' }).click()
    await expect(page.getByText(/Atleta aggiunto: Dario Esempio/)).toBeVisible()
    // Il server legge subito la scheda Fitarco del nuovo atleta (senza aspettare il giro automatico).
    await expect
      .poll(() =>
        richiesteFunzione.filter((r) => (r as { azione: string }).azione === 'aggiorna-atleta'),
      )
      .toHaveLength(1)

    await page.getByRole('link', { name: /Esempio Dario/ }).click()
    await expect(titolo(page, 'Dario Esempio')).toBeVisible()
    await page.getByRole('button', { name: 'Genera link' }).click()
    await expect(page.getByText(/accesso#m=900004&c=K7PM3XQR9A/)).toBeVisible()

    await page.getByRole('button', { name: 'Revoca accesso' }).click()
    await page.getByRole('button', { name: "Revoca l'accesso di Dario" }).click()
    await expect(page.getByText(/Accesso revocato: Dario Esempio/)).toBeVisible()
  })

  test.describe('accessibilità delle pagine di amministrazione', () => {
    test.use({ reducedMotion: 'reduce' })
    for (const tema of TEMI) {
      test(`tema ${tema.scelta}`, async ({ page }) => {
        await conTema(page, tema.scelta)
        await page.goto('/amministrazione')
        await expect(page.getByRole('link', { name: /Esempio Carla/ })).toBeVisible()
        await controllaAccessibilita(page)

        await page.goto(`/amministrazione/atleti/${SENZA_ACCESSO_PROVA.id}`)
        await expect(titolo(page, 'Carla Esempio')).toBeVisible()
        await controllaAccessibilita(page)
      })
    }
  })
})
