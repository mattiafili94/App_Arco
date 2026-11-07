import { describe, expect, it } from 'vitest'
import { ErroreFormatoFitarco, leggiInvito, leggiSchedaAtleta, leggiSchedaGara } from '../fitarco'
import { esempio } from './esempi'

describe('lettore della scheda gara', () => {
  it('legge una gara terminata con i PDF dei risultati', () => {
    expect(leggiSchedaGara(esempio('scheda-gara'))).toEqual({
      titolo: 'competizione interregionale',
      localita: 'Gubbio (PG)',
      dal: '2026-10-24',
      al: '2026-10-25',
      calendario: 'Interregionale',
      tipologia: '18 m',
      societa: { codice: '11003', nome: 'Arcieri Eugubini' },
      stato: 'Terminato',
      haInvito: true,
      risultati: [
        {
          sezione: 'Classifiche di classe individuale',
          nome: 'Risultati Individuali',
          url: 'https://www.fitarco-italia.org/upload_2026/r2611039.pdf',
        },
        {
          sezione: 'Classifiche di classe a squadre',
          nome: 'Risultati a Squadre',
          url: 'https://www.fitarco-italia.org/upload_2026/r2611039_team.pdf',
        },
      ],
    })
  })

  it('legge una gara futura senza risultati', () => {
    const gara = leggiSchedaGara(esempio('scheda-gara-futura'))
    expect(gara).toMatchObject({
      stato: 'In calendario',
      dal: '2026-11-07',
      al: '2026-11-08',
      haInvito: true,
    })
    expect(gara.risultati).toEqual([])
  })

  it('accetta una gara di un giorno solo e senza invito', () => {
    const html = esempio('scheda-gara-futura')
      .replace(/<span class="vle">07[\s\S]*?2026\s*<\/span>/, '<span class="vle">7 Nov 2026</span>')
      .replace(/<a class="invito"[\s\S]*?<\/a>/, '')
    expect(leggiSchedaGara(html)).toMatchObject({
      dal: '2026-11-07',
      al: '2026-11-07',
      haInvito: false,
    })
  })

  it('si ferma se il formato cambia', () => {
    expect(() => leggiSchedaGara('<div></div>')).toThrow(ErroreFormatoFitarco)
    const senzaStato = esempio('scheda-gara').replace('Stato Competizione', 'Stato')
    expect(() => leggiSchedaGara(senzaStato)).toThrow('Manca il campo "Stato Competizione"')
  })
})

describe("lettore dell'invito", () => {
  const invito = leggiInvito(esempio('invito'))

  it('legge i dati della gara e i contatti', () => {
    expect(invito).toMatchObject({
      societa: { codice: '11018', nome: 'ASD Arcieri Augusta Perusia' },
      localita: 'Perugia (PG)',
      dal: '2026-11-07',
      al: '2026-11-08',
      calendario: 'Interregionale',
      tipo: '18 m',
      luogo: 'CVA - PIAZZA DELLA TORRE, SNC - 06134 PERUGIA - LOC. PRETOLA (PG)',
      riferimento: 'Mario Rossi 3330000000',
      email: 'societa@example.com',
      web: null,
      verificato: true,
    })
  })

  it('tiene il testo libero con gli a capo (lì ci sono le date di iscrizione)', () => {
    expect(invito.note.startsWith('PROGRAMMA\n\nSABATO')).toBe(true)
    expect(invito.note).toContain(
      'Saranno accettate le iscrizioni pervenute dal 3 ottobre al 2 novembre',
    )
  })

  it('accetta un invito con il sito e senza campi facoltativi', () => {
    const html = esempio('invito')
      .replace('href="http://"', 'href="https://www.esempio.it"')
      .replace(/<p>\s*<span class="lbl">(Luogo di Gara|Riferimento|Email)[\s\S]*?<\/p>/g, '')
      .replace('class="verificato"', 'class="altro"')
      .replace(/<pre>[\s\S]*<\/pre>/, '')
    expect(leggiInvito(html)).toMatchObject({
      web: 'https://www.esempio.it',
      luogo: null,
      riferimento: null,
      email: null,
      verificato: false,
      note: '',
    })
  })

  it('si ferma se il formato cambia', () => {
    expect(() => leggiInvito('<div></div>')).toThrow(ErroreFormatoFitarco)
    expect(() => leggiInvito(esempio('invito').replace('11018', 'XX'))).toThrow('Società')
    expect(() => leggiInvito(esempio('invito').replace('Dal 07/11/2026', 'Il 07/11/2026'))).toThrow(
      'Date',
    )
  })
})

describe('lettore della scheda atleta', () => {
  const scheda = leggiSchedaAtleta(esempio('scheda-atleta'))

  it("legge l'anagrafica che serve (niente data di nascita né tecnico)", () => {
    expect(scheda).toMatchObject({
      matricola: '900001',
      nome: 'Mario',
      cognome: 'Rossi',
      societa: { codice: '11003', nome: 'A.S.D. Compagnia Arcieri Eugubini' },
      classe: 'SM',
      classiRanking: { Indoor: 'SM', Outdoor: 'SM', Campagna: 'SM', '3D': 'SM' },
      ranking: { posizione: 133, tipo: 'Indoor - Arco Ricurvo - Seniores Maschile' },
    })
    expect(JSON.stringify(scheda)).not.toMatch(/1990|Bianchi/)
  })

  it('legge tutto lo storico, dal più recente', () => {
    expect(scheda.storico).toHaveLength(43)
    expect(scheda.storico[0]).toEqual({
      codice: 'R2611039',
      data: '2026-10-24',
      calendario: 'Interregionale',
      localita: 'Gubbio (PG) competizione interregionale',
      tipologia: '18 m',
      classe: 'SM',
      rank: 'SM',
      divisione: 'OL',
      posizione: 4,
      totale: 534,
    })
    expect(scheda.storico.at(-1)?.data.startsWith('2024')).toBe(true)
  })

  it('tiene i casi strani così come sono (doppio 70 m con totale unico, posizione 999)', () => {
    const doppio = scheda.storico.find((g) => g.codice === 'R2511017')
    expect(doppio).toMatchObject({
      tipologia: 'Doppio 70/60mt Round - Doppio 50mt Round',
      totale: 1126,
    })
    expect(scheda.storico.find((g) => g.codice === 'R2511005')?.posizione).toBe(999)
  })

  it('accetta un atleta senza ranking, classe e storico', () => {
    const html = esempio('scheda-atleta')
      .replace(/<p class="dato ranking">\s*<span class="lbl">Ranking list[\s\S]*?<\/p>/, '')
      .replace(/<p class="dato">\s*<span class="lbl">Classe Anagrafica[\s\S]*?<\/p>/, '')
      .replace(/<div class="dettaglio_gare">[\s\S]*$/, '</div>')
    expect(leggiSchedaAtleta(html)).toMatchObject({ ranking: null, classe: null, storico: [] })
  })

  it('si ferma se il formato cambia', () => {
    expect(() => leggiSchedaAtleta('<div></div>')).toThrow(ErroreFormatoFitarco)
    const senzaCodice = esempio('scheda-atleta').replace(
      'data-call="dett_gara"',
      'data-call="altro"',
    )
    expect(() => leggiSchedaAtleta(senzaCodice)).toThrow('Gara senza codice')
  })
})
