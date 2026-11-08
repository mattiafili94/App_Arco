import { describe, expect, it } from 'vitest'
import {
  creaIcs,
  descriviStato,
  etichettaTipologia,
  formattaDate,
  garaPassata,
  giornoDopo,
  linkGoogleCalendar,
  nomeFileIcs,
  type Gara,
} from './gare'

const gara = (dati: Partial<Gara> = {}): Gara => ({
  codice: 'R2611040',
  dal: '2026-12-12',
  al: '2026-12-13',
  calendario: 'Interregionale',
  regione: 'Umbria',
  localita: 'Perugia (PG)',
  tipologia: '18 m',
  dettaglio: 'competizione interregionale',
  societa_codice: '11018',
  societa_nome: 'ASD Arcieri Augusta Perusia',
  stato: 'invito',
  in_calendario_umbria: true,
  ha_invito: true,
  url_risultati: null,
  ...dati,
})

describe('date', () => {
  it('un giorno, più giorni dello stesso mese, mesi e anni diversi', () => {
    expect(formattaDate('2026-10-24', '2026-10-24')).toBe('24 ott 2026')
    expect(formattaDate('2026-10-24', '2026-10-25')).toBe('24–25 ott 2026')
    expect(formattaDate('2026-10-30', '2026-11-01')).toBe('30 ott – 1 nov 2026')
    expect(formattaDate('2026-12-30', '2027-01-02')).toBe('30 dic 2026 – 2 gen 2027')
  })

  it('omette l’anno corrente nell’elenco', () => {
    expect(formattaDate('2026-10-24', '2026-10-25', 2026)).toBe('24–25 ott')
    expect(formattaDate('2025-02-01', '2025-02-01', 2026)).toBe('1 feb 2025')
    expect(formattaDate('2026-12-30', '2027-01-02', 2026)).toBe('30 dic – 2 gen 2027')
  })

  it('il giorno dopo, anche a fine mese e anno', () => {
    expect(giornoDopo('2026-12-13')).toBe('2026-12-14')
    expect(giornoDopo('2026-12-31')).toBe('2027-01-01')
    expect(giornoDopo('2028-02-28')).toBe('2028-02-29')
  })
})

describe('nome e stato', () => {
  it('il nome breve della tipologia, o quello di Fitarco se non la conosciamo', () => {
    expect(etichettaTipologia('Doppio 70/60mt Round - Doppio 50mt Round')).toBe('Doppio 70 m')
    expect(etichettaTipologia('Trofeo Pinocchio fase estiva')).toBe('Trofeo Pinocchio fase estiva')
  })

  it('gara passata: finita prima di oggi', () => {
    expect(garaPassata(gara({ al: '2026-11-08' }), '2026-11-09')).toBe(true)
    expect(garaPassata(gara({ al: '2026-11-09' }), '2026-11-09')).toBe(false)
  })

  it('una frase sullo stato: invito per le future, risultati per le passate', () => {
    const oggi = '2026-11-09'
    expect(descriviStato(gara({ stato: 'annullata' }), oggi)).toBe('Annullata')
    expect(descriviStato(gara(), oggi)).toBe('Invito disponibile')
    expect(descriviStato(gara({ stato: 'in-calendario', ha_invito: false }), oggi)).toBeNull()
    expect(descriviStato(gara({ stato: 'in-calendario', ha_invito: true }), oggi)).toBe(
      'Invito disponibile',
    )
    const passata = { dal: '2026-10-24', al: '2026-10-25', ha_invito: false }
    expect(descriviStato(gara({ ...passata, stato: 'omologata' }), oggi)).toBeNull()
    expect(
      descriviStato(
        gara({ ...passata, stato: 'omologata', url_risultati: 'https://x/r.pdf' }),
        oggi,
      ),
    ).toBe('Risultati definitivi')
    expect(
      descriviStato(
        gara({ ...passata, stato: 'da-omologare', url_risultati: 'https://x/r.pdf' }),
        oggi,
      ),
    ).toBe('Risultati disponibili')
  })
})

describe('Aggiungi al calendario', () => {
  const ADESSO = new Date('2026-11-10T10:00:00Z')

  it('file .ics con evento di giorni interi (fine esclusa) e avviso alle 9:00 del giorno prima', () => {
    const ics = creaIcs(gara(), ADESSO)
    // Le righe lunghe sono piegate: qui si guardano "distese" (la piegatura ha il suo test).
    expect(ics.replace(/\r\n /g, '').split('\r\n')).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Arcieri Eugubini//App//IT',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:R2611040@arcieri-eugubini.pages.dev',
      'DTSTAMP:20261110T100000Z',
      'DTSTART;VALUE=DATE:20261212',
      'DTEND;VALUE=DATE:20261214',
      'SUMMARY:18 m – Perugia (PG)',
      'LOCATION:Perugia (PG)',
      'DESCRIPTION:Organizza ASD Arcieri Augusta Perusia\\ncompetizione interregionale\\nGara R2611040',
      'BEGIN:VALARM',
      'TRIGGER:-PT15H',
      'ACTION:DISPLAY',
      'DESCRIPTION:Domani: 18 m – Perugia (PG)',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ])
  })

  it('protegge virgole, punti e virgola e barre; omette ciò che manca', () => {
    const ics = creaIcs(
      gara({ localita: 'Via A, 1; scala\\B', societa_nome: null, dettaglio: null }),
      ADESSO,
    )
    expect(ics).toContain('LOCATION:Via A\\, 1\\; scala\\\\B')
    expect(ics).toContain('DESCRIPTION:Gara R2611040\r\n')
  })

  it('va a capo dopo 75 byte, anche con lettere accentate, e ogni riga resta intera', () => {
    const lunga = 'Località molto lunga àèìòù '.repeat(6).trim()
    const ics = creaIcs(gara({ localita: lunga }), ADESSO)
    const righe = ics.split('\r\n')
    expect(righe.every((r) => new TextEncoder().encode(r).length <= 75)).toBe(true)
    // Rimettendo insieme le righe piegate si ritrova il testo intero.
    expect(ics.replace(/\r\n /g, '')).toContain(`LOCATION:${lunga}`)
  })

  it('il nome del file', () => {
    expect(nomeFileIcs(gara())).toBe('gara-R2611040.ics')
  })

  it('link di Google Calendar con evento già compilato', () => {
    const url = new URL(linkGoogleCalendar(gara()))
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      action: 'TEMPLATE',
      text: '18 m – Perugia (PG)',
      dates: '20261212/20261214',
      location: 'Perugia (PG)',
      details: 'Organizza ASD Arcieri Augusta Perusia\ncompetizione interregionale\nGara R2611040',
    })
  })
})
