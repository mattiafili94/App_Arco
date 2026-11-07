/**
 * Scelta del tema: segue il sistema oppure forza chiaro, scuro o alto contrasto.
 * La scelta è salvata sul telefono (localStorage) ed è applicata con `data-theme`
 * sulla radice del documento; i colori arrivano da tokens.css.
 */

export type SceltaTema = 'sistema' | 'chiaro' | 'scuro' | 'alto-contrasto'

export const SCELTE_TEMA: readonly { valore: SceltaTema; etichetta: string }[] = [
  { valore: 'sistema', etichetta: 'Come il telefono' },
  { valore: 'chiaro', etichetta: 'Chiaro' },
  { valore: 'scuro', etichetta: 'Scuro' },
  { valore: 'alto-contrasto', etichetta: 'Alto contrasto' },
]

/** Chiave in localStorage. La usa anche lo script in index.html che evita il lampo di colore all'avvio. */
export const CHIAVE_TEMA = 'arco.tema'

const ATTRIBUTO: Record<SceltaTema, string | null> = {
  sistema: null,
  chiaro: 'light',
  scuro: 'dark',
  'alto-contrasto': 'contrast',
}

const eScelta = (valore: unknown): valore is SceltaTema =>
  typeof valore === 'string' && valore in ATTRIBUTO

/** Legge la scelta salvata; se manca, non è valida o la memoria non è accessibile: "sistema". */
export function leggiSceltaTema(): SceltaTema {
  try {
    const salvata = localStorage.getItem(CHIAVE_TEMA)
    return eScelta(salvata) ? salvata : 'sistema'
  } catch {
    return 'sistema'
  }
}

/** Salva la scelta. Se la memoria non è accessibile (es. navigazione privata) il tema vale solo per ora. */
export function salvaSceltaTema(scelta: SceltaTema): void {
  try {
    if (scelta === 'sistema') localStorage.removeItem(CHIAVE_TEMA)
    else localStorage.setItem(CHIAVE_TEMA, scelta)
  } catch {
    // memoria non disponibile: nessun salvataggio
  }
}

/** Applica la scelta alla radice del documento. */
export function applicaSceltaTema(
  scelta: SceltaTema,
  radice: HTMLElement = document.documentElement,
): void {
  const attributo = ATTRIBUTO[scelta]
  if (attributo) radice.setAttribute('data-theme', attributo)
  else radice.removeAttribute('data-theme')
}
