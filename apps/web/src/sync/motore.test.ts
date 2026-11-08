import { beforeEach, describe, expect, it } from 'vitest'
import { RemotoFinto } from '../test/remotoFinto'
import { ArcoDb, svuotaDb } from './db'
import {
  DIMENSIONE_PAGINA,
  GIORNI_MASSIMI_FERMO,
  MARGINE_MS,
  sincronizza,
  ultimaSincronizzazione,
} from './motore'

const ORA = Date.parse('2026-11-10T10:00:00Z')
const adesso = () => ORA
const quando = (minutiFa: number) => new Date(ORA - minutiFa * 60_000).toISOString()

const gara = (codice: string, minutiFa = 600, localita = 'Gubbio (PG)') => ({
  codice,
  dal: '2026-10-24',
  localita,
  aggiornato_il: quando(minutiFa),
})

const CATEGORIA = 'Arco Ricurvo - Senior Maschile'

let remoto: RemotoFinto
let db: ArcoDb
let contatore = 0

beforeEach(() => {
  remoto = new RemotoFinto()
  // Un database nuovo per ogni test (fake-indexeddb tiene i dati in memoria).
  db = new ArcoDb(`prova-${contatore++}`)
})

describe('primo giro', () => {
  it('scarica tutto e ricorda fino a dove è arrivato', async () => {
    remoto.scrivi('gare', gara('R1'))
    remoto.scrivi('gare', gara('R2', 300))
    remoto.scrivi('atleti', { id: 'a1', nome: 'Anna', aggiornato_il: quando(500) })
    remoto.scrivi('classifiche', {
      gara_codice: 'R1',
      categoria: CATEGORIA,
      ordine: 1,
      aggiornato_il: quando(500),
    })
    remoto.scrivi('partecipazioni', {
      atleta_id: 'a1',
      gara_codice: 'R1',
      divisione: 'OL',
      aggiornato_il: quando(500),
    })

    expect(await sincronizza(remoto, db, adesso)).toEqual({
      righe: 5,
      eliminate: 0,
      daCapo: false,
      inviate: 0,
    })
    expect(await db.gare.count()).toBe(2)
    expect((await db.atleti.get('a1'))?.nome).toBe('Anna')
    expect(await db.classifiche.get(['R1', CATEGORIA, 1])).toBeDefined()
    expect(await db.partecipazioni.get(['a1', 'R1', 'OL'])).toBeDefined()
    expect(await ultimaSincronizzazione(db)).toBe(ORA)
  })

  it('non applica le vecchie eliminazioni: la copia è vuota, parte dall’ultima', async () => {
    remoto.scrivi('gare', gara('R1'))
    remoto.elimina('gare', { codice: 'R0' })
    await sincronizza(remoto, db, adesso)
    expect(remoto.richieste).toContain('ultima eliminazione')
    expect(remoto.richieste.some((r) => r.startsWith('eliminazioni dopo'))).toBe(false)
    expect((await db.meta.get('eliminazioni'))?.valore).toBe(1)
  })

  it('scarica le tabelle a pagine', async () => {
    for (let i = 0; i < 2 * DIMENSIONE_PAGINA + 500; i++) {
      remoto.scrivi('gare', gara(`R${String(i).padStart(5, '0')}`, 600 - (i % 50)))
    }
    expect((await sincronizza(remoto, db, adesso)).righe).toBe(2 * DIMENSIONE_PAGINA + 500)
    expect(await db.gare.count()).toBe(2 * DIMENSIONE_PAGINA + 500)
  })

  it('una tabella vuota non lascia un cursore', async () => {
    await sincronizza(remoto, db, adesso)
    expect(await db.meta.get('cursore:gare')).toBeUndefined()
  })
})

