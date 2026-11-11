import {
  aggiungiGiorni,
  copiaProgrammaSettimana,
  giorniDellaSettimana,
  programmiDaCopiare,
  type GiornoAllenamento,
} from '@arco/shared'
import type { ArcoDb } from '../sync/db'

/** I campi di un giorno che si possono cambiare (l'allenatore cambia solo il programma). */
export type CampiGiorno = Partial<
  Pick<GiornoAllenamento, 'programma' | 'fatto' | 'frecce_libere' | 'nota'>
>

const chiave = (atletaId: string, giorno: string): [string, string] => [atletaId, giorno]

/** Un istante dopo `prima` (ISO), anche se l'orologio del telefono è indietro: due modifiche non si confondono. */
const dopo = (adesso: Date, prima: string | undefined) =>
  new Date(Math.max(adesso.getTime(), (prima ? Date.parse(prima) : 0) + 1)).toISOString()

/** Un giorno com'è sul telefono; `undefined` se non c'è ancora niente. */
export async function leggiGiorno(db: ArcoDb, atletaId: string, giorno: string) {
  return (await db.allenamento_giorni.get(chiave(atletaId, giorno))) as
    GiornoAllenamento | undefined
}

/**
 * Salva sul telefono la modifica di un giorno e lo segna "da inviare" al server (lo fa la sincronizzazione).
 * - Chi scrive è `autore`: l'atleta stesso (di base) o un suo allenatore, che cambia solo il programma.
 * - Le modifiche dell'atleta ("fatto", frecce, nota) hanno la loro data (`modificato_il`), il programma la sua
 *   (`programma_modificato_il`) con il suo autore: così atleta e allenatore non si cancellano a vicenda.
 * - Le date crescono sempre: due modifiche nello stesso istante non si confondono.
 */
export async function salvaGiorno(
  db: ArcoDb,
  atletaId: string,
  giorno: string,
  campi: CampiGiorno,
  adesso: Date = new Date(),
  autore: string = atletaId,
): Promise<GiornoAllenamento> {
  return db.transaction('rw', db.allenamento_giorni, async () => {
    const attuale = await leggiGiorno(db, atletaId, giorno)
    const proprio = autore === atletaId
    // L'allenatore cambia solo il programma: gli altri campi restano quelli dell'atleta.
    const validi: CampiGiorno = proprio
      ? campi
      : campi.programma === undefined
        ? {}
        : { programma: campi.programma }
    const nuovo: GiornoAllenamento = {
      atleta_id: atletaId,
      giorno,
      programma: '',
      fatto: false,
      frecce_libere: 0,
      nota: '',
      ...attuale,
      ...validi,
      // Un giorno creato dall'allenatore resta "del 1970" per l'atleta: ogni sua modifica vince.
      modificato_il: proprio
        ? dopo(adesso, attuale?.modificato_il)
        : (attuale?.modificato_il ?? new Date(0).toISOString()),
    }
    if (validi.programma !== undefined) {
      nuovo.programma_modificato_il = dopo(adesso, attuale?.programma_modificato_il)
      nuovo.programma_modificato_da = autore
    }
    // `aggiornato_il` (ora del server) resta quello che c'era (arriva con `...attuale`): lo cambia solo il server.
    await db.allenamento_giorni.put({ ...nuovo, da_inviare: 1 })
    return nuovo
  })
}

/**
 * "Copia la settimana scorsa": i programmi della settimana precedente si scrivono in quella che inizia a
 * `inizio`, nei giorni che non ne hanno già uno. Restituisce quanti programmi ha copiato.
 */
export async function copiaSettimanaScorsa(
  db: ArcoDb,
  atletaId: string,
  inizio: string,
  adesso: Date = new Date(),
  autore: string = atletaId,
): Promise<number> {
  const prima = giorniDellaSettimana(aggiungiGiorni(inizio, -7))
  const dopoSettimana = giorniDellaSettimana(inizio)
  const copie = copiaProgrammaSettimana(
    await leggiGiorni(db, atletaId, prima),
    await leggiGiorni(db, atletaId, dopoSettimana),
  )
  for (const c of copie)
    await salvaGiorno(db, atletaId, c.giorno, { programma: c.programma }, adesso, autore)
  return copie.length
}

async function leggiGiorni(db: ArcoDb, atletaId: string, giorni: string[]) {
  return (await Promise.all(giorni.map((g) => leggiGiorno(db, atletaId, g)))).filter(
    (g): g is GiornoAllenamento => g !== undefined,
  )
}

/**
 * "Copia il programma su…" (allenatore): il programma della settimana di un atleta si scrive negli stessi giorni
 * degli altri atleti scelti. I giorni dove hanno già un programma si sostituiscono solo con `sostituisci`.
 * Restituisce quanti programmi ha scritto in tutto.
 */
export async function copiaProgrammaSuAtleti(
  db: ArcoDb,
  sorgente: string,
  destinatari: readonly string[],
  inizio: string,
  sostituisci: boolean,
  autore: string,
  adesso: Date = new Date(),
): Promise<number> {
  const giorni = giorniDellaSettimana(inizio)
  const daCopiare = await leggiGiorni(db, sorgente, giorni)
  let scritti = 0
  for (const atleta of destinatari) {
    if (atleta === sorgente) continue
    const copie = programmiDaCopiare(daCopiare, await leggiGiorni(db, atleta, giorni), sostituisci)
    for (const c of copie) {
      await salvaGiorno(db, atleta, c.giorno, { programma: c.programma }, adesso, autore)
      scritti++
    }
  }
  return scritti
}
