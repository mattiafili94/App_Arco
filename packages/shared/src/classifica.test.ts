import { describe, expect, it } from 'vitest'
import {
  descriviGareRanking,
  descriviLettura,
  eUmbria,
  filtraClassifica,
  formattaPunti,
  messaggioAggiornamento,
  percorsoClassifica,
  titoloClassifica,
} from './classifica'
import type { RigaClassificaRanking } from './aggiornamento'

const riga = (
  posizione: number,
  nome: string,
  societa_codice: string,
  societa_nome: string,
  punti = 1000,
): RigaClassificaRanking => ({
  posizione,
  matricola: `9${posizione}`,
  nome,
  societa_codice,
  societa_nome,
  punti,
  gare: [
    { codice: 'G1', punti: 564, localita: 'Terni (TR)', dal: '2026-03-14', al: '2026-03-15' },
    { codice: 'G2', punti: 554, localita: 'Roma (RM)', dal: '2026-02-26', al: '2026-03-01' },
  ],
})

const RIGHE = [
  riga(1, 'Dall’Oglio Gianluca', '12187', 'Fiamme Gialle'),
  riga(2, 'Rossi Mario', '11003', 'A.S.D. Compagnia Arcieri Eugubini'),
  riga(3, 'Verdi Luca', '11004', 'Arcieri di Assisi'),
  riga(4, 'Bianchi José', '05001', 'Arcieri del Nord'),
]

describe('titoli e indirizzi', () => {
  const f = { tipo: 'I', divisione: 'OL', classe: 'S', genere: 'M' } as const
  it('titolo e indirizzo di una classifica', () => {
    expect(titoloClassifica(f)).toBe('Indoor · Ricurvo · Senior M')
    expect(titoloClassifica({ tipo: '3', divisione: 'CO', classe: 'J', genere: 'F' })).toBe(
      '3D · Compound · Junior F',
    )
    expect(percorsoClassifica(f)).toBe('/classifica/I/OL/S/M')
  })
  it('valori sconosciuti restano com’erano', () => {
    expect(
      titoloClassifica({ tipo: 'T', divisione: 'ZZ', classe: 'X', genere: 'F' } as never),
    ).toBe('Outdoor · ZZ · X F')
  })
})

describe('filtraClassifica', () => {
  it('senza filtri restituisce tutto', () => {
    expect(filtraClassifica(RIGHE, {})).toHaveLength(4)
    expect(filtraClassifica(RIGHE, { testo: '   ' })).toHaveLength(4)
  })

  it('cerca nel nome e nella società, senza badare a maiuscole e accenti', () => {
    expect(filtraClassifica(RIGHE, { testo: 'rossi' }).map((r) => r.posizione)).toEqual([2])
    expect(filtraClassifica(RIGHE, { testo: 'jose' }).map((r) => r.posizione)).toEqual([4])
    expect(filtraClassifica(RIGHE, { testo: 'eugubini' }).map((r) => r.posizione)).toEqual([2])
    expect(filtraClassifica(RIGHE, { testo: 'dall oglio' }).map((r) => r.posizione)).toEqual([1])
    expect(filtraClassifica(RIGHE, { testo: 'dall’oglio' }).map((r) => r.posizione)).toEqual([1])
  })

  it('più parole: devono esserci tutte, in qualunque ordine', () => {
    expect(filtraClassifica(RIGHE, { testo: 'mario rossi' }).map((r) => r.posizione)).toEqual([2])
    expect(filtraClassifica(RIGHE, { testo: 'mario verdi' })).toEqual([])
  })

  it('solo Umbria: società con codice che inizia per 11, posizioni nazionali invariate', () => {
    const umbre = filtraClassifica(RIGHE, { soloUmbria: true })
    expect(umbre.map((r) => r.posizione)).toEqual([2, 3])
    expect(eUmbria(RIGHE[0]!)).toBe(false)
    expect(eUmbria(RIGHE[1]!)).toBe(true)
    expect(filtraClassifica(RIGHE, { soloUmbria: true, testo: 'assisi' })).toHaveLength(1)
  })
})

describe('testi', () => {
  it('le due gare con i loro punti', () => {
    expect(descriviGareRanking(RIGHE[0]!)).toBe('Terni (TR) 564 · Roma (RM) 554')
    expect(descriviGareRanking({ gare: [] })).toBe('')
  })

  it('punti all’italiana', () => {
    expect(formattaPunti(1060)).toBe('1.060')
    expect(formattaPunti(980)).toBe('980')
    expect(formattaPunti(1189)).toBe('1.189')
    expect(formattaPunti(1234567)).toBe('1.234.567')
  })

  describe('quando è stata letta', () => {
    const adesso = new Date(2026, 10, 10, 15, 0)
    it('oggi, ieri, un altro giorno (anche di un altro anno)', () => {
      expect(descriviLettura(new Date(2026, 10, 10, 10, 12).toISOString(), adesso)).toBe(
        'oggi alle 10:12',
      )
      expect(descriviLettura(new Date(2026, 10, 9, 9, 5).toISOString(), adesso)).toBe(
        'ieri alle 09:05',
      )
      expect(descriviLettura(new Date(2026, 10, 2, 10, 0).toISOString(), adesso)).toBe(
        '2 nov alle 10:00',
      )
      expect(descriviLettura(new Date(2025, 11, 20, 18, 30).toISOString(), adesso)).toBe(
        '20 dic 2025 alle 18:30',
      )
    })
  })

  describe('messaggio dopo "Aggiorna"', () => {
    const adesso = new Date(2026, 10, 10, 15, 0)
    it('riuscito', () => {
      expect(messaggioAggiornamento({ esito: 'ok', atleti: 421, lettaIl: 'x' })).toEqual({
        tipo: 'success',
        testo: 'Classifica aggiornata: 421 atleti.',
      })
    })
    it('senza rete', () => {
      expect(messaggioAggiornamento({ esito: 'rete' })).toMatchObject({ tipo: 'warning' })
    })
    it('rifiuti con l’ora per riprovare', () => {
      const m = messaggioAggiornamento(
        {
          esito: 'troppo-presto',
          errore: 'Aggiornata da poco.',
          riprovaDopo: new Date(2026, 10, 10, 18, 30).toISOString(),
        },
        adesso,
      )
      expect(m).toEqual({ tipo: 'warning', testo: 'Aggiornata da poco. Riprova oggi alle 18:30.' })
      expect(
        messaggioAggiornamento({ esito: 'fitarco-non-risponde', errore: 'Non risponde.' }, adesso),
      ).toEqual({ tipo: 'warning', testo: 'Non risponde.' })
    })
    it('errori e anomalie', () => {
      expect(messaggioAggiornamento({ esito: 'errore', errore: 'Non riuscito.' })).toEqual({
        tipo: 'error',
        testo: 'Non riuscito.',
      })
      expect(messaggioAggiornamento({ esito: 'anomalia', errore: 'Strano.' }).tipo).toBe('error')
    })
  })
})
