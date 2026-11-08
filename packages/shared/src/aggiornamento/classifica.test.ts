import { describe, expect, it } from 'vitest'
import {
  chiaveClassifica,
  controllaRanking,
  dataItaliana,
  filtroDaChiave,
  filtroValido,
  MASSIMO_LETTURE_ORA,
  pianificaClassifiche,
  PAUSA_DOPO_BLOCCO_MS,
  valutaAggiornamento,
  type ClassificaScaricata,
  type CombinazioneRanking,
} from '../aggiornamento'

const nostra = (tipo: 'I' | 'T' | 'C' | '3', divisione = 'OL'): CombinazioneRanking => ({
  tipo,
  divisione,
  classe: 'S',
  genere: 'M',
  atleti: ['a1'],
})
const scaricata = (
  tipo: 'I' | 'T' | 'C' | '3',
  letta_il: string,
  divisione = 'OL',
): ClassificaScaricata => ({
  tipo,
  divisione,
  classe: 'S',
  genere: 'M',
  letta_il,
})

describe('filtri', () => {
  it('chiave e filtro si convertono a vicenda', () => {
    const f = { tipo: 'I', divisione: 'OL', classe: 'S', genere: 'M' } as const
    expect(chiaveClassifica(f)).toBe('I|OL|S|M')
    expect(filtroDaChiave('I|OL|S|M')).toEqual(f)
  })

  it('valori sconosciuti o chiavi storte non passano', () => {
    expect(filtroValido({ tipo: 'X', divisione: 'OL', classe: 'S', genere: 'M' })).toBe(false)
    expect(filtroValido({ tipo: 'I', divisione: 'ZZ', classe: 'S', genere: 'M' })).toBe(false)
    expect(filtroValido({ tipo: 'I', divisione: 'OL', classe: 'G', genere: 'M' })).toBe(false)
    expect(filtroValido({ tipo: 'I', divisione: 'OL', classe: 'S', genere: 'X' })).toBe(false)
    expect(filtroValido({})).toBe(false)
    expect(filtroDaChiave('I|OL|S')).toBeNull()
    expect(filtroDaChiave('I|OL|S|M|extra')).toBeNull()
    expect(filtroDaChiave("I|OL|S|M'; drop table x;--")).toBeNull()
  })
})

describe('data e ora in Italia', () => {
  it('lunedì 9 novembre 2026, ora italiana (inverno: UTC+1)', () => {
    expect(dataItaliana(new Date('2026-11-09T09:00:00Z'))).toEqual({
      giorno: '2026-11-09',
      settimana: 1,
      ora: 10,
    })
  })
  it('d’estate è UTC+2, e a mezzanotte cambia il giorno', () => {
    expect(dataItaliana(new Date('2026-07-05T22:30:00Z'))).toEqual({
      giorno: '2026-07-06',
      settimana: 1,
      ora: 0,
    })
  })
  it('domenica è il 7', () => {
    expect(dataItaliana(new Date('2026-11-08T12:00:00Z')).settimana).toBe(7)
  })
})

