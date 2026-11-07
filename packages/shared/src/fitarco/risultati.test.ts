import { describe, expect, it } from 'vitest'
import { ErroreFormatoFitarco, leggiRisultati, type RigaTesto } from '../fitarco'
import { esempioRisultati, type EsempioRisultati } from './esempi'

const leggi = (nome: EsempioRisultati) => leggiRisultati(esempioRisultati(nome))
const atleti = (nome: EsempioRisultati) => leggi(nome).categorie.flatMap((c) => c.atleti)

describe('lettore dei PDF dei risultati: tutti i tipi di gara', () => {
  it.each([
    ['18m', 'R2611039', 23, 93, 9],
    ['70m', 'R2611015', 20, 63, 7],
    ['12+12', 'R2611012', 20, 102, 9],
    ['3d', 'R2611018', 9, 35, 0],
    ['doppio-70m', 'R2611032', 13, 38, 0],
    ['24+24', 'R2211013', 17, 56, 0],
    ['25+18', 'R2611038', 14, 28, 0],
  ] as const)(
    '%s: codice, categorie, atleti ed Eugubini',
    (nome, codice, categorie, totale, eugubini) => {
      const r = leggi(nome)
      expect(r.codiceGara).toBe(codice)
      expect(r.categorie).toHaveLength(categorie)
      const tutti = r.categorie.flatMap((c) => c.atleti)
      expect(tutti).toHaveLength(totale)
      expect(tutti.filter((a) => a.societa.codice === '11003')).toHaveLength(eugubini)
    },
  )

  it("legge l'intestazione della gara", () => {
    expect(leggi('18m')).toMatchObject({
      titolo: 'Torneo Indoor "Città di Gubbio"',
      organizzatore: 'A.S.D. Compagnia Arcieri Eugubini',
      luogoData: 'CVA "San Marco" Loc. San Marco, Gubbio (PG), Dal 24-10-2026 al 25-10-2026',
    })
  })

  it('18 m: parziali con posizione, totale e conteggi 10 e 9', () => {
    const c = leggi('18m').categorie[0]!
    expect(c).toMatchObject({
      nome: 'Arco Ricurvo - Senior Maschile',
      divisione: 'OL',
      classe: 'Senior Maschile',
      colonneParziali: ['18m-1', '18m-2'],
      colonneProve: [],
      colonneConteggi: ['10', '9'],
    })
    expect(c.atleti[0]).toEqual({
      posizione: 1,
      esito: '1',
      turno: '2-7A',
      nomeCompleto: 'PROVA Mario',
      cognome: 'PROVA',
      nome: 'Mario',
      classeAtleta: null,
      categoria: '02',
      societa: { codice: '11004', nome: 'A.S.D. Arcieri di Assisi' },
      parziali: [
        { colonna: '18m-1', punti: 280, posizione: 1 },
        { colonna: '18m-2', punti: 272, posizione: 1 },
      ],
      prove: [],
      totale: 552,
      conteggi: [21, 26],
    })
  })

  it('70 m: le distanze cambiano con la classe, conteggi 10+X e X', () => {
    const r = leggi('70m')
    const colonne = new Set(r.categorie.map((c) => c.colonneParziali[0]))
    expect(colonne).toEqual(new Set(['70m-1', '60m-1', '50m-1', '40m-1', '25m-1']))
    expect(r.categorie[0]!.colonneConteggi).toEqual(['10+X', 'X'])
  })

  it('un atleta ritirato (DNF) non ha posizione e un parziale non ha classifica', () => {
    const dnf = atleti('70m').find((a) => a.esito === 'DNF')!
    expect(dnf).toMatchObject({ posizione: null, totale: 199 })
    expect(dnf.parziali.map((p) => p.posizione)).toEqual([8, null])
  })

  it('campagna e 3D: un solo parziale (H&F, Perc.) oppure Hunter e Field (24+24)', () => {
    expect(leggi('12+12').categorie[0]).toMatchObject({
      colonneParziali: ['H&F'],
      colonneConteggi: ['6', '5'],
    })
    expect(leggi('3d').categorie[0]).toMatchObject({
      colonneParziali: ['Perc.'],
      colonneConteggi: ['11', '10'],
    })
    expect(leggi('24+24').categorie[0]).toMatchObject({ colonneParziali: ['Hunter', 'Field'] })
  })

  it('riconosce tutte le divisioni, anche "Arco Olimpico" dei PDF vecchi', () => {
    expect(leggi('24+24').categorie[0]).toMatchObject({
      nome: 'Arco Olimpico - Senior Maschile',
      divisione: 'OL',
    })
    const divisioni = new Set(
      ['3d', '12+12'].flatMap((n) =>
        leggi(n as EsempioRisultati).categorie.map((c) => c.divisione),
      ),
    )
    expect(divisioni).toEqual(new Set(['AI', 'CO', 'AN', 'LB', 'OL']))
    expect(leggi('3d').categorie.map((c) => c.classe)).toContain('Over 20 Maschile')
  })

  it('unisce le categorie che continuano nella pagina dopo ("… Continua")', () => {
    for (const nome of ['70m', '12+12'] as const) {
      const nomi = leggi(nome).categorie.map((c) => c.nome)
      expect(nomi.some((n) => n.endsWith('Continua'))).toBe(false)
      expect(new Set(nomi).size).toBe(nomi.length)
    }
  })

  it('separa la classe dell’atleta e accetta righe senza categoria', () => {
    const conClasse = atleti('70m').find((a) => a.classeAtleta === 'MF')!
    expect(conClasse).toMatchObject({
      nomeCompleto: 'BIANCHI Anna MF',
      nome: 'Anna',
      cognome: 'BIANCHI',
    })
    expect(atleti('12+12').filter((a) => a.categoria === null)).toHaveLength(1)
    expect(atleti('18m').some((a) => a.cognome.startsWith('DE ') && a.nome.includes(' '))).toBe(
      true,
    )
  })

  it.each(['doppio-70m', '25+18'] as const)(
    '%s: due prove per atleta, la cui somma fa il totale',
    (nome) => {
      const r = leggi(nome)
      for (const c of r.categorie) {
        expect(c.colonneProve).toHaveLength(2)
        for (const a of c.atleti) {
          expect(a.prove).toHaveLength(2)
          expect(a.prove[0]!.totale + a.prove[1]!.totale).toBe(a.totale)
        }
      }
    },
  )

  it('25+18: la prima prova è a 25 m, la seconda a 18 m (record separati)', () => {
    const c = leggi('25+18').categorie[0]!
    expect(c.colonneProve).toEqual([
      ['25m-1', '25m-2'],
      ['18m-1', '18m-2'],
    ])
    expect(c.atleti[0]!.prove).toEqual([
      {
        parziali: [
          { colonna: '25m-1', punti: 167, posizione: 1 },
          { colonna: '25m-2', punti: 105, posizione: 1 },
        ],
        totale: 272,
      },
      {
        parziali: [
          { colonna: '18m-1', punti: 188, posizione: 1 },
          { colonna: '18m-2', punti: 190, posizione: 1 },
        ],
        totale: 378,
      },
    ])
  })

  it('doppio 70 m: totale con il punto delle migliaia', () => {
    const a = leggi('doppio-70m').categorie[0]!.atleti[0]!
    expect(a.totale).toBe(1107)
    expect(a.prove.map((p) => p.totale)).toEqual([552, 555])
  })
})