describe('giri successivi', () => {
  beforeEach(async () => {
    remoto.scrivi('gare', gara('R1'))
    remoto.scrivi('gare', gara('R2', 300))
    await sincronizza(remoto, db, adesso)
    remoto.richieste = []
  })

  it('senza novità scarica solo l’ultima riga (il margine di sicurezza), dall’ultimo cursore', async () => {
    // L'ultima riga rientra nel margine dei 2 minuti: si riscrive uguale, senza danni.
    expect(await sincronizza(remoto, db, adesso)).toEqual({
      righe: 1,
      eliminate: 0,
      daCapo: false,
      inviate: 0,
    })
    expect(await db.gare.count()).toBe(2)
    const dal = new Date(ORA - 300 * 60_000 - MARGINE_MS).toISOString()
    expect(remoto.richieste).toContain(`gare dal ${dal} da 0`)
  })

  it('scarica solo le righe nuove o cambiate', async () => {
    remoto.scrivi('gare', gara('R2', 10, 'Terni (TR)'))
    remoto.scrivi('gare', gara('R3', 5))
    expect(await sincronizza(remoto, db, adesso)).toMatchObject({ righe: 2 })
    expect((await db.gare.get('R2'))?.localita).toBe('Terni (TR)')
    expect(await db.gare.count()).toBe(3)
  })

  it('rilegge anche una riga scritta "in ritardo" poco prima del cursore', async () => {
    // Transazione lunga: la riga porta una data di 1 minuto prima dell'ultima riga già scaricata.
    remoto.scrivi('gare', gara('R4', 301))
    await sincronizza(remoto, db, adesso)
    expect(await db.gare.get('R4')).toBeDefined()
  })

  it('toglie dalla copia le righe eliminate dal server', async () => {
    remoto.elimina('gare', { codice: 'R1' })
    expect(await sincronizza(remoto, db, adesso)).toMatchObject({ eliminate: 1 })
    expect(await db.gare.get('R1')).toBeUndefined()
    expect(await db.gare.get('R2')).toBeDefined()
    // La stessa eliminazione non si riapplica.
    remoto.richieste = []
    await sincronizza(remoto, db, adesso)
    expect(remoto.richieste).toContain('eliminazioni dopo 1')
  })

  it('toglie anche le righe con chiave composta', async () => {
    remoto.scrivi('classifiche', {
      gara_codice: 'R2',
      categoria: 'C',
      ordine: 1,
      aggiornato_il: quando(250),
    })
    remoto.scrivi('classifiche', {
      gara_codice: 'R2',
      categoria: 'C',
      ordine: 2,
      aggiornato_il: quando(250),
    })
    await sincronizza(remoto, db, adesso)
    remoto.elimina('classifiche', { gara_codice: 'R2', categoria: 'C', ordine: 1 })
    await sincronizza(remoto, db, adesso)
    expect(await db.classifiche.count()).toBe(1)
    expect(await db.classifiche.get(['R2', 'C', 2])).toBeDefined()
  })

  it('una classifica sostituita (eliminata e riscritta) resta com’è sul server', async () => {
    const riga = (totale: number, minutiFa: number) => ({
      gara_codice: 'R2',
      categoria: 'C',
      ordine: 1,
      totale,
      aggiornato_il: quando(minutiFa),
    })
    remoto.scrivi('classifiche', riga(500, 250))
    await sincronizza(remoto, db, adesso)
    // Il server la sostituisce: elimina la riga e la riscrive con un totale diverso.
    remoto.elimina('classifiche', { gara_codice: 'R2', categoria: 'C', ordine: 1 })
    remoto.scrivi('classifiche', riga(520, 1))
    await sincronizza(remoto, db, adesso)
    expect((await db.classifiche.get(['R2', 'C', 1]))?.totale).toBe(520)
  })

  it('ignora le eliminazioni di tabelle che non conosce', async () => {
    remoto.registro.push({ id: 99, tabella: 'altra', chiave: { x: 1 } })
    expect(await sincronizza(remoto, db, adesso)).toMatchObject({ eliminate: 0 })
    expect((await db.meta.get('eliminazioni'))?.valore).toBe(99)
  })
})

