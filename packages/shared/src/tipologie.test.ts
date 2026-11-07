import { describe, expect, it } from 'vitest'
import { riconosciTipologia, TIPOLOGIE } from './tipologie'

describe('riconosciTipologia', () => {
  it('riconosce ogni tipologia dal nome usato da Fitarco', () => {
    for (const tipologia of TIPOLOGIE) {
      expect(riconosciTipologia(tipologia.nomeFitarco)).toBe(tipologia)
    }
  })

  it('distingue 25 m da 25+18 m', () => {
    expect(riconosciTipologia('25 m')?.id).toBe('25m')
    expect(riconosciTipologia('25+18 m')?.id).toBe('25+18m')
  })

  it('ignora gli scontri diretti aggiunti dal calendario', () => {
    expect(riconosciTipologia('18 mO.R. Individuale+Squadre')?.id).toBe('18m')
    expect(riconosciTipologia('3D O.R. Individuale')?.id).toBe('3d')
    expect(riconosciTipologia('70/60mt Round - 50mt RoundO.R. Individuale')?.id).toBe('70m')
  })

  it('tollera spazi e maiuscole diverse', () => {
    expect(riconosciTipologia('  doppio 70/60mt  Round - Doppio 50mt Round ')?.id).toBe('doppio70m')
  })

  it('restituisce null per le tipologie non gestite', () => {
    expect(riconosciTipologia('Altro')).toBeNull()
    expect(riconosciTipologia('Trofeo Pinocchio fase estiva')).toBeNull()
  })
})

describe('regole delle prove', () => {
  const prove = (nome: string) => riconosciTipologia(nome)?.prove

  it('divide il 25+18 in una prova 25 m e una 18 m', () => {
    expect(prove('25+18 m')).toEqual(['25m', '18m'])
  })

  it('divide il doppio 70 m in due prove da 70 m', () => {
    expect(prove('Doppio 70/60mt Round - Doppio 50mt Round')).toEqual(['70m', '70m'])
  })

  it('non divide il 24+24, che ha un record separato dal 12+12', () => {
    expect(prove('24+24')).toEqual(['24+24'])
  })

  it('mette 18 m, 25 m e 25+18 m nella famiglia indoor', () => {
    for (const nome of ['18 m', '25 m', '25+18 m']) {
      expect(riconosciTipologia(nome)?.famiglia).toBe('indoor')
    }
  })
})
