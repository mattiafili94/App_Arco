import { describe, expect, it } from 'vitest'
import {
  analizza,
  colonne,
  dataConMese,
  dataItaliana,
  ErroreFormatoFitarco,
  etichette,
  numero,
  societa,
  testo,
  valore,
  vle,
} from '../../../../supabase/functions/_shared/fitarco/html.ts'

describe('strumenti per leggere le risposte Fitarco', () => {
  it('legge il testo visibile sistemando gli spazi e i caratteri speciali', () => {
    expect(testo(analizza('<p>  Citta&#39; di\n   Terni </p>'))).toBe("Citta' di Terni")
    expect(testo(null)).toBe('')
  })

  it('converte le date italiane', () => {
    expect(dataItaliana(' 03/01/2026 ')).toBe('2026-01-03')
    expect(() => dataItaliana('3 gennaio')).toThrow(ErroreFormatoFitarco)
  })

  it('converte le date con il mese abbreviato', () => {
    expect(dataConMese('24 \n   Ott \n 2026')).toBe('2026-10-24')
    expect(dataConMese('7 Gen 2027')).toBe('2027-01-07')
    expect(dataConMese('1 Dicembre 2026')).toBe('2026-12-01')
    expect(() => dataConMese('24 Xyz 2026')).toThrow('Data non riconosciuta')
    expect(() => dataConMese('domani')).toThrow(ErroreFormatoFitarco)
  })

  it('legge i numeri, anche con il punto delle migliaia', () => {
    expect(numero('1.107')).toBe(1107)
    expect(numero('534')).toBe(534)
    expect(numero('  ')).toBeNull()
    expect(() => numero('RIT')).toThrow('Numero non riconosciuto')
  })

  it('legge la società senza etichetta né codice', () => {
    const el = analizza(
      '<div><span class="head">Società</span><a data-call="dett_soc" data-id="11003">11003</a> - Arcieri Eugubini</div>',
    )
    expect(societa(el)).toEqual({ codice: '11003', nome: 'Arcieri Eugubini' })
    expect(() => societa(analizza('<div>Arcieri</div>'))).toThrow('Società senza codice')
    expect(() => societa(undefined)).toThrow(ErroreFormatoFitarco)
  })

  it('legge le colonne delle righe e segnala quelle mancanti', () => {
    const riga = analizza(
      '<div class="tab_row"><div class="tab_col"><span class="head">Codice</span><span class="value"> R1 </span></div>' +
        '<div class="tab_col"><span class="head">Note</span>senza valore</div></div>',
    )
    const cols = colonne(riga)
    expect(valore(cols, 'Codice')).toBe('R1')
    expect(valore(cols, 'Note')).toBe('senza valore')
    expect(() => valore(cols, 'Data')).toThrow('Manca la colonna "Data"')
  })

  it('legge le etichette delle schede e segnala quelle mancanti', () => {
    const doc = analizza(
      '<div><p><span class="lbl">Località</span><span class="vle"> Gubbio </span></p><p>senza etichetta</p></div>',
    )
    const campi = etichette(doc, 'p')
    expect(campi.size).toBe(1)
    expect(vle(campi, 'Località')).toBe('Gubbio')
    expect(() => vle(campi, 'Data')).toThrow('Manca il campo "Data"')
  })
})
