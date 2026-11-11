import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { ArcoDb } from './db'
import { TABELLE } from './tabelle'

const NOME = 'arco-prova-versioni'
afterEach(async () => {
  await Dexie.delete(NOME)
})

describe('database del telefono', () => {
  it('la vecchia tabella "ranking" non c’è più (anche su un telefono che l’aveva)', async () => {
    // Un telefono con la versione 4: c'era ancora la tabella ranking, con una riga.
    const vecchio = new Dexie(NOME)
    vecchio.version(4).stores({ ranking: '[atleta_id+tipo+divisione]', atleti: 'id' })
    await vecchio.table('ranking').put({ atleta_id: 'a1', tipo: 'I', divisione: 'OL' })
    vecchio.close()

    const db = new ArcoDb(NOME)
    await db.open()
    expect(db.verno).toBe(6)
    expect(db.tables.map((t) => t.name)).not.toContain('ranking')
    db.close()
  })

  it('la sincronizzazione non chiede più la tabella "ranking" al server', () => {
    expect(TABELLE.map((t) => t.nome)).not.toContain('ranking')
  })
})
