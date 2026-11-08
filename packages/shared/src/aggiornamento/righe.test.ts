import { describe, expect, it } from 'vitest'
import {
  datiAtletaDaScheda,
  impronta,
  rigaGaraDaCalendario,
  rigaGaraDaStorico,
  rigaInvito,
  righeClassifica,
  righeClassificaRanking,
  righeStorico,
} from '../aggiornamento'
import {
  leggiCalendario,
  leggiInvito,
  leggiRanking,
  leggiRisultati,
  leggiSchedaAtleta,
} from '../fitarco'
import { esempio, esempioRisultati } from '../fitarco/esempi'

describe('dai lettori alle righe del database', () => {
  it('gara dal calendario', () => {
    const [g] = leggiCalendario(esempio('calendario'))
    expect(rigaGaraDaCalendario(g!)).toEqual({
      codice: 'R2611001',
      dal: '2026-01-03',
      al: '2026-01-04',
      calendario: 'Interregionale',
      regione: 'Umbria',
      localita: 'Città di Castello (PG)',
      tipologia: '18 m',
      dettaglio: 'competizione interregionale',
      societa_codice: '11005',
      societa_nome: 'Arcieri Tifernum',
      stato: 'omologata',
      in_calendario_umbria: true,
    })
    expect(rigaGaraDaCalendario({ ...g!, regione: 'Marche' }).in_calendario_umbria).toBe(false)
  })

  it('gara conosciuta solo dallo storico: stato sconosciuto, senza società', () => {
    const [g] = leggiSchedaAtleta(esempio('scheda-atleta')).storico
    expect(rigaGaraDaStorico(g!)).toMatchObject({
      codice: 'R2611039',
      dal: '2026-10-24',
      al: '2026-10-24',
      stato: 'sconosciuto',
      societa_codice: null,
      in_calendario_umbria: false,
    })
  })

  it('invito', () => {
    const riga = rigaInvito('R2611040', leggiInvito(esempio('invito')))
    expect(riga).toMatchObject({
      gara_codice: 'R2611040',
      email: 'societa@example.com',
      verificato: true,
    })
    expect(riga.testo.startsWith('PROGRAMMA')).toBe(true)
  })

  it('dati e storico dalla scheda atleta (posizione 999 = nessuna posizione)', () => {
    const scheda = leggiSchedaAtleta(esempio('scheda-atleta'))
    expect(datiAtletaDaScheda(scheda)).toEqual({
      classe: 'SM',
      genere: 'M',
      classi_ranking: { Indoor: 'SM', Outdoor: 'SM', Campagna: 'SM', '3D': 'SM' },
    })
    const storico = righeStorico(scheda)
    expect(storico).toHaveLength(43)
    expect(storico[0]).toEqual({
      gara_codice: 'R2611039',
      divisione: 'OL',
      classe: 'SM',
      rank: 'SM',
      posizione: 4,
      totale: 534,
    })
    expect(storico.find((r) => r.gara_codice === 'R2511005')?.posizione).toBeNull()
  })

  it('storico: una sola riga per gara e divisione', () => {
    const scheda = leggiSchedaAtleta(esempio('scheda-atleta'))
    const doppia = { ...scheda, storico: [scheda.storico[0]!, scheda.storico[0]!] }
    expect(righeStorico(doppia)).toHaveLength(1)
  })

  it('classifica completa con gli Eugubini collegati', () => {
    const atleti = [
      { id: 'a1', matricola: '900001', nome: 'Giulia', cognome: 'Neri' },
      { id: 'a2', matricola: '900002', nome: 'Paolo', cognome: 'Gialli' },
    ]
    const righe = righeClassifica(leggiRisultati(esempioRisultati('18m')), atleti)
    expect(righe).toHaveLength(93)
    expect(righe[0]).toMatchObject({
      categoria: 'Arco Ricurvo - Senior Maschile',
      ordine: 1,
      atleta_id: null,
    })
    const collegate = righe.filter((r) => r.atleta_id !== null)
    expect(collegate.map((r) => [r.atleta_id, r.totale, r.ordine])).toEqual([
      ['a1', 534, 4],
      ['a2', 535, 11],
    ])
    expect(collegate[0]).toMatchObject({
      colonne_conteggi: ['10', '9'],
      conteggi: [17, 25],
      categoria_eta: '02',
      societa_codice: '11003',
    })
  })

  it('classifica di una gara composta: le prove restano per riga', () => {
    const righe = righeClassifica(leggiRisultati(esempioRisultati('25+18')), [])
    expect(righe[0]!.prove.map((p) => p.totale)).toEqual([272, 378])
  })

  it('classifica ranking completa: tutte le righe, con società e le due gare', () => {
    const c = righeClassificaRanking(leggiRanking(esempio('ranking')))
    expect(c.categoria).toBe('Arco Ricurvo - Seniores Maschile')
    expect(c.totale).toBe(13)
    expect(c.righe).toHaveLength(6)
    expect(c.righe[0]).toEqual({
      posizione: 46,
      matricola: '900011',
      nome: 'Neri Chiara',
      societa_codice: '11011',
      societa_nome: 'A.S.D. ARCIERI ROCCA FLEA',
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

  it('impronta di un file (SHA-256)', async () => {
    expect(await impronta(new TextEncoder().encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})
