import { describe, expect, it } from 'vitest'
import {
  descriviConteggi,
  descriviPosizione,
  descriviPunteggi,
  eNostro,
  formattaNome,
  raggruppaPerCategoria,
  type RigaClassifica,
} from './risultati'

const riga = (dati: Partial<RigaClassifica> = {}): RigaClassifica => ({
  gara_codice: 'R2611039',
  categoria: 'Arco Ricurvo - Senior Maschile',
  divisione: 'OL',
  ordine: 1,
  posizione: 1,
  esito: '1',
  cognome: 'ROSSI',
  nome: 'Mario',
  societa_codice: '11004',
  societa_nome: 'Arcieri di Assisi',
  parziali: [
    { colonna: '18m-1', punti: 280, posizione: 1 },
    { colonna: '18m-2', punti: 272, posizione: 1 },
  ],
  prove: [],
  totale: 552,
  conteggi: [21, 26],
  colonne_conteggi: ['10', '9'],
  atleta_id: null,
  provvisoria: false,
  ...dati,
})

const prova = (colonne: [string, string], punti: [number, number]) => ({
  parziali: [
    { colonna: colonne[0], punti: punti[0], posizione: 1 },
    { colonna: colonne[1], punti: punti[1], posizione: 1 },
  ],
  totale: punti[0] + punti[1],
})

describe('nomi', () => {
  it('il cognome in maiuscolo diventa leggibile, anche con apostrofi e cognomi doppi', () => {
    expect(formattaNome(riga())).toBe('Rossi Mario')
    expect(formattaNome(riga({ cognome: "D'AMARIO", nome: 'Teresa' }))).toBe("D'Amario Teresa")
    expect(formattaNome(riga({ cognome: 'DE LUCA', nome: 'Gian Luca' }))).toBe('De Luca Gian Luca')
    expect(formattaNome(riga({ cognome: 'DA TOS-BIANCHI', nome: '' }))).toBe('Da Tos-Bianchi')
  })
})

describe('punteggi e conteggi', () => {
  it('gara semplice: i parziali; una sola colonna coincide con il totale', () => {
    expect(descriviPunteggi(riga())).toBe('280 + 272')
    expect(
      descriviPunteggi(riga({ parziali: [{ colonna: 'H&F', punti: 343, posizione: 1 }] })),
    ).toBe('')
  })

  it('25+18: una voce per prova, con la distanza', () => {
    const prove = [prova(['25m-1', '25m-2'], [167, 105]), prova(['18m-1', '18m-2'], [188, 190])]
    expect(descriviPunteggi(riga({ parziali: [], prove }))).toBe('272 (25 m) + 378 (18 m)')
  })

  it('doppio 70 m: le due prove, senza ripetere la distanza', () => {
    const prove = [prova(['70m-1', '70m-2'], [281, 271]), prova(['70m-3', '70m-4'], [278, 277])]
    expect(descriviPunteggi(riga({ parziali: [], prove }))).toBe('552 + 555')
  })

  it('i conteggi usano i nomi delle colonne della gara', () => {
    expect(descriviConteggi(riga())).toBe('10: 21 · 9: 26')
    expect(descriviConteggi(riga({ conteggi: [13, 3], colonne_conteggi: ['10+X', 'X'] }))).toBe(
      '10+X: 13 · X: 3',
    )
  })

  it('la posizione, o l’esito se non classificato', () => {
    expect(descriviPosizione(riga({ posizione: 4 }))).toBe('4°')
    expect(descriviPosizione(riga({ posizione: null, esito: 'DNF' }))).toBe('DNF')
  })
})

describe('categorie', () => {
  it('un atleta è nostro se riconosciuto o della società della compagnia', () => {
    expect(eNostro(riga({ atleta_id: 'a1' }), '11003')).toBe(true)
    expect(eNostro(riga({ societa_codice: '11003' }), '11003')).toBe(true)
    expect(eNostro(riga(), '11003')).toBe(false)
  })

  it('raggruppa per categoria in ordine alfabetico, ogni categoria come nel PDF, e conta i nostri', () => {
    const righe = [
      riga({
        categoria: 'Arco Ricurvo - Senior Maschile',
        ordine: 2,
        cognome: 'BIANCHI',
        societa_codice: '11003',
      }),
      riga({ categoria: 'Arco Compound - Senior Maschile', ordine: 1 }),
      riga({ categoria: 'Arco Ricurvo - Senior Maschile', ordine: 1 }),
    ]
    const categorie = raggruppaPerCategoria(righe, '11003')
    expect(categorie.map((c) => [c.nome, c.nostri, c.righe.map((r) => r.cognome)])).toEqual([
      ['Arco Compound - Senior Maschile', 0, ['ROSSI']],
      ['Arco Ricurvo - Senior Maschile', 1, ['ROSSI', 'BIANCHI']],
    ])
    expect(raggruppaPerCategoria([], '11003')).toEqual([])
  })
})
