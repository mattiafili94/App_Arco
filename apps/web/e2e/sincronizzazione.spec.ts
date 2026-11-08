import { expect, test, type Page } from '@playwright/test'
import { aspettaMotoreOffline } from './aiuti'
import { GARE_PROVA, simulaSupabase } from './supabase-finto'

test.beforeEach(async ({ page }) => {
  await simulaSupabase(page)
})

/** Quante gare ci sono nella copia dei dati sul telefono (IndexedDB), 0 se non esiste. */
async function gareSalvate(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const elenco = await indexedDB.databases()
    if (!elenco.some((d) => d.name === 'arco')) return 0
    return new Promise<number>((ok, ko) => {
      const apertura = indexedDB.open('arco')
      apertura.onerror = () => ko(apertura.error)
      apertura.onsuccess = () => {
        const db = apertura.result
        if (!db.objectStoreNames.contains('gare')) {
          db.close()
          return ok(0)
        }
        const conteggio = db.transaction('gare').objectStore('gare').count()
        conteggio.onerror = () => ko(conteggio.error)
        conteggio.onsuccess = () => {
          db.close()
          ok(conteggio.result)
        }
      }
    })
  })
}

test.describe('dati sul telefono', () => {
  test('all apertura scarica i dati e dice quando', async ({ page }) => {
    await page.goto('/impostazioni')
    await expect(page.getByText(/Oggi alle \d\d:\d\d/)).toBeVisible()
    await expect.poll(() => gareSalvate(page)).toBe(GARE_PROVA.length)
  })

  test('senza rete l app mostra i dati già salvati e dice che è offline', async ({
    page,
    context,
  }) => {
    await page.goto('/impostazioni')
    await expect(page.getByText(/Oggi alle \d\d:\d\d/)).toBeVisible()
    await aspettaMotoreOffline(page)

    await context.setOffline(true)
    await page.reload()
    await expect(page.getByText(/Oggi alle \d\d:\d\d/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Aggiorna ora\s*Offline/ })).toBeVisible()
    expect(await gareSalvate(page)).toBe(GARE_PROVA.length)
  })

  test('uscendo dal telefono la copia dei dati viene tolta', async ({ page }) => {
    await page.goto('/impostazioni')
    await expect.poll(() => gareSalvate(page)).toBe(GARE_PROVA.length)

    await page.getByRole('button', { name: 'Esci', exact: true }).click()
    await page.getByRole('button', { name: 'Esci da questo telefono' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Accedi' })).toBeVisible()
    await expect.poll(() => gareSalvate(page)).toBe(0)
  })
})
