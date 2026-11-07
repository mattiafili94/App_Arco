import { describe, expect, it } from 'vitest'
import { ErroreFormatoFitarco, leggiRanking, leggiTesserati } from '../fitarco'
import { esempio } from './esempi'

describe('lettore dei tesserati', () => {
  it('legge matricola, nome e società', () => {
    const tesserati = leggiTesserati(esempio('tesserati'))
    expect(tesserati).toHaveLength(5)
    expect(tesserati[0]).toEqual({
      matricola: '900001',
      nomeCompleto: 'Rossi Mario',
      societa: { codice: '11003', nome: 'A.S.D. Compagnia Arcieri Eugubini' },
    })
  })

  it('si ferma se il formato cambia', () => {
    expect(() => leggiTesserati('<div></div>')).toThrow(ErroreFormatoFitarco)
    const senza = esempio('tesserati').replace('data-call="dett_tesserato"', 'data-call="altro"')
    expect(() => leggiTesserati(senza)).toThrow('Tesserato senza matricola')
  })
})

describe('lettore della ranking', () => {
  const ranking = leggiRanking(esempio('ranking'))

  it('legge categoria, posizioni e le gare che contano', () => {
    expect(ranking.totale).toBe(13)
    expect(ranking.categorie.map((c) => c.nome)).toEqual(['Arco Ricurvo - Seniores Maschile'])
    const righe = ranking.categorie[0]!.righe
    expect(righe).toHaveLength(6)
    expect(righe[0]).toEqual({
      posizione: 46,
      matricola: '900011',
      nomeCompleto: 'Neri Chiara',
      societa: { codice: '11011', nome: 'A.S.D. ARCIERI ROCCA FLEA' },
      punti: 1118,
      gare: [
        {
          codice: 'R2611009',
          punti: 564,
          localita: 'Terni (TR)',
          dal: '2026-03-14',
          al: '2026-03-15',
        },
        {
          codice: 'N2612008',
          punti: 554,
          localita: 'Roma (RM)',
          dal: '2026-02-26',
          al: '2026-03-01',
        },
      ],
    })
  })

  it('tiene separate più categorie nella stessa risposta', () => {
    const html = esempio('ranking').replace(
      /(<div class="tab_row">[\s\S]*?)(<div class="tab_row">)/,
      '$1<h5 class="sub">Arco Olimpico - Master Maschile</h5>$2',
    )
    expect(leggiRanking(html).categorie.map((c) => c.righe.length)).toEqual([1, 5])
  })

  it('si ferma se il formato cambia', () => {
    expect(() => leggiRanking('<div></div>')).toThrow(ErroreFormatoFitarco)
    const ok = esempio('ranking')
    expect(() => leggiRanking(ok.replace(/Numero totale: \d+/, 'Numero totale'))).toThrow(
      'numero totale',
    )
    expect(() => leggiRanking(ok.replace(/<h5 class="sub">[^<]*<\/h5>/, ''))).toThrow(
      'senza categoria',
    )
    expect(() => leggiRanking(ok.replace('data-call="dett_tesserato"', 'data-call="x"'))).toThrow(
      'senza matricola',
    )
    expect(() =>
      leggiRanking(
        ok.replace(/(<span class="head">Punti<\/span>\s*<span class="value">)\d+/, '$1'),
      ),
    ).toThrow('Posizione o punti mancanti')
    expect(() => leggiRanking(ok.replace(/564\s-\s<a/, 'circa <a'))).toThrow('Gara della ranking')
  })
})
