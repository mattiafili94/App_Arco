import { describe, expect, it } from 'vitest'
import {
  ALFABETO_CODICE,
  codiceValido,
  emailTecnica,
  formattaCodice,
  generaCodice,
  leggiLinkAccesso,
  LUNGHEZZA_CODICE,
  linkAccesso,
  matricolaValida,
  normalizzaCodice,
  normalizzaMatricola,
} from './accesso'

describe('codice personale', () => {
  it('è lungo 10 caratteri e usa solo caratteri che non si confondono', () => {
    for (let i = 0; i < 200; i++) {
      const codice = generaCodice()
      expect(codice).toHaveLength(LUNGHEZZA_CODICE)
      expect(codiceValido(codice)).toBe(true)
    }
    for (const confondibile of ['0', 'O', '1', 'I', 'L']) {
      expect(ALFABETO_CODICE).not.toContain(confondibile)
    }
  })

  it('codici generati di seguito sono diversi', () => {
    const codici = new Set(Array.from({ length: 500 }, () => generaCodice()))
    expect(codici.size).toBe(500)
  })

  it('scarta i valori casuali che renderebbero alcuni caratteri più probabili', () => {
    // 248 e oltre vengono scartati (31 caratteri: 256 - 256 % 31 = 248).
    const sequenze = [new Uint8Array(10).fill(250), new Uint8Array(10).fill(31)]
    const codice = generaCodice(() => sequenze.shift() ?? new Uint8Array(10).fill(0))
    expect(codice).toBe('2'.repeat(10))
  })

  it('si mostra a gruppi e si pulisce quando viene scritto a mano', () => {
    expect(formattaCodice('K7PM3XQR9A')).toBe('K7PM3-XQR9A')
    expect(normalizzaCodice(' k7pm3-xqr9a ')).toBe('K7PM3XQR9A')
  })

  it('rifiuta codici troppo corti, troppo lunghi o con caratteri non ammessi', () => {
    expect(codiceValido('K7PM3XQR9')).toBe(false)
    expect(codiceValido('K7PM3XQR9AB')).toBe(false)
    expect(codiceValido('K7PM3XQR0A')).toBe(false)
  })
})

describe('matricola', () => {
  it('tiene solo le cifre e accetta da 1 a 8 cifre', () => {
    expect(normalizzaMatricola(' 164 234 ')).toBe('164234')
    expect(matricolaValida('164234')).toBe(true)
    expect(matricolaValida('')).toBe(false)
    expect(matricolaValida('123456789')).toBe(false)
  })

  it('genera l email tecnica dell accesso', () => {
    expect(emailTecnica('12345')).toBe('matricola-12345@accesso.arcieri-eugubini.pages.dev')
  })
})

describe('link personale', () => {
  it('mette matricola e codice dopo il #, e si rilegge uguale', () => {
    const link = linkAccesso('https://arcieri-eugubini.pages.dev/', '12345', 'K7PM3XQR9A')
    expect(link).toBe('https://arcieri-eugubini.pages.dev/accesso#m=12345&c=K7PM3XQR9A')
    expect(leggiLinkAccesso(new URL(link).hash)).toEqual({
      matricola: '12345',
      codice: 'K7PM3XQR9A',
    })
  })

  it('accetta il frammento anche senza #, con il codice a gruppi o minuscolo', () => {
    expect(leggiLinkAccesso('m=12345&c=k7pm3-xqr9a')).toEqual({
      matricola: '12345',
      codice: 'K7PM3XQR9A',
    })
  })

  it('rifiuta link incompleti o non validi', () => {
    expect(leggiLinkAccesso('')).toBeNull()
    expect(leggiLinkAccesso('#m=12345')).toBeNull()
    expect(leggiLinkAccesso('#c=K7PM3XQR9A')).toBeNull()
    expect(leggiLinkAccesso('#m=12345&c=CORTO')).toBeNull()
  })
})
