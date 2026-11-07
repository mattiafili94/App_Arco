/** Lettore della scheda gara (`call=calendario`, `render=scheda_gara_result`). */
import {
  analizza,
  dataConMese,
  ErroreFormatoFitarco,
  etichette,
  societa,
  testo,
  vle,
  type Societa,
} from './html.ts'

export interface DocumentoRisultati {
  /** "Classifiche di classe individuale", "Classifiche di classe a squadre"… */
  sezione: string
  /** "Risultati Individuali", "Risultati a Squadre"… */
  nome: string
  url: string
}

export interface SchedaGara {
  /** "competizione interregionale", "Campionato Regionale Indoor"… */
  titolo: string
  localita: string
  /** Date in formato "AAAA-MM-GG". */
  dal: string
  al: string
  calendario: string
  tipologia: string
  societa: Societa
  /** Come lo scrive Fitarco: "Terminato", "In calendario"… */
  stato: string
  haInvito: boolean
  /** PDF dei risultati (nessuno finché la gara non è terminata, o se è annullata). */
  risultati: DocumentoRisultati[]
}

export function leggiSchedaGara(html: string): SchedaGara {
  const doc = analizza(html)
  const radice = doc.querySelector('.dettaglio_gara')
  if (!radice) throw new ErroreFormatoFitarco('La scheda gara non ha il contenitore atteso')
  const campi = etichette(radice, '.gara_mid p')

  // "24 Ott 2026 - 25 Ott 2026", oppure un giorno solo.
  const date = vle(campi, 'Data di svolgimento')
    .split(' - ')
    .map((d) => dataConMese(d))
  const dal = date[0]!
  const al = date[1] ?? dal

  const risultati = radice.querySelectorAll('.gara_bot .bot_block').flatMap((blocco) =>
    blocco.querySelectorAll('a[href]').map((a) => ({
      sezione: testo(blocco.querySelector('.sub')),
      nome: testo(a),
      url: a.getAttribute('href')!.trim(),
    })),
  )

  return {
    titolo: testo(radice.querySelector('.gara_top h2')),
    localita: vle(campi, 'Località'),
    dal,
    al,
    calendario: vle(campi, 'Calendario'),
    tipologia: vle(campi, 'Tipologia'),
    societa: societa(campi.get('Società Organizzatrice')),
    stato: vle(campi, 'Stato Competizione'),
    haInvito: radice.querySelector('[data-call="dett_invito"]') !== null,
    risultati,
  }
}
