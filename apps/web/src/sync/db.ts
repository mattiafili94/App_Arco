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
  ranking!: Table<Riga>
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
  await db.transaction('rw', [...TABELLE.map((t) => db.tabella(t.nome)), db.meta], async () => {
    await Promise.all([...TABELLE.map((t) => db.tabella(t.nome).clear()), db.meta.clear()])
  })
}
