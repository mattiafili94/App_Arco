/**
 * Il motore della sincronizzazione (Fase 3.1): porta sul telefono le novità del server.
 * - Righe: si scaricano solo quelle cambiate dall'ultima volta (`aggiornato_il`), con un piccolo margine
 *   (si rileggono le ultime righe: scrivere due volte la stessa riga non fa danni).
 * - Eliminazioni: si leggono dal registro del server e si tolgono dalla copia.
 * - Il primo giro scarica tutto. Un telefono fermo da troppo tempo riparte da zero: il registro delle
 *   eliminazioni non tiene tracce così vecchie.
 * Dati condivisi: solo dal server al telefono, mai il contrario.
 */
import { svuotaDb, type ArcoDb } from './db'
import type { Remoto } from './remoto'
import { chiaveDi, TABELLE, type DefinizioneTabella } from './tabelle'

export const DIMENSIONE_PAGINA = 1000
/** Si rileggono le righe cambiate negli ultimi minuti prima dell'ultimo cursore (transazioni lente). */
export const MARGINE_MS = 2 * 60 * 1000
/** Oltre questi giorni senza sincronizzare si riparte da zero (il server tiene le tracce 60 giorni). */
export const GIORNI_MASSIMI_FERMO = 45

export interface EsitoSincronizzazione {
  /** Righe scritte nella copia. */
  righe: number
  /** Righe tolte dalla copia. */
  eliminate: number
  /** Il telefono era fermo da troppo tempo: è ripartito da zero. */
  daCapo: boolean
}

const CHIAVE_ULTIMA = 'ultima'
const CHIAVE_ELIMINAZIONI = 'eliminazioni'
const chiaveCursore = (t: DefinizioneTabella) => `cursore:${t.nome}`

const leggiMeta = async (db: ArcoDb, chiave: string) => (await db.meta.get(chiave))?.valore
const scriviMeta = (db: ArcoDb, chiave: string, valore: number) => db.meta.put({ chiave, valore })

/** Quando è stata l'ultima sincronizzazione riuscita (ms), o `null` se non è mai successo. */
export async function ultimaSincronizzazione(db: ArcoDb): Promise<number | null> {
  return (await leggiMeta(db, CHIAVE_ULTIMA)) ?? null
}

async function scaricaTabella(
  remoto: Remoto,
  db: ArcoDb,
  def: DefinizioneTabella,
): Promise<number> {
  const cursore = await leggiMeta(db, chiaveCursore(def))
  const dal = cursore === undefined ? null : new Date(cursore - MARGINE_MS).toISOString()
  let massimo = cursore ?? 0
  let scritte = 0
  for (let da = 0; ; da += DIMENSIONE_PAGINA) {
    const pagina = await remoto.cambiamenti(def.nome, dal, da, DIMENSIONE_PAGINA)
    if (pagina.length > 0) await db.tabella(def.nome).bulkPut(pagina)
    scritte += pagina.length
    for (const riga of pagina) {
      const quando = Date.parse(String(riga.aggiornato_il))
      if (quando > massimo) massimo = quando
    }
    if (pagina.length < DIMENSIONE_PAGINA) break
  }
  if (massimo > 0) await scriviMeta(db, chiaveCursore(def), massimo)
  return scritte
}

async function applicaEliminazioni(remoto: Remoto, db: ArcoDb, dopoId: number): Promise<number> {
  let ultimoId = dopoId
  let tolte = 0
  for (;;) {
    const pagina = await remoto.eliminazioni(ultimoId, DIMENSIONE_PAGINA)
    for (const def of TABELLE) {
      const chiavi = pagina
        .filter((e) => e.tabella === def.nome)
        .map((e) => chiaveDi(def, e.chiave) as string)
      if (chiavi.length > 0) await db.tabella(def.nome).bulkDelete(chiavi)
      tolte += chiavi.length
    }
    if (pagina.length > 0) {
      ultimoId = pagina[pagina.length - 1]!.id
      await scriviMeta(db, CHIAVE_ELIMINAZIONI, ultimoId)
    }
    if (pagina.length < DIMENSIONE_PAGINA) return tolte
  }
}

export async function sincronizza(
  remoto: Remoto,
  db: ArcoDb,
  adesso: () => number = Date.now,
): Promise<EsitoSincronizzazione> {
  const ultima = await leggiMeta(db, CHIAVE_ULTIMA)
  const daCapo = ultima !== undefined && adesso() - ultima > GIORNI_MASSIMI_FERMO * 86_400_000
  if (daCapo) await svuotaDb(db)

  let eliminate = 0
  let righe = 0
  const idEliminazioni = await leggiMeta(db, CHIAVE_ELIMINAZIONI)
  if (idEliminazioni === undefined) {
    // Primo giro: niente da togliere. Si segna fin d'ora fin dove arriva il registro, così le
    // eliminazioni avvenute mentre si scarica si applicano al giro dopo.
    const iniziale = await remoto.ultimaEliminazione()
    for (const def of TABELLE) righe += await scaricaTabella(remoto, db, def)
    await scriviMeta(db, CHIAVE_ELIMINAZIONI, iniziale)
  } else {
    // Prima le eliminazioni, poi le righe nuove: una riga eliminata e riscritta torna com'è sul server.
    eliminate = await applicaEliminazioni(remoto, db, idEliminazioni)
    for (const def of TABELLE) righe += await scaricaTabella(remoto, db, def)
  }
  await scriviMeta(db, CHIAVE_ULTIMA, adesso())
  return { righe, eliminate, daCapo }
}
