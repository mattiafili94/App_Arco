import { describe, expect, it } from 'vitest'
import {
  GIORNI_CONTROLLO_INVITI,
  pianificaLetture,
  PRIORITA,
  inizioClassificheComplete,
  risultatiProvvisori,
  type StatoPianificazione,
} from '../aggiornamento'

type Gara = StatoPianificazione['gare'][number]

const gara = (dati: Partial<Gara>): Gara => ({
  codice: 'R2711001',
  dal: '2027-03-10',
  al: '2027-03-10',
  stato: 'in-calendario',
  rilevante: true,
  inCalendarioUmbria: true,
  haInvito: false,
  urlRisultati: null,
  risultati: null,
  ...dati,
})

const stato = (dati: Partial<StatoPianificazione>): StatoPianificazione => ({
  oggi: '2027-03-01',
  // Calendario dell'anno appena letto: non va riletto (salvo i test che lo cambiano).
  ultimeLetture: new Map([['calendario|2027', '2027-02-28']]),
  gare: [],
  atleti: [],
  ...dati,
})

const letture = (s: StatoPianificazione) => pianificaLetture(s).map((l) => `${l.tipo} ${l.chiave}`)

describe('cosa leggere e quando', () => {
  it('niente da fare se tutto è aggiornato', () => {
    expect(letture(stato({}))).toEqual([])
  })

  it('calendario: anno in corso ogni settimana; il prossimo solo a dicembre, ogni settimana', () => {
    expect(letture(stato({ ultimeLetture: new Map() }))).toEqual(['calendario 2027'])
    expect(letture(stato({ ultimeLetture: new Map([['calendario|2027', '2027-02-22']]) }))).toEqual(
      ['calendario 2027'],
    )
    // Da ottobre a novembre il prossimo anno non si legge più (è ancora provvisorio).
    expect(
      letture(
        stato({ oggi: '2027-10-02', ultimeLetture: new Map([['calendario|2027', '2027-10-01']]) }),
      ),
    ).toEqual([])
    expect(
      letture(
        stato({ oggi: '2027-11-30', ultimeLetture: new Map([['calendario|2027', '2027-11-29']]) }),
      ),
    ).toEqual([])
    // A dicembre sì, una volta a settimana.
    const dicembre = (ultime: [string, string][]) =>
      letture(stato({ oggi: '2027-12-10', ultimeLetture: new Map(ultime) }))
    expect(dicembre([['calendario|2027', '2027-12-09']])).toEqual(['calendario 2028'])
    expect(
      dicembre([
        ['calendario|2027', '2027-12-09'],
        ['calendario|2028', '2027-12-05'],
      ]),
    ).toEqual([])
    expect(
      dicembre([
        ['calendario|2027', '2027-12-09'],
        ['calendario|2028', '2027-12-03'],
      ]),
    ).toEqual(['calendario 2028'])
  })

  it('inviti: ogni giorno si rilegge il mese con gare future dell’Umbria ancora senza invito', () => {
    const gare = [
      gara({ codice: 'R2711001', dal: '2027-03-10', al: '2027-03-10' }),
      gara({ codice: 'R2711002', dal: '2027-03-20', al: '2027-03-20' }),
      gara({ codice: 'R2711003', dal: '2027-04-20', al: '2027-04-20' }),
    ]
    expect(letture(stato({ gare }))).toEqual(['calendario 2027-03', 'calendario 2027-04'])
    // Letto ieri: oggi di nuovo; letto oggi: no.
    const ultimeLetture = (quando: string) =>
      new Map([
        ['calendario|2027', '2027-02-28'],
        ['calendario|2027-03', quando],
        ['calendario|2027-04', '2027-03-01'],
      ])
    expect(letture(stato({ gare, ultimeLetture: ultimeLetture('2027-02-28') }))).toEqual([
      'calendario 2027-03',
    ])
    expect(letture(stato({ gare, ultimeLetture: ultimeLetture('2027-03-01') }))).toEqual([])
  })

  it('inviti: niente mese da rileggere per gare passate, già con invito, annullate o fuori Umbria', () => {
    const gare = [
      gara({ codice: 'R2711001', dal: '2027-02-10', al: '2027-02-10' }), // passata
      gara({ codice: 'R2711002', dal: '2027-03-10', al: '2027-03-10', haInvito: true }),
      gara({ codice: 'R2711003', dal: '2027-04-10', al: '2027-04-10', stato: 'invito' }),
      gara({ codice: 'R2711004', dal: '2027-05-10', al: '2027-05-10', stato: 'annullata' }),
      gara({ codice: 'R2711005', dal: '2027-06-10', al: '2027-06-10', inCalendarioUmbria: false }),
    ]
    expect(letture(stato({ gare })).filter((l) => l.startsWith('calendario'))).toEqual([])
  })

  it('inviti: ogni giorno solo le gare dei prossimi 60 giorni (le più lontane le copre il calendario della settimana)', () => {
    expect(GIORNI_CONTROLLO_INVITI).toBe(60)
    const gare = [
      gara({ codice: 'R2711001', dal: '2027-04-30', al: '2027-04-30' }), // 60 giorni dopo il 1° marzo
      gara({ codice: 'R2711002', dal: '2027-05-01', al: '2027-05-01' }), // 61 giorni: no
      gara({ codice: 'R2711003', dal: '2027-09-12', al: '2027-09-12' }), // lontana: no
    ]
    expect(letture(stato({ gare })).filter((l) => l.startsWith('calendario'))).toEqual([
      'calendario 2027-04',
    ])
  })

  it('inviti: quando si rilegge tutto l’anno i mesi non servono', () => {
    const gare = [gara({ codice: 'R2711001', dal: '2027-03-10', al: '2027-03-10' })]
    expect(
      letture(stato({ gare, ultimeLetture: new Map() })).filter((l) => l.startsWith('calendario')),
    ).toEqual(['calendario 2027'])
  })

  it('calendari degli anni passati: mai (le loro gare arrivano dallo storico degli atleti)', () => {
    const passata = gara({
      codice: 'R2611001',
      dal: '2026-05-01',
      al: '2026-05-01',
      stato: 'da-omologare',
      urlRisultati: 'x',
      risultati: { provvisoria: false },
    })
    expect(letture(stato({ gare: [passata] }))).toEqual([])
  })

  it("inviti delle gare future dell'Umbria: subito, poi ogni settimana", () => {
    const g = gara({ stato: 'invito' })
    expect(letture(stato({ gare: [g] }))).toEqual(['invito R2711001'])
    const visto = new Map([
      ['calendario|2027', '2027-02-28'],
      ['invito|R2711001', '2027-02-27'],
    ])
    expect(letture(stato({ gare: [g], ultimeLetture: visto }))).toEqual([])
    expect(letture(stato({ gare: [gara({ haInvito: true, inCalendarioUmbria: false })] }))).toEqual(
      [],
    )
  })

  it('dopo la gara: scheda ogni giorno per un mese, poi ogni settimana, finché c’è il PDF', () => {
    const g = gara({ dal: '2027-02-20', al: '2027-02-21', stato: 'da-omologare' })
    expect(letture(stato({ gare: [g] }))).toEqual(['scheda-gara R2711001'])
    const ieri = new Map([
      ['calendario|2027', '2027-02-28'],
      ['scheda-gara|R2711001', '2027-02-28'],
    ])
    expect(letture(stato({ gare: [g], ultimeLetture: ieri }))).toEqual(['scheda-gara R2711001'])
    const tardi = {
      oggi: '2027-04-30',
      ultimeLetture: new Map([
        ...ieri,
        ['calendario|2027', '2027-04-29'],
        ['scheda-gara|R2711001', '2027-04-27'],
      ]),
    }
    expect(letture(stato({ ...tardi, gare: [g] }))).toEqual([])
  })

  it('risultati letti ma non salvati (anomalia): si riprova ogni 3 giorni, non a ogni giro', () => {
    const g = gara({ dal: '2027-02-20', al: '2027-02-21', stato: 'omologata', urlRisultati: 'x' })
    const letta = (quando: string) =>
      new Map([
        ['calendario|2027', '2027-02-28'],
        ['risultati|R2711001', quando],
      ])
    expect(letture(stato({ gare: [g], ultimeLetture: letta('2027-02-28') }))).toEqual([])
    expect(letture(stato({ gare: [g], ultimeLetture: letta('2027-02-26') }))).toEqual([
      'risultati R2711001',
    ])
  })

  it('risultati: la prima volta, poi ogni 3 giorni se provvisori, subito appena omologata', () => {
    const conPdf = { dal: '2027-02-20', al: '2027-02-21', urlRisultati: 'https://x/r.pdf' }
    expect(letture(stato({ gare: [gara({ ...conPdf, stato: 'da-omologare' })] }))).toEqual([
      'risultati R2711001',
    ])

    const provvisoria = gara({ ...conPdf, stato: 'da-omologare', risultati: { provvisoria: true } })
    const letta = (quando: string) =>
      new Map([
        ['calendario|2027', '2027-02-28'],
        ['risultati|R2711001', quando],
      ])
    expect(letture(stato({ gare: [provvisoria], ultimeLetture: letta('2027-02-28') }))).toEqual([])
    expect(letture(stato({ gare: [provvisoria], ultimeLetture: letta('2027-02-25') }))).toEqual([
      'risultati R2711001',
    ])
    const omologata = { ...provvisoria, stato: 'omologata' as const }
    expect(letture(stato({ gare: [omologata], ultimeLetture: letta('2027-02-28') }))).toEqual([
      'risultati R2711001',
    ])
    const definitiva = gara({ ...conPdf, stato: 'omologata', risultati: { provvisoria: false } })
    expect(letture(stato({ gare: [definitiva] }))).toEqual([])
  })

  it('ignora le gare annullate o non rilevanti', () => {
    const passata = { dal: '2027-02-20', al: '2027-02-21' }
    expect(
      letture(
        stato({
          gare: [gara({ ...passata, stato: 'annullata' }), gara({ ...passata, rilevante: false })],
        }),
      ),
    ).toEqual([])
  })

  it('schede atleta: subito per i nuovi, poi ogni settimana; i nuovi passano davanti', () => {
    const s = stato({
      ultimeLetture: new Map([
        ['calendario|2027', '2027-01-01'],
        ['scheda-atleta|vecchio', '2027-02-20'],
        ['scheda-atleta|recente', '2027-02-28'],
      ]),
      atleti: [{ id: 'vecchio' }, { id: 'nuovo' }, { id: 'recente' }],
    })
    expect(pianificaLetture(s)).toEqual([
      { tipo: 'scheda-atleta', chiave: 'nuovo', priorita: PRIORITA.schedaAtletaNuova },
      { tipo: 'calendario', chiave: '2027', priorita: PRIORITA.calendario },
      { tipo: 'scheda-atleta', chiave: 'vecchio', priorita: PRIORITA.schedaAtleta },
    ])
  })
})

