/**
 * Lettore dell'invito di una gara (`call=invito`, `render=scheda_invito_result`).
 * Le date di iscrizione stanno nelle note (testo libero): non si estraggono in automatico,
 * l'app mostra il testo a Mattia (decisione in CLAUDE.md).
 */
import {
  analizza,
  dataItaliana,
  ErroreFormatoFitarco,
  etichette,
  vle,
  type Societa,
} from './html.ts'

export interface Invito {
  societa: Societa
  localita: string
  /** Date in formato "AAAA-MM-GG". */
  dal: string
  al: string
  calendario: string
  tipo: string
  /** Indirizzo del campo di gara. */
  luogo: string | null
  /** Referente della società organizzatrice (nome e telefono, come lo scrive la società). */
  riferimento: string | null
  email: string | null
  web: string | null
  /** L'invito è stato verificato da Fitarco. */
  verificato: boolean
  /** Testo libero dell'invito (programma, iscrizioni, contributo…), con gli a capo. */
  note: string
}

const opzionale = (valore: string) => (valore === '' ? null : valore)

export function leggiInvito(html: string): Invito {
  const radice = analizza(html).querySelector('.dettaglio_gara')
  if (!radice) throw new ErroreFormatoFitarco("L'invito non ha il contenitore atteso")
  const campi = etichette(radice, '.gara_mid p')

  const soc = /^(\d{5})\s*-\s*(.+)$/.exec(vle(campi, 'Societa'))
  if (!soc) throw new ErroreFormatoFitarco("Società dell'invito non riconosciuta")

  const date = /Dal\s+(\S+)\s+al\s+(\S+)/i.exec(vle(campi, 'Data'))
  if (!date) throw new ErroreFormatoFitarco("Date dell'invito non riconosciute")

  const luogo = campi.has('Luogo di Gara')
    ? vle(campi, 'Luogo di Gara')
        .replace(/\s+([,)])/g, '$1')
        .replace(/\(\s+/g, '(')
    : ''
  const web = campi.get('Web')?.querySelector('a')?.getAttribute('href')?.trim() ?? ''
  const email = campi.get('Email')?.querySelector('a')?.getAttribute('href') ?? ''

  return {
    societa: { codice: soc[1]!, nome: soc[2]!.trim() },
    localita: vle(campi, 'Località'),
    dal: dataItaliana(date[1]!),
    al: dataItaliana(date[2]!),
    calendario: vle(campi, 'Calendario'),
    tipo: vle(campi, 'Tipo'),
    luogo: opzionale(luogo),
    riferimento: opzionale(campi.has('Riferimento') ? vle(campi, 'Riferimento') : ''),
    email: opzionale(email.replace(/^mailto:/, '').trim()),
    // Un indirizzo senza nome del sito (es. "http://") vuol dire "nessun sito".
    web: /^https?:\/\/[^/\s]+\.[^/\s]+/.test(web) ? web : null,
    verificato: radice.querySelector('.verificato') !== null,
    note: (radice.querySelector('pre')?.text ?? '').replace(/\r\n?/g, '\n').trim(),
  }
}
