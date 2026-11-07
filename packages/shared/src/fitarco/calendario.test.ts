import { describe, expect, it } from 'vitest'
import { ErroreFormatoFitarco, leggiCalendario } from '../fitarco'
import { esempio } from './esempi'

const riga = (opz: {
  codice?: string
  stato?: string
  data?: string
  luogo?: string
  dettaglio?: string
}) => `
  <div class="tab_row">
    <div class="tab_col"><span class="head">Codice</span>
      <span class="value ${opz.stato ?? 'Terminato'}">${
        opz.codice === ''
          ? ''
          : `<a class="link" data-id="${opz.codice ?? 'R0000001'}" data-call="dett_gara">X</a>`
      }</span></div>
    <div class="tab_col"><span class="head">Data</span><span class="value">${opz.data ?? 'dal: 01/02/2027<br/>al: 01/02/2027'}</span></div>
    <div class="tab_col"><span class="head">Calendario</span><span class="value">Interregionale</span></div>
    <div class="tab_col"><span class="head">Località</span><span class="value">${opz.luogo ?? 'Umbria: Gubbio (PG)'}</span></div>
    <div class="tab_col"><span class="head">Tipologia</span><span class="value">3D</span></div>
    <div class="tab_col"><span class="head">Dettaglio</span><span class="value">${opz.dettaglio ?? '--'}</span></div>
    <div class="tab_col"><span class="head">Società</span><a class="link" data-id="11003" data-call="dett_soc">11003</a> - Arcieri Eugubini</div>
  </div>`
const calendario = (...righe: string[]) => `<div class="risultati">${righe.join('')}</div>`

describe('lettore del calendario', () => {
  const gare = leggiCalendario(esempio('calendario'))

  it("legge tutte le gare dell'esempio vero", () => {
    expect(gare).toHaveLength(21)
    expect(gare[0]).toEqual({
      codice: 'R2611001',
      dal: '2026-01-03',
      al: '2026-01-04',
      calendario: 'Interregionale',
      regione: 'Umbria',
      localita: 'Città di Castello (PG)',
      tipologia: '18 m',
      dettaglio: 'competizione interregionale',
      societa: { codice: '11005', nome: 'Arcieri Tifernum' },
      stato: 'omologata',
      statoFitarco: 'Terminato',
    })
  })

  it('riconosce tutti gli stati delle gare', () => {
    const stato = (codice: string) => gare.find((g) => g.codice === codice)?.stato
    expect(stato('S2611001')).toBe('da-omologare')
    expect(stato('R2611027')).toBe('annullata')
    expect(stato('S2611003')).toBe('in-elaborazione')
    expect(stato('R2611040')).toBe('invito')
    expect(stato('R2611044')).toBe('in-calendario')
    expect(gare.every((g) => g.stato !== 'sconosciuto')).toBe(true)
  })

  it('riconosce le tipologie composte così come le scrive Fitarco', () => {
    const tipologie = new Set(gare.map((g) => g.tipologia))
    expect(tipologie).toContain('25+18 m')
    expect(tipologie).toContain('12+12')
    expect(tipologie).toContain('Doppio 70/60mt Round - Doppio 50mt Round')
  })

  it('non tiene i nomi degli arbitri', () => {
    expect(JSON.stringify(gare)).not.toContain('Rossi')
  })

  it('gestisce località senza regione, dettaglio vuoto e stati nuovi', () => {
    const [g] = leggiCalendario(
      calendario(riga({ luogo: 'Gubbio', dettaglio: '', stato: 'Nuovo_stato' })),
    )
    expect(g).toMatchObject({ regione: null, localita: 'Gubbio', dettaglio: null })
    expect(g).toMatchObject({ stato: 'sconosciuto', statoFitarco: 'Nuovo_stato' })
    expect(leggiCalendario(calendario())).toEqual([])
  })

  it('si ferma se il formato cambia', () => {
    expect(() => leggiCalendario('<div>altro</div>')).toThrow(ErroreFormatoFitarco)
    expect(() => leggiCalendario(calendario(riga({ codice: '' })))).toThrow('Gara senza codice')
    expect(() => leggiCalendario(calendario(riga({ data: '1 febbraio' })))).toThrow(
      'Date non riconosciute',
    )
  })
})