describe('risultati definitivi e gare fuori Umbria', () => {
  const fuori = { stato: 'sconosciuto' as const, inCalendarioUmbria: false }

  it('i risultati sono provvisori finché la gara non è omologata, al massimo per 60 giorni', () => {
    expect(risultatiProvvisori({ stato: 'omologata', al: '2027-02-01' }, '2027-02-02')).toBe(false)
    expect(risultatiProvvisori({ stato: 'da-omologare', al: '2027-01-01' }, '2027-02-02')).toBe(
      true,
    )
    // Una gara di dicembre: l'anno dopo il suo calendario non si legge più, l'omologazione non arriva.
    expect(risultatiProvvisori({ stato: 'da-omologare', al: '2026-12-01' }, '2027-02-02')).toBe(
      false,
    )
    expect(risultatiProvvisori({ stato: 'sconosciuto', al: '2027-01-01' }, '2027-03-01')).toBe(true)
    expect(risultatiProvvisori({ stato: 'sconosciuto', al: '2027-01-01' }, '2027-03-03')).toBe(
      false,
    )
  })

  it('dopo 60 giorni si rilegge subito il PDF per salvarlo come definitivo', () => {
    const g = gara({
      ...fuori,
      dal: '2026-12-20',
      al: '2026-12-20',
      urlRisultati: 'https://x/r.pdf',
      risultati: { provvisoria: true },
    })
    const letta = new Map([
      ['calendario|2027', '2027-02-28'],
      ['risultati|R2711001', '2027-02-28'],
    ])
    expect(letture(stato({ gare: [g], ultimeLetture: letta }))).toEqual(['risultati R2711001'])
  })

  it('una gara vecchia senza PDF si controlla una volta, poi basta', () => {
    const g = gara({ ...fuori, dal: '2026-05-01', al: '2026-05-01' })
    const base = new Map([['calendario|2027', '2027-02-28']])
    expect(letture(stato({ gare: [g], ultimeLetture: base }))).toEqual(['scheda-gara R2711001'])
    const controllata = new Map([...base, ['scheda-gara|R2711001', '2027-01-01']])
    expect(letture(stato({ gare: [g], ultimeLetture: controllata }))).toEqual([])
  })
})

describe('classifiche complete e gare vecchie', () => {
  it('complete per l’anno in corso e quello prima', () => {
    expect(inizioClassificheComplete('2026-11-08')).toBe('2025-01-01')
    expect(inizioClassificheComplete('2027-01-01')).toBe('2026-01-01')
  })

  it('gare prima dell’anno scorso: niente scheda gara né PDF (basta lo storico dell’atleta)', () => {
    const base = new Map([['calendario|2027', '2027-02-28']])
    const senzaPdf = gara({
      codice: 'R1511001',
      dal: '2015-05-01',
      al: '2015-05-01',
      stato: 'sconosciuto',
      inCalendarioUmbria: false,
    })
    const conPdf = gara({
      codice: 'R2411001',
      dal: '2024-12-31',
      al: '2024-12-31',
      stato: 'omologata',
      urlRisultati: 'x',
    })
    expect(letture(stato({ gare: [senzaPdf, conPdf], ultimeLetture: base }))).toEqual([])
  })
})
