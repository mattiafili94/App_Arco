import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { creaRemotoSupabase } from './remotoSupabase'

/** Cliente Supabase finto: registra le chiamate della richiesta e risponde con quello che si indica. */
function clienteFinto(risposta: { data: unknown; error: { message: string } | null }) {
  const chiamate: string[] = []
  const richiesta = {
    select: (colonne: string) => (chiamate.push(`select ${colonne}`), richiesta),
    gte: (c: string, v: string) => (chiamate.push(`gte ${c} ${v}`), richiesta),
    gt: (c: string, v: number) => (chiamate.push(`gt ${c} ${v}`), richiesta),
    order: (c: string, o: { ascending: boolean }) => (
      chiamate.push(`order ${c} ${o.ascending ? 'asc' : 'desc'}`),
      richiesta
    ),
    range: (da: number, a: number) => (
      chiamate.push(`range ${da}-${a}`),
      Promise.resolve(risposta)
    ),
    limit: (n: number) => (chiamate.push(`limit ${n}`), Promise.resolve(risposta)),
  }
  const cliente = { from: (t: string) => (chiamate.push(`from ${t}`), richiesta) }
  return { cliente: cliente as unknown as SupabaseClient, chiamate }
}

describe('sincronizzazione con Supabase', () => {
  it('chiede le righe cambiate, in ordine stabile e a pagine', async () => {
    const { cliente, chiamate } = clienteFinto({ data: [{ codice: 'R1' }], error: null })
    const righe = await creaRemotoSupabase(cliente).cambiamenti(
      'classifiche',
      '2026-11-01T00:00:00.000Z',
      1000,
      1000,
    )
    expect(righe).toEqual([{ codice: 'R1' }])
    expect(chiamate).toEqual([
      'from classifiche',
      'select *',
      'gte aggiornato_il 2026-11-01T00:00:00.000Z',
      'order aggiornato_il asc',
      'order gara_codice asc',
      'order categoria asc',
      'order ordine asc',
      'range 1000-1999',
    ])
  })

  it('senza data scarica tutto; per gli atleti solo le colonne che servono', async () => {
    const { cliente, chiamate } = clienteFinto({ data: [], error: null })
    await creaRemotoSupabase(cliente).cambiamenti('atleti', null, 0, 1000)
    expect(chiamate[1]).toBe(
      'select id, matricola, nome, cognome, ruolo, attivo, ha_accesso, classe, genere, aggiornato_il',
    )
    expect(chiamate.some((c) => c.startsWith('gte'))).toBe(false)
    expect(chiamate.at(-1)).toBe('range 0-999')
  })

  it('legge il registro delle eliminazioni dopo un certo punto', async () => {
    const dati = [{ id: 5, tabella: 'gare', chiave: { codice: 'R1' } }]
    const { cliente, chiamate } = clienteFinto({ data: dati, error: null })
    expect(await creaRemotoSupabase(cliente).eliminazioni(4, 1000)).toEqual(dati)
    expect(chiamate).toEqual([
      'from eliminazioni',
      'select id, tabella, chiave',
      'gt id 4',
      'order id asc',
      'limit 1000',
    ])
  })

  it('l’ultima eliminazione: l’id più alto, o 0 se il registro è vuoto', async () => {
    const piena = clienteFinto({ data: [{ id: 42 }], error: null })
    expect(await creaRemotoSupabase(piena.cliente).ultimaEliminazione()).toBe(42)
    expect(piena.chiamate).toContain('order id desc')
    const vuota = clienteFinto({ data: [], error: null })
    expect(await creaRemotoSupabase(vuota.cliente).ultimaEliminazione()).toBe(0)
  })

  it('salva un giorno di allenamento con la funzione del server e restituisce la riga che vale', async () => {
    const giorno = {
      atleta_id: 'a1',
      giorno: '2026-11-10',
      programma: '60 frecce',
      fatto: true,
      frecce_libere: 60,
      nota: 'bene',
      modificato_il: '2026-11-10T10:00:00.000Z',
    }
    const chiamate: [string, unknown][] = []
    const cliente = {
      rpc: async (nome: string, argomenti: unknown) => {
        chiamate.push([nome, argomenti])
        return { data: { ...giorno, aggiornato_il: '2026-11-10T10:00:01+00:00' }, error: null }
      },
    } as unknown as SupabaseClient
    const r = await creaRemotoSupabase(cliente).salvaAllenamento(giorno)
    expect(r.aggiornato_il).toBe('2026-11-10T10:00:01+00:00')
    expect(chiamate).toEqual([
      [
        'salva_allenamento_giorno',
        {
          p_atleta: 'a1',
          p_giorno: '2026-11-10',
          p_programma: '60 frecce',
          p_fatto: true,
          p_frecce_libere: 60,
          p_nota: 'bene',
          p_modificato_il: '2026-11-10T10:00:00.000Z',
        },
      ],
    ])
  })

  it('un errore nel salvataggio dell’allenamento si segnala (la riga resta da inviare)', async () => {
    const cliente = {
      rpc: async () => ({ data: null, error: { message: 'Accesso non valido' } }),
    } as unknown as SupabaseClient
    await expect(
      creaRemotoSupabase(cliente).salvaAllenamento({
        atleta_id: 'a1',
        giorno: '2026-11-10',
        programma: '',
        fatto: false,
        frecce_libere: 0,
        nota: '',
        modificato_il: '2026-11-10T10:00:00.000Z',
      }),
    ).rejects.toThrow('Accesso non valido')
  })

  it('salva una simulazione di gara con la funzione del server', async () => {
    const simulazione = {
      id: '20000000-0000-0000-0000-000000000001',
      atleta_id: 'a1',
      giorno: '2026-11-12',
      formato: '70m' as const,
      distanza: 60 as const,
      bersaglio: '122' as const,
      frecce: ['X', '10'] as ('X' | '10')[],
      conclusa: false,
      eliminata: false,
      creata_il: '2026-11-12T08:00:00.000Z',
      modificato_il: '2026-11-12T09:00:00.000Z',
    }
    const chiamate: [string, unknown][] = []
    const cliente = {
      rpc: async (nome: string, argomenti: unknown) => {
        chiamate.push([nome, argomenti])
        return { data: { ...simulazione, aggiornato_il: '2026-11-12T09:00:01+00:00' }, error: null }
      },
    } as unknown as SupabaseClient
    const r = await creaRemotoSupabase(cliente).salvaSimulazione(simulazione)
    expect(r.aggiornato_il).toBe('2026-11-12T09:00:01+00:00')
    expect(chiamate).toEqual([
      [
        'salva_simulazione',
        {
          p_id: simulazione.id,
          p_atleta: 'a1',
          p_giorno: '2026-11-12',
          p_formato: '70m',
          p_distanza: 60,
          p_bersaglio: '122',
          p_frecce: ['X', '10'],
          p_conclusa: false,
          p_eliminata: false,
          p_creata_il: '2026-11-12T08:00:00.000Z',
          p_modificato_il: '2026-11-12T09:00:00.000Z',
        },
      ],
    ])
  })

  it('un errore nel salvataggio della simulazione si segnala (la riga resta da inviare)', async () => {
    const cliente = {
      rpc: async () => ({ data: null, error: { message: 'Accesso non valido' } }),
    } as unknown as SupabaseClient
    await expect(
      creaRemotoSupabase(cliente).salvaSimulazione({
        id: 'x',
        atleta_id: 'a1',
        giorno: '2026-11-12',
        formato: '18m',
        distanza: null,
        bersaglio: 'trispot',
        frecce: [],
        conclusa: false,
        eliminata: false,
        creata_il: '2026-11-12T08:00:00.000Z',
        modificato_il: '2026-11-12T09:00:00.000Z',
      }),
    ).rejects.toThrow('Accesso non valido')
  })

  it('un errore del server ferma la sincronizzazione', async () => {
    const { cliente } = clienteFinto({ data: null, error: { message: 'JWT scaduto' } })
    await expect(creaRemotoSupabase(cliente).cambiamenti('gare', null, 0, 10)).rejects.toThrow(
      'JWT scaduto',
    )
  })
})