describe('pianificaClassifiche', () => {
  // Lunedì 9 novembre 2026.
  const LUNEDI_9 = new Date('2026-11-09T08:59:00Z') // 9:59 in Italia
  const LUNEDI_10 = new Date('2026-11-09T09:00:00Z') // 10:00
  const MARTEDI = new Date('2026-11-10T10:00:00Z')

  it('una nostra classifica mai scaricata si mette in lista subito, qualunque giorno', () => {
    expect(pianificaClassifiche(MARTEDI, [nostra('I')], [])).toEqual([
      { tipo: 'ranking', chiave: 'I|OL|S|M', priorita: 25 },
    ])
  })

  it('negli altri giorni le classifiche già scaricate non si rileggono', () => {
    const lette = [scaricata('I', '2026-11-02T09:30:00Z'), scaricata('T', '2026-11-02T09:30:00Z')]
    expect(pianificaClassifiche(MARTEDI, [nostra('I')], lette)).toEqual([])
  })

  it('il lunedì prima delle 10 non parte niente', () => {
    expect(
      pianificaClassifiche(LUNEDI_9, [nostra('I')], [scaricata('I', '2026-11-02T09:30:00Z')]),
    ).toEqual([])
  })

  it('il lunedì dalle 10: le nostre e quelle già scaricate col pulsante, se non lette oggi', () => {
    const lette = [
      scaricata('I', '2026-11-02T09:30:00Z'),
      scaricata('T', '2026-11-02T09:30:00Z', 'CO'), // scaricata da qualcuno con il pulsante
      scaricata('C', '2026-11-09T09:05:00Z'), // già letta oggi
    ]
    const piano = pianificaClassifiche(LUNEDI_10, [nostra('I'), nostra('C')], lette)
    expect(piano.map((l) => l.chiave).sort()).toEqual(['I|OL|S|M', 'T|CO|S|M'])
  })

  it('una lettura fatta lunedì sera tardi conta come di lunedì (il giorno è quello italiano)', () => {
    const lette = [scaricata('I', '2026-11-09T22:30:00Z')] // lunedì 23:30 in Italia
    expect(pianificaClassifiche(new Date('2026-11-09T22:40:00Z'), [nostra('I')], lette)).toEqual([])
  })
})

describe('valutaAggiornamento', () => {
  const adesso = new Date('2026-11-10T10:00:00Z')
  const base = {
    adesso,
    lettaIl: null as string | null,
    lettureUltimaOra: 0,
    ultimoBlocco: null as number | null,
    pausaDopoBloccoMs: PAUSA_DOPO_BLOCCO_MS,
  }

  it('mai letta, nessun freno: si può', () => {
    expect(valutaAggiornamento(base)).toEqual({ consentita: true })
  })

  it('letta meno di 6 ore fa: troppo presto, con l’ora per riprovare', () => {
    const v = valutaAggiornamento({ ...base, lettaIl: '2026-11-10T06:30:00Z' })
    expect(v).toEqual({
      consentita: false,
      motivo: 'troppo-presto',
      riprovaDopo: '2026-11-10T12:30:00.000Z',
    })
  })

  it('letta più di 6 ore fa: si può', () => {
    expect(valutaAggiornamento({ ...base, lettaIl: '2026-11-10T03:59:00Z' })).toEqual({
      consentita: true,
    })
  })

  it('tetto orario per tutta la compagnia', () => {
    const v = valutaAggiornamento({ ...base, lettureUltimaOra: MASSIMO_LETTURE_ORA })
    expect(v).toMatchObject({ consentita: false, motivo: 'troppe-richieste' })
    expect(valutaAggiornamento({ ...base, lettureUltimaOra: MASSIMO_LETTURE_ORA - 1 })).toEqual({
      consentita: true,
    })
  })

  it('Fitarco non rispondeva da poco: ci si ferma, anche se la classifica è vecchia', () => {
    const blocco = adesso.getTime() - 3_600_000
    expect(valutaAggiornamento({ ...base, ultimoBlocco: blocco })).toEqual({
      consentita: false,
      motivo: 'fitarco-non-risponde',
      riprovaDopo: new Date(blocco + PAUSA_DOPO_BLOCCO_MS).toISOString(),
    })
    expect(
      valutaAggiornamento({ ...base, ultimoBlocco: adesso.getTime() - PAUSA_DOPO_BLOCCO_MS - 1 }),
    ).toEqual({ consentita: true })
  })
})

describe('controllaRanking', () => {
  it('i conti devono tornare con quello che dichiara Fitarco', () => {
    expect(controllaRanking(421, 421, null)).toBeNull()
    expect(controllaRanking(400, 421, null)).toContain('dichiara 421 atleti ma ne ho letti 400')
  })
  it('non si svuota né si dimezza rispetto a quella salvata', () => {
    expect(controllaRanking(0, 0, 400)).toContain('è vuota')
    expect(controllaRanking(150, 150, 400)).toContain('ne aveva 400')
    expect(controllaRanking(300, 300, 400)).toBeNull()
    expect(controllaRanking(0, 0, null)).toBeNull()
    expect(controllaRanking(0, 0, 0)).toBeNull()
  })
})
