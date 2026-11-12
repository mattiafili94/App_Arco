/**
 * Il motore della sincronizzazione (Fase 3.1): porta sul telefono le novità del server.
 * - Righe: si scaricano solo quelle cambiate dall'ultima volta (`aggiornato_il`), con un piccolo margine
 *   (si rileggono le ultime righe: scrivere due volte la stessa riga non fa danni).
 * - Eliminazioni: si leggono dal registro del server e si tolgono dalla copia.
 * - Il primo giro scarica tutto. Un telefono fermo da troppo tempo riparte da zero: il registro delle
 *   eliminazioni non tiene tracce così vecchie.
 * Dati condivisi: solo dal server al telefono, mai il contrario.
 * Allenamento e simulazioni (privati): nei due sensi. Prima si mandano al server le modifiche fatte sul telefono, poi si
 *   scaricano le novità; una riga con modifiche non ancora inviate non si sovrascrive mai con quella del
 *   server (al giro dopo il server sceglie la più recente).
 */
import type { GiornoAllenamento, Simulazione } from '@arco/shared'
import { svuotaDb, type ArcoDb } from './db'
import type { Remoto } from './remoto'
import { chiaveDi, TABELLE, type DefinizioneTabella, type NomeTabella, type Riga } from './tabelle'

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
  /** Modifiche dell'allenamento mandate al server. */
  inviate: number
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

/** Le tabelle che si scrivono anche dal telefono, e come si salva una riga sul server. */
const SCRIVIBILI: {
  nome: NomeTabella
  salva: (remoto: Remoto, riga: Riga) => Promise<Riga>
}[] = [
  {
    nome: 'allenamento_giorni',
    salva: (remoto, riga) => remoto.salvaAllenamento(riga as unknown as GiornoAllenamento),
  },
  {
    nome: 'simulazioni',
    salva: (remoto, riga) => remoto.salvaSimulazione(riga as unknown as Simulazione),
  },
]

const eScrivibile = (nome: string) => SCRIVIBILI.some((s) => s.nome === nome)

/**
 * Manda al server le modifiche fatte sul telefono (allenamento, simulazioni): una riga alla volta. Il server
 * fa vincere la modifica più recente e restituisce la riga che vale: il telefono la tiene com'è. Se la riga
 * è stata modificata di nuovo mentre si inviava, resta quella locale (e si invia al giro dopo).
 * Se un invio fallisce si prosegue con gli altri e l'errore si segnala alla fine.
 */
async function inviaModifiche(
  remoto: Remoto,
  db: ArcoDb,
): Promise<{ inviate: number; errore: unknown }> {
  let inviate = 0
  let errore: unknown = null
  for (const { nome, salva } of SCRIVIBILI) {
    const def = TABELLE.find((t) => t.nome === nome)!
    const tabella = db.tabella(nome)
    const sporche = await tabella.where('da_inviare').equals(1).toArray()
    for (const riga of sporche) {
      // Il server non riceve il segno interno "da_inviare".
      const dati = { ...riga }
      delete dati.da_inviare
      try {
        const vincente = await salva(remoto, dati)
        await db.transaction('rw', tabella, async () => {
          const attuale = await tabella.get(chiaveDi(def, riga) as string)
          if (attuale && attuale.modificato_il === riga.modificato_il) await tabella.put(vincente)
        })
        inviate++
      } catch (e) {
        errore ??= e
      }
    }
  }
  return { inviate, errore }
}

async function scaricaTabella(
  remoto: Remoto,
  db: ArcoDb,
  def: DefinizioneTabella,
  fermato: () => boolean,
): Promise<number> {
  const cursore = await leggiMeta(db, chiaveCursore(def))
  const dal = cursore === undefined ? null : new Date(cursore - MARGINE_MS).toISOString()
  let massimo = cursore ?? 0
  let scritte = 0
  for (let da = 0; ; da += DIMENSIONE_PAGINA) {
    const pagina = await remoto.cambiamenti(def.nome, dal, da, DIMENSIONE_PAGINA)
    // Chiusa l'app (o la schermata) nel frattempo: non si scrive più niente.
    if (fermato()) return scritte
    if (pagina.length > 0)
      await db.tabella(def.nome).bulkPut(await senzaModificheLocali(db, def, pagina))
    scritte += pagina.length
    for (const riga of pagina) {
      const quando = Date.parse(String(riga.aggiornato_il))
      if (quando > massimo) massimo = quando
    }
    if (pagina.length < DIMENSIONE_PAGINA) break
  }
  // Anche il segnalibro (cursore) non si scrive più se chi ha chiesto la sincronizzazione non c'è più.
  if (massimo > 0 && !fermato()) await scriviMeta(db, chiaveCursore(def), massimo)
  return scritte
}

/** Le righe del server da scrivere: quelle con modifiche locali non ancora inviate restano come sono. */
async function senzaModificheLocali(
  db: ArcoDb,
  def: DefinizioneTabella,
  righe: Riga[],
): Promise<Riga[]> {
  if (!eScrivibile(def.nome)) return righe
  const locali = await db.tabella(def.nome).bulkGet(righe.map((r) => chiaveDi(def, r) as string))
  return righe.filter((_, i) => !locali[i]?.da_inviare)
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
  /** Vero quando chi ha chiesto la sincronizzazione non c'è più: da lì non si scrive più niente. */
  fermato: () => boolean = () => false,
): Promise<EsitoSincronizzazione> {
  // Prima le modifiche fatte sul telefono (anche dopo tanto tempo: non si perdono mai).
  const invio = await inviaModifiche(remoto, db)
  const ultima = await leggiMeta(db, CHIAVE_ULTIMA)
  const daCapo =
    ultima !== undefined &&
    invio.errore === null &&
    adesso() - ultima > GIORNI_MASSIMI_FERMO * 86_400_000
  if (daCapo) await svuotaDb(db)

  let eliminate = 0
  let righe = 0
  const idEliminazioni = await leggiMeta(db, CHIAVE_ELIMINAZIONI)
  if (idEliminazioni === undefined) {
    // Primo giro: niente da togliere. Si segna fin d'ora fin dove arriva il registro, così le
    // eliminazioni avvenute mentre si scarica si applicano al giro dopo.
    const iniziale = await remoto.ultimaEliminazione()
    for (const def of TABELLE) righe += await scaricaTabella(remoto, db, def, fermato)
    if (!fermato()) await scriviMeta(db, CHIAVE_ELIMINAZIONI, iniziale)
  } else {
    // Prima le eliminazioni, poi le righe nuove: una riga eliminata e riscritta torna com'è sul server.
    eliminate = await applicaEliminazioni(remoto, db, idEliminazioni)
    for (const def of TABELLE) righe += await scaricaTabella(remoto, db, def, fermato)
  }
  if (!fermato()) await scriviMeta(db, CHIAVE_ULTIMA, adesso())
  // Un invio fallito si segnala, ma dopo aver scaricato le novità.
  if (invio.errore !== null) throw invio.errore
  return { righe, eliminate, daCapo, inviate: invio.inviate }
}
