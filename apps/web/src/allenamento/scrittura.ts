import {
  aggiungiGiorni,
  copiaProgrammaSettimana,
  giorniDellaSettimana,
  type GiornoAllenamento,
} from '@arco/shared'
import type { ArcoDb } from '../sync/db'

/** I campi di un giorno che l'atleta può cambiare. */
export type CampiGiorno = Partial<
  Pick<GiornoAllenamento, 'programma' | 'fatto' | 'frecce_libere' | 'nota'>
>

const chiave = (atletaId: string, giorno: string): [string, string] => [atletaId, giorno]

/** Un giorno com'è sul telefono; `undefined` se non c'è ancora niente. */
export async function leggiGiorno(db: ArcoDb, atletaId: string, giorno: string) {
  return (await db.allenamento_giorni.get(chiave(atletaId, giorno))) as
    GiornoAllenamento | undefined
}

/**
 * Salva sul telefono la modifica di un giorno e lo segna "da inviare" al server (lo fa la
 * sincronizzazione). `modificato_il` cresce sempre: due modifiche nello stesso istante non si
 * confondono (vince l'ultima, anche se l'orologio del telefono è lento).
 */
export async function salvaGiorno(
  db: ArcoDb,
  atletaId: string,
  giorno: string,
  campi: CampiGiorno,
  adesso: Date = new Date(),
): Promise<GiornoAllenamento> {
  return db.transaction('rw', db.allenamento_giorni, async () => {
    const attuale = await leggiGiorno(db, atletaId, giorno)
    const ora = adesso.getTime()
    const precedente = attuale ? Date.parse(attuale.modificato_il) : 0
    const nuovo: GiornoAllenamento = {
      atleta_id: atletaId,
      giorno,
      programma: '',
      fatto: false,
      frecce_libere: 0,
      nota: '',
      ...attuale,
      ...campi,
      modificato_il: new Date(Math.max(ora, precedente + 1)).toISOString(),
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
): Promise<number> {
  const prima = giorniDellaSettimana(aggiungiGiorni(inizio, -7))
  const dopo = giorniDellaSettimana(inizio)
  const leggi = async (giorni: string[]) =>
    (await Promise.all(giorni.map((g) => leggiGiorno(db, atletaId, g)))).filter(
      (g): g is GiornoAllenamento => g !== undefined,
    )
  const copie = copiaProgrammaSettimana(await leggi(prima), await leggi(dopo))
  for (const c of copie)
    await salvaGiorno(db, atletaId, c.giorno, { programma: c.programma }, adesso)
  return copie.length
}
