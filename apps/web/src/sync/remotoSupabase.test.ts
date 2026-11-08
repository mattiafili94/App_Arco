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
      'select id, matricola, nome, cognome, ruolo, attivo, classe, genere, aggiornato_il',
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

  it('un errore del server ferma la sincronizzazione', async () => {
    const { cliente } = clienteFinto({ data: null, error: { message: 'JWT scaduto' } })
    await expect(creaRemotoSupabase(cliente).cambiamenti('gare', null, 0, 10)).rejects.toThrow(
      'JWT scaduto',
    )
  })
})
