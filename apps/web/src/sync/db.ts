import Dexie, { type Table } from 'dexie'
import { TABELLE, type NomeTabella, type Riga } from './tabelle'

/** Quando e fino a dove ci si è sincronizzati: `ultima`, `eliminazioni`, `cursore:<tabella>`. */
export interface Meta {
  chiave: string
  valore: number
}

/**
 * Database dell'app sul telefono (IndexedDB): la copia di tutto quello che serve per funzionare offline.
 * Gli indici servono alle schermate (le gare per data, le classifiche per gara e per atleta…).
 */
export class ArcoDb extends Dexie {
  atleti!: Table<Riga>
  gare!: Table<Riga>
  inviti!: Table<Riga>
  partecipazioni!: Table<Riga>
  classifiche!: Table<Riga>
  /** Allenamento dell'atleta (privato). Le righe con `da_inviare: 1` hanno modifiche non ancora sul server. */
  allenamento_giorni!: Table<Riga>
  /** Simulazioni di gara (privato, come l'allenamento): `da_inviare: 1` segna le modifiche da mandare. */
  simulazioni!: Table<Riga>
  /** Le classifiche (ranking) complete già aperte: restano disponibili offline. */
  classifiche_ranking!: Table<Riga>
  /** La tua riga di ogni classifica in cui compari ("La tua posizione"). */
  mie_posizioni!: Table<Riga>
  meta!: Table<Meta, string>

  constructor(nome = 'arco') {
    super(nome)
    this.version(1).stores({
      atleti: 'id',
      gare: 'codice, dal',
      inviti: 'gara_codice',
      partecipazioni: '[atleta_id+gara_codice+divisione], atleta_id, gara_codice',
      classifiche: '[gara_codice+categoria+ordine], gara_codice, atleta_id',
      ranking: '[atleta_id+tipo+divisione]',
      meta: 'chiave',
    })
    // Fase 5: classifiche complete e posizioni dell'atleta, scaricate a richiesta (non dalla sincronizzazione).
    this.version(2).stores({
      classifiche_ranking: '[tipo+divisione+classe+genere]',
      mie_posizioni: '[tipo+divisione+classe+genere]',
    })
    // Fase 6: l'allenamento si scrive anche sul telefono; `da_inviare` (1) segna le righe da mandare al server.
    this.version(3).stores({
      allenamento_giorni: '[atleta_id+giorno], atleta_id, giorno, da_inviare',
    })
    // Fase 6.3: le simulazioni di gara (segnapunti), scritte anche dal telefono.
    this.version(4).stores({
      simulazioni: 'id, atleta_id, giorno, da_inviare',
    })
    // Pulizia (11/11/2026): la vecchia tabella `ranking` non c'è più (le classifiche stanno in classifiche_ranking).
    this.version(5).stores({ ranking: null })
  }

  tabella(nome: NomeTabella): Table<Riga> {
    return this[nome]
  }
}

/** Il database usato dall'app (uno solo per telefono). */
let predefinito: ArcoDb | null = null
export function dbPredefinito(): ArcoDb {
  predefinito ??= new ArcoDb()
  return predefinito
}

/** Toglie tutti i dati dal telefono (all'uscita): la copia non resta a chi non ha più l'accesso. */
export async function svuotaDb(db: ArcoDb): Promise<void> {
  const tabelle = [
    ...TABELLE.map((t) => db.tabella(t.nome)),
    db.meta,
    db.classifiche_ranking,
    db.mie_posizioni,
  ]
  await db.transaction('rw', tabelle, async () => {
    await Promise.all(tabelle.map((t) => t.clear()))
  })
}