// --- Formati inattesi: il lettore si ferma (sentinella) ------------------------------------------

const r = (y: number, testo: string, pagina = 1): RigaTesto => ({ pagina, y, testo })
const testata = [
  r(800, 'Gara di prova'),
  r(790, 'Società (R0000001)'),
  r(780, 'Gubbio, 01-01-2027'),
]
const semplice = (...righe: RigaTesto[]) =>
  leggiRisultati([
    ...testata,
    r(700, 'Arco Ricurvo - Senior Maschile'),
    r(690, 'Pos. Atleta Cat. Società 18m-1 18m-2 Totale 10 9'),
    ...righe,
  ])
const composta = (...righe: RigaTesto[]) =>
  leggiRisultati([
    ...testata,
    r(700, 'Arco Ricurvo - Senior Maschile'),
    r(690, '25m-1 25m-2 Tot.'),
    r(684, 'Pos. Atleta Cat. Società Totale 10 9'),
    r(678, '18m-1 18m-2 Tot.'),
    ...righe,
  ])
const ATLETA = '1 1- 1A PROVA Mario 02 11003 Arcieri Eugubini 280/ 1 272/ 1 552 21 26'

describe('lettore dei PDF dei risultati: formati inattesi', () => {
  it('legge una gara minima e ignora le righe che non servono', () => {
    const risultato = semplice(r(680, ATLETA), r(670, 'Dopo 72 Frecce'))
    expect(risultato.codiceGara).toBe('R0000001')
    expect(risultato.categorie[0]!.atleti).toHaveLength(1)
    const senzaCodice = leggiRisultati([r(3, 'Gara'), r(2, 'Società'), r(1, 'Luogo')])
    expect(senzaCodice).toMatchObject({ codiceGara: null, organizzatore: 'Società', categorie: [] })
  })

  it('si ferma se manca l’intestazione o le colonne non tornano', () => {
    expect(() => leggiRisultati(testata.slice(0, 2))).toThrow('senza intestazione')
    expect(() =>
      leggiRisultati([...testata, r(690, 'Pos. Atleta Cat. Società Totale 10 9')]),
    ).toThrow('Intestazione di colonne senza categoria')
    expect(() =>
      leggiRisultati([
        ...testata,
        r(700, 'Arco Ricurvo - Senior Maschile'),
        r(695, 'Arco Tradizionale - Senior Maschile'),
        r(690, 'Pos. Atleta Cat. Società Totale 10 9'),
      ]),
    ).toThrow('Intestazione di colonne senza categoria')
    expect(() =>
      leggiRisultati([
        ...testata,
        r(700, 'Arco Nudo - Senior'),
        r(690, 'Pos. Atleta Cat. Società 18m-1 Totale 10'),
      ]),
    ).toThrow('Colonne non riconosciute')
    expect(() =>
      leggiRisultati([...testata, r(700, 'Arco Nudo - Senior'), r(690, ATLETA)]),
    ).toThrow('Riga atleta prima delle colonne')
  })

  it('si ferma se una riga atleta non torna', () => {
    expect(() => semplice(r(680, '1 1- 1A PROVA Mario Arcieri 280/ 1 272/ 1 552 21 26'))).toThrow(
      'Riga atleta non riconosciuta',
    )
    expect(() => semplice(r(680, ATLETA.replace('280/ 1', '280/x')))).toThrow(
      'Parziale non riconosciuto',
    )
    expect(() => semplice(r(680, ATLETA.replace('552', '553')))).toThrow('non fa il totale')
    expect(() => semplice(r(680, ATLETA.replace(' 21 26', ' 21 RIT')))).toThrow(
      ErroreFormatoFitarco,
    )
  })

  it('gare composte: abbina le prove all’atleta più vicino e controlla le somme', () => {
    const ok = composta(
      r(666, '167/ 1 105/ 1 272'),
      r(660, '1 1- 4D PROVA Mario 04 11002 Arcieri Interamna - Terni 650 2 10'),
      r(655, '188/ 1 190/ 1 378'),
    )
    expect(ok.categorie[0]!.atleti[0]!.prove.map((p) => p.totale)).toEqual([272, 378])

    const atleta = r(660, '1 1- 4D PROVA Mario 04 11002 Arcieri Interamna - Terni 650 2 10')
    expect(() => composta(r(666, '167/ 1 105/ 1 272'), atleta)).toThrow(
      'Mancano i punteggi delle prove',
    )
    expect(() =>
      composta(r(666, '167/ 1 105/ 1 273'), atleta, r(655, '188/ 1 190/ 1 378')),
    ).toThrow('non fa il suo totale')
    expect(() =>
      composta(r(666, '167/ 1 106/ 1 273'), atleta, r(655, '188/ 1 190/ 1 378')),
    ).toThrow('La somma delle prove non fa il totale')
    expect(() => composta(r(666, '167/ 1 272'), atleta, r(655, '188/ 1 190/ 1 378'))).toThrow(
      'Parziali della prova non riconosciuti',
    )
    expect(() => composta(atleta, r(600, '188/ 1 190/ 1 378'))).toThrow('senza atleta vicino')
    // Un ritirato può non avere le prove.
    const ritirato = composta(
      r(660, 'DNF 1- 4D PROVA Mario 04 11002 Arcieri Interamna - Terni 120 0 1'),
    )
    expect(ritirato.categorie[0]!.atleti[0]).toMatchObject({ posizione: null, prove: [] })
  })

  it('gare composte: si ferma se mancano le colonne delle prove', () => {
    const senzaColonne = (...righe: RigaTesto[]) =>
      leggiRisultati([
        ...testata,
        r(700, 'Arco Ricurvo - Senior Maschile'),
        r(684, 'Pos. Atleta Cat. Società Totale 10 9'),
        ...righe,
      ])
    expect(() =>
      senzaColonne(
        r(666, '167/ 1 105/ 1 272'),
        r(660, '1 1- 4D PROVA Mario 04 11002 Arcieri Interamna - Terni 650 2 10'),
      ),
    ).toThrow('Punteggi di una prova senza colonne')
    expect(() => senzaColonne(r(600, '18m-1 18m-2 Tot.'))).toThrow('senza intestazione vicina')
  })
})
