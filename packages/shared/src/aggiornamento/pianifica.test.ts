import { describe, expect, it } from 'vitest'
import { pianificaLetture, PRIORITA, type StatoPianificazione } from '../aggiornamento'

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
  anniStorico: [],
  gare: [],
  atleti: [],
  ...dati,
})

const letture = (s: StatoPianificazione) => pianificaLetture(s).map((l) => `${l.tipo} ${l.chiave}`)

describe('cosa leggere e quando', () => {
  it('niente da fare se tutto è aggiornato', () => {
    expect(letture(stato({}))).toEqual([])
  })

  it('calendario: anno in corso ogni settimana, il prossimo da ottobre', () => {
    expect(letture(stato({ ultimeLetture: new Map() }))).toEqual(['calendario 2027'])
    expect(letture(stato({ ultimeLetture: new Map([['calendario|2027', '2027-02-22']]) }))).toEqual(
      ['calendario 2027'],
    )
    expect(
      letture(
        stato({ oggi: '2027-10-02', ultimeLetture: new Map([['calendario|2027', '2027-10-01']]) }),
      ),
    ).toEqual(['calendario 2028'])
  })

  it('calendari degli anni passati: una volta, poi solo se hanno gare non definitive', () => {
    const base = { anniStorico: [2025], oggi: '2027-03-01' }
    expect(letture(stato(base))).toEqual(['calendario 2025'])
    const letto = new Map([
      ['calendario|2027', '2027-02-28'],
      ['calendario|2025', '2027-01-01'],
    ])
    expect(letture(stato({ ...base, ultimeLetture: letto }))).toEqual([])
    const inSospeso = gara({
      codice: 'R2511001',
      dal: '2025-05-01',
      al: '2025-05-01',
      stato: 'sconosciuto',
      urlRisultati: 'x',
      risultati: { provvisoria: false },
    })
    expect(letture(stato({ ...base, ultimeLetture: letto, gare: [inSospeso] }))).toEqual([
      'calendario 2025',
    ])
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
