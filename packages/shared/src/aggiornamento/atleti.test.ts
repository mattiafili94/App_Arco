import { describe, expect, it } from 'vitest'
import { CODICE_SOCIETA, genereDaClasse, normalizzaNome, trovaAtleta } from '../aggiornamento'

const ATLETI = [
  { id: 'a1', matricola: '900001', nome: 'Giulia', cognome: 'Neri' },
  { id: 'a2', matricola: '900002', nome: 'Gian Luca', cognome: "D'Àmico" },
  { id: 'a3', matricola: '900003', nome: 'Paolo', cognome: 'Rossi' },
  { id: 'a4', matricola: '900004', nome: 'Paolo', cognome: 'Rossi' },
]
const riga = (cognome: string, nome: string, societa = CODICE_SOCIETA) => ({
  cognome,
  nome,
  societa: { codice: societa },
})

describe('riconoscere gli atleti della compagnia nei PDF', () => {
  it('confronta i nomi senza accenti, maiuscole e spazi in più', () => {
    expect(normalizzaNome('  D’Àmico   Gian-Luca ')).toBe("D'AMICO GIAN-LUCA")
  })

  it('riconosce un Eugubino per cognome e nome', () => {
    expect(trovaAtleta(riga('NERI', 'Giulia'), ATLETI)).toBe('a1')
    expect(trovaAtleta(riga("D'AMICO", 'Gian Luca'), ATLETI)).toBe('a2')
  })

  it('accetta un secondo nome in più o in meno', () => {
    expect(trovaAtleta(riga('NERI', 'Giulia Maria'), ATLETI)).toBe('a1')
    expect(trovaAtleta(riga("D'AMICO", 'Gian'), ATLETI)).toBe('a2')
    expect(trovaAtleta(riga('NERI', 'Giuliana'), ATLETI)).toBeNull()
  })

  it('non collega atleti di altre società né omonimi', () => {
    expect(trovaAtleta(riga('NERI', 'Giulia', '11004'), ATLETI)).toBeNull()
    expect(trovaAtleta(riga('ROSSI', 'Paolo'), ATLETI)).toBeNull()
    expect(trovaAtleta(riga('VERDI', 'Anna'), ATLETI)).toBeNull()
  })

  it('ricava il genere dalla classe', () => {
    expect(genereDaClasse('SM')).toBe('M')
    expect(genereDaClasse('MF')).toBe('F')
    expect(genereDaClasse('S')).toBeNull()
    expect(genereDaClasse(null)).toBeNull()
  })
})