describe('telefono fermo e problemi di rete', () => {
  it('fermo da troppo tempo: riparte da zero', async () => {
    remoto.scrivi('gare', gara('R1'))
    await sincronizza(remoto, db, adesso)
    // Sul server la gara R1 è stata eliminata e la traccia è già stata ripulita (più di 60 giorni).
    remoto.righe.gare = []
    remoto.scrivi('gare', gara('R9'))
    const dopo = () => ORA + (GIORNI_MASSIMI_FERMO + 1) * 86_400_000
    expect(await sincronizza(remoto, db, dopo)).toMatchObject({ daCapo: true, righe: 1 })
    expect(await db.gare.toArray()).toHaveLength(1)
    expect(await db.gare.get('R9')).toBeDefined()
  })

  it('fermo da poco: continua normalmente', async () => {
    await sincronizza(remoto, db, adesso)
    const dopo = () => ORA + (GIORNI_MASSIMI_FERMO - 1) * 86_400_000
    expect((await sincronizza(remoto, db, dopo)).daCapo).toBe(false)
  })

  it('senza rete lancia l’errore e non segna la sincronizzazione come riuscita', async () => {
    remoto.scrivi('gare', gara('R1'))
    remoto.errore = new TypeError('rete assente')
    await expect(sincronizza(remoto, db, adesso)).rejects.toThrow('rete assente')
    expect(await ultimaSincronizzazione(db)).toBeNull()

    // Appena torna la rete si riparte, e il primo giro scarica tutto.
    remoto.errore = null
    expect((await sincronizza(remoto, db, adesso)).righe).toBe(1)
  })

  it('svuota la copia (uscita dal telefono)', async () => {
    remoto.scrivi('gare', gara('R1'))
    await sincronizza(remoto, db, adesso)
    await svuotaDb(db)
    expect(await db.gare.count()).toBe(0)
    expect(await ultimaSincronizzazione(db)).toBeNull()
  })
})

