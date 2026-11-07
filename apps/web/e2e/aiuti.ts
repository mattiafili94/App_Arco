import type { Page } from '@playwright/test'

export const PAGINE = [
  { percorso: '/gare', titolo: 'Gare' },
  { percorso: '/atleti', titolo: 'Atleti' },
  { percorso: '/classifica', titolo: 'Classifica' },
  { percorso: '/allenamento', titolo: 'Allenamento' },
  { percorso: '/impostazioni', titolo: 'Impostazioni' },
] as const

export const TEMI = [
  { scelta: 'chiaro', attributo: 'light' },
  { scelta: 'scuro', attributo: 'dark' },
  { scelta: 'alto-contrasto', attributo: 'contrast' },
] as const

/** Imposta il tema prima che la pagina si apra (come se l'atleta l'avesse già scelto). */
export async function conTema(page: Page, scelta: string) {
  await page.addInitScript((t) => localStorage.setItem('arco.tema', t), scelta)
}

/** Aspetta che il motore offline (service worker) sia attivo e controlli la pagina. */
export async function aspettaMotoreOffline(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  const controllata = await page.evaluate(() => Boolean(navigator.serviceWorker.controller))
  if (!controllata) await page.reload()
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
}

/** Vero se la pagina scorre in orizzontale (non deve mai succedere). */
export function scorreInOrizzontale(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
}
