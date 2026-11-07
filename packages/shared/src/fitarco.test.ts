import { describe, expect, it } from 'vitest'
import {
  contaGareCalendario,
  leggiRisposta,
  richiesta,
  richiestaCalendario,
  URL_DETTAGLI,
  URL_ELENCHI,
} from './fitarco'

describe('richieste a Fitarco', () => {
  it('usa gli indirizzi giusti per elenchi e dettagli', () => {
    expect(URL_ELENCHI).toBe(
      'https://www.fitarco.it/index.php?option=com_tesseramentofiv&format=json&view=risultati',
    )
    expect(URL_DETTAGLI).toContain('&view=dettaglio')
  })

  it('mette call, render e params (in JSON) nel corpo del POST', () => {
    const r = richiesta(URL_DETTAGLI, 'invito', 'scheda_invito_result', { codiceGara: 'R0000001' })
    expect(r.url).toBe(URL_DETTAGLI)
    expect(r.corpo.get('call')).toBe('invito')
    expect(r.corpo.get('render')).toBe('scheda_invito_result')
    expect(JSON.parse(r.corpo.get('params') ?? '')).toEqual({ codiceGara: 'R0000001' })
  })

  it("chiede il calendario dell'Umbria se non si indica il comitato", () => {
    const r = richiestaCalendario(2026)
    expect(r.url).toBe(URL_ELENCHI)
    expect(r.corpo.get('call')).toBe('calendario')
    expect(JSON.parse(r.corpo.get('params') ?? '')).toMatchObject({
      idPeriodo: '2026',
      idComitato: '11',
    })
    expect(JSON.parse(richiestaCalendario(2027, '00').corpo.get('params') ?? '')).toMatchObject({
      idPeriodo: '2027',
      idComitato: '00',
    })
  })
})

describe('risposte di Fitarco', () => {
  it('accetta la risposta buona', () => {
    expect(leggiRisposta('{"status":"OK","content":"<div>ciao</div>"}')).toEqual({
      ok: true,
      html: '<div>ciao</div>',
    })
  })

  it('riconosce una pagina di blocco (non JSON)', () => {
    expect(leggiRisposta('Service unavailable')).toEqual({
      ok: false,
      motivo: 'non-json',
      dettaglio: 'Service unavailable',
    })
  })

  it('riconosce uno stato diverso da OK', () => {
    expect(leggiRisposta('{"status":"KO"}')).toMatchObject({ ok: false, motivo: 'stato' })
    expect(leggiRisposta('null')).toMatchObject({ ok: false, motivo: 'stato' })
  })

  it('riconosce una risposta senza contenuto', () => {
    expect(leggiRisposta('{"status":"OK","content":"  "}')).toMatchObject({ motivo: 'vuota' })
    expect(leggiRisposta('{"status":"OK"}')).toMatchObject({ motivo: 'vuota' })
  })

  it('conta le gare di un calendario', () => {
    const gara = (c: string) => `<a class="link" data-id="${c}" data-call="dett_gara">${c}</a>`
    expect(contaGareCalendario(gara('R1') + gara('R2'))).toBe(2)
    expect(contaGareCalendario('<div></div>')).toBe(0)
  })
})
