import {
  aggiungiFreccia,
  correggiFreccia,
  impostaNotaVolee,
  riepilogoSimulazione,
  togliUltimaFreccia,
  type Bersaglio,
  type DistanzaOutdoor,
  type FormatoSimulazione,
  type Simulazione,
  type ValoreFreccia,
} from '@arco/shared'
import type { ArcoDb } from '../sync/db'

/** Un identificatore unico generato sul telefono (UUID v4). */
export function nuovoId(): string {
  const c = globalThis.crypto
  if (typeof c?.randomUUID === 'function') return c.randomUUID()
  // Telefoni molto vecchi senza randomUUID: si costruisce da byte casuali.
  const byte = c.getRandomValues(new Uint8Array(16))
  byte[6] = (byte[6]! & 0x0f) | 0x40
  byte[8] = (byte[8]! & 0x3f) | 0x80
  const h = [...byte].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export async function leggiSimulazione(db: ArcoDb, id: string) {
  return (await db.simulazioni.get(id)) as Simulazione | undefined
}

/** Scrive una simulazione sul telefono e la segna "da inviare". `modificato_il` cresce sempre. */
async function scrivi(
  db: ArcoDb,
  s: Simulazione,
  precedente: Simulazione | undefined,
  adesso: Date,
): Promise<Simulazione> {
  const ora = adesso.getTime()
  const prima = precedente ? Date.parse(precedente.modificato_il) : 0
  const nuova: Simulazione = {
    ...s,
    modificato_il: new Date(Math.max(ora, prima + 1)).toISOString(),
  }
  // `aggiornato_il` (ora del server) resta quello che c'era (arriva con `...precedente`).
  await db.simulazioni.put({ ...precedente, ...nuova, da_inviare: 1 })
  return nuova
}

/** Una simulazione nuova, vuota, nel giorno indicato. */
export async function creaSimulazione(
  db: ArcoDb,
  atletaId: string,
  giorno: string,
  scelta: { formato: FormatoSimulazione; distanza: DistanzaOutdoor | null; bersaglio: Bersaglio },
  adesso: Date = new Date(),
): Promise<Simulazione> {
  const base: Simulazione = {
    id: nuovoId(),
    atleta_id: atletaId,
    giorno,
    ...scelta,
    frecce: [],
    note: {},
    conclusa: false,
    eliminata: false,
    creata_il: adesso.toISOString(),
    modificato_il: adesso.toISOString(),
  }
  return scrivi(db, base, undefined, adesso)
}

/**
 * Cambia le frecce di una simulazione (dentro una transazione, sui dati più recenti). `cambia` restituisce le
 * nuove frecce, o `null` se la modifica non è valida (allora non si scrive niente). `conclusa` segue le frecce:
 * è vera quando sono state tirate tutte.
 */
async function cambiaFrecce(
  db: ArcoDb,
  id: string,
  cambia: (s: Simulazione) => ValoreFreccia[] | null,
  adesso: Date,
): Promise<Simulazione | null> {
  return db.transaction('rw', db.simulazioni, async () => {
    const attuale = await leggiSimulazione(db, id)
    if (!attuale || attuale.eliminata) return null
    const frecce = cambia(attuale)
    if (frecce === null) return null
    const conclusa = riepilogoSimulazione({ ...attuale, frecce }).completa
    return scrivi(db, { ...attuale, frecce, conclusa }, attuale, adesso)
  })
}

/** Segna la prossima freccia. `null` se non si può (valore non ammesso o gara finita). */
export const segnaFreccia = (db: ArcoDb, id: string, valore: ValoreFreccia, adesso = new Date()) =>
  cambiaFrecce(db, id, (s) => aggiungiFreccia(s, valore), adesso)

/** Cambia una freccia già segnata. */
export const correggiValore = (
  db: ArcoDb,
  id: string,
  indice: number,
  valore: ValoreFreccia,
  adesso = new Date(),
) => cambiaFrecce(db, id, (s) => correggiFreccia(s, indice, valore), adesso)

/** Toglie l'ultima freccia segnata. */
export const annullaUltimaFreccia = (db: ArcoDb, id: string, adesso = new Date()) =>
  cambiaFrecce(db, id, (s) => (s.frecce.length === 0 ? null : togliUltimaFreccia(s)), adesso)

/** Cancella la simulazione (resta la riga, segnata `eliminata`, così lo sanno anche gli altri telefoni). */
export async function eliminaSimulazione(db: ArcoDb, id: string, adesso = new Date()) {
  return db.transaction('rw', db.simulazioni, async () => {
    const attuale = await leggiSimulazione(db, id)
    if (!attuale || attuale.eliminata) return null
    return scrivi(db, { ...attuale, eliminata: true }, attuale, adesso)
  })
}

/** Scrive (o toglie, con il testo vuoto) la nota di una volée. */
export async function salvaNotaVolee(
  db: ArcoDb,
  id: string,
  indiceVolee: number,
  testo: string,
  adesso = new Date(),
) {
  return db.transaction('rw', db.simulazioni, async () => {
    const attuale = await leggiSimulazione(db, id)
    if (!attuale || attuale.eliminata) return null
    const note = impostaNotaVolee(attuale.note, indiceVolee, testo)
    return scrivi(db, { ...attuale, note }, attuale, adesso)
  })
}