describe('allenamento: nei due sensi', () => {
  const ATLETA = '10000000-0000-0000-0000-00000000000b'
  const riga = (giorno: string, dati: Record<string, unknown> = {}) => ({
    atleta_id: ATLETA,
    giorno,
    programma: '',
    fatto: false,
    frecce_libere: 0,
    nota: '',
    modificato_il: quando(600),
    ...dati,
  })
  /** Una modifica fatta sul telefono, in attesa di essere inviata. */
  const locale = (giorno: string, dati: Record<string, unknown> = {}) =>
    db.allenamento_giorni.put({ ...riga(giorno, dati), da_inviare: 1 })
  const chiave = (giorno: string): [string, string] => [ATLETA, giorno]

  beforeEach(() => {
    remoto.orologio = () => ORA
  })

  it('le modifiche fatte sul telefono vanno al server, che le conferma', async () => {
    await locale('2026-11-10', { programma: '60 frecce a 18 m', modificato_il: quando(5) })
    const esito = await sincronizza(remoto, db, adesso)
    expect(esito.inviate).toBe(1)
    expect(remoto.salvataggi).toHaveLength(1)
    // Il server non riceve il segno interno "da_inviare".
    expect(remoto.salvataggi[0]).not.toHaveProperty('da_inviare')
    const sulServer = remoto.righe.allenamento_giorni[0]!
    expect(sulServer).toMatchObject({
      programma: '60 frecce a 18 m',
      aggiornato_il: new Date(ORA).toISOString(),
    })
    // Sul telefono la riga non è più "da inviare" e ha la data del server.
    const salvata = (await db.allenamento_giorni.get(chiave('2026-11-10')))!
    expect(salvata.da_inviare).toBeUndefined()
    expect(salvata.aggiornato_il).toBe(new Date(ORA).toISOString())
  })

  it('niente da inviare: nessuna richiesta di salvataggio', async () => {
    remoto.scrivi('allenamento_giorni', riga('2026-11-10', { aggiornato_il: quando(500) }))
    await sincronizza(remoto, db, adesso)
    expect(remoto.salvataggi).toEqual([])
    expect((await db.allenamento_giorni.toArray()).length).toBe(1)
  })

  it('scarica l’allenamento scritto da un altro telefono', async () => {
    remoto.scrivi(
      'allenamento_giorni',
      riga('2026-11-11', { programma: 'riposo', aggiornato_il: quando(30) }),
    )
    await sincronizza(remoto, db, adesso)
    expect((await db.allenamento_giorni.get(chiave('2026-11-11')))?.programma).toBe('riposo')
  })

  it('vince la modifica più recente: se il server ne ha una più recente, il telefono si adegua', async () => {
    remoto.scrivi(
      'allenamento_giorni',
      riga('2026-11-10', {
        programma: 'dal telefono 2',
        modificato_il: quando(1),
        aggiornato_il: quando(1),
      }),
    )
    await locale('2026-11-10', { programma: 'dal telefono 1', modificato_il: quando(10) })
    await sincronizza(remoto, db, adesso)
    expect((await db.allenamento_giorni.get(chiave('2026-11-10')))?.programma).toBe(
      'dal telefono 2',
    )
  })

  it('vince la modifica più recente: se è quella del telefono, il server si adegua', async () => {
    remoto.scrivi(
      'allenamento_giorni',
      riga('2026-11-10', {
        programma: 'vecchia',
        modificato_il: quando(100),
        aggiornato_il: quando(100),
      }),
    )
    await locale('2026-11-10', { programma: 'nuova', modificato_il: quando(5) })
    await sincronizza(remoto, db, adesso)
    expect(remoto.righe.allenamento_giorni[0]!.programma).toBe('nuova')
    expect((await db.allenamento_giorni.get(chiave('2026-11-10')))?.programma).toBe('nuova')
  })

  it('una riga con modifiche non inviate non si sovrascrive col server (anche se l’invio non riesce)', async () => {
    remoto.scrivi(
      'allenamento_giorni',
      riga('2026-11-10', {
        programma: 'del server',
        aggiornato_il: quando(1),
        modificato_il: quando(1),
      }),
    )
    await locale('2026-11-10', { programma: 'scritta offline', modificato_il: quando(2) })
    remoto.salvaAllenamento = async () => {
      throw new Error('server in manutenzione')
    }
    await expect(sincronizza(remoto, db, adesso)).rejects.toThrow('server in manutenzione')
    const rimasta = (await db.allenamento_giorni.get(chiave('2026-11-10')))!
    expect(rimasta.programma).toBe('scritta offline')
    expect(rimasta.da_inviare).toBe(1)
    // Le altre novità si scaricano comunque: l'errore si segnala dopo.
    expect(await ultimaSincronizzazione(db)).toBe(ORA)
  })

  it('un invio che fallisce non ferma gli altri', async () => {
    await locale('2026-11-10', { programma: 'a', modificato_il: quando(3) })
    await locale('2026-11-11', { programma: 'b', modificato_il: quando(2) })
    const vero = remoto.salvaAllenamento.bind(remoto)
    remoto.salvaAllenamento = async (g) => {
      if (g.giorno === '2026-11-10') throw new Error('no')
      return vero(g)
    }
    await expect(sincronizza(remoto, db, adesso)).rejects.toThrow('no')
    expect((await db.allenamento_giorni.get(chiave('2026-11-11')))?.da_inviare).toBeUndefined()
    expect((await db.allenamento_giorni.get(chiave('2026-11-10')))?.da_inviare).toBe(1)
  })

  it('modificata di nuovo mentre si inviava: resta la versione locale, da inviare al giro dopo', async () => {
    await locale('2026-11-10', { programma: 'prima', modificato_il: quando(5) })
    const vero = remoto.salvaAllenamento.bind(remoto)
    remoto.salvaAllenamento = async (g) => {
      const risposta = await vero(g)
      // L'atleta scrive ancora, mentre l'invio è in corso.
      await db.allenamento_giorni.put({
        ...riga('2026-11-10', { programma: 'dopo', modificato_il: quando(1) }),
        da_inviare: 1,
      })
      return risposta
    }
    await sincronizza(remoto, db, adesso)
    expect((await db.allenamento_giorni.get(chiave('2026-11-10')))?.programma).toBe('dopo')
    expect((await db.allenamento_giorni.get(chiave('2026-11-10')))?.da_inviare).toBe(1)

    remoto.salvaAllenamento = vero
    await sincronizza(remoto, db, adesso)
    expect(remoto.righe.allenamento_giorni[0]!.programma).toBe('dopo')
    expect((await db.allenamento_giorni.get(chiave('2026-11-10')))?.da_inviare).toBeUndefined()
  })

  it('telefono fermo da molto con modifiche da inviare: non si perde niente', async () => {
    await sincronizza(remoto, db, adesso)
    await locale('2026-11-10', { programma: 'scritta offline', modificato_il: quando(5) })
    const molto = () => ORA + (GIORNI_MASSIMI_FERMO + 1) * 86_400_000
    // Il server non risponde: non si riparte da zero (si perderebbe la modifica).
    remoto.salvaAllenamento = async () => {
      throw new Error('offline')
    }
    await expect(sincronizza(remoto, db, molto)).rejects.toThrow('offline')
    expect((await db.allenamento_giorni.get(chiave('2026-11-10')))?.programma).toBe(
      'scritta offline',
    )
  })

  it('all’uscita la copia dell’allenamento si svuota con tutto il resto', async () => {
    await locale('2026-11-10', { programma: 'x' })
    await svuotaDb(db)
    expect(await db.allenamento_giorni.count()).toBe(0)
  })
})
