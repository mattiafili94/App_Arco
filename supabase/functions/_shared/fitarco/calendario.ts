/** Lettore del calendario gare (`call=calendario`, `render=lista_calendario_results`). */
import {
  analizza,
  colonne,
  dataItaliana,
  ErroreFormatoFitarco,
  societa,
  valore,
  type Societa,
} from './html.ts'

/**
 * Stato della gara, dal "pallino" colorato del calendario Fitarco:
 * - omologata: risultati definitivi;
 * - da-omologare: risultati trasferiti ma gara non ancora omologata (risultati provvisori);
 * - non-trasferita: risultati non trasferiti;
 * - in-elaborazione, annullata;
 * - invito: gara futura con l'invito pubblicato;
 * - in-calendario: gara futura senza invito;
 * - sconosciuto: un pallino nuovo (da controllare: Fitarco ha cambiato qualcosa).
 */
export type StatoGara =
  | 'omologata'
  | 'da-omologare'
  | 'non-trasferita'
  | 'in-elaborazione'
  | 'annullata'
  | 'invito'
  | 'in-calendario'
  | 'sconosciuto'

const STATI: Record<string, StatoGara> = {
  Terminato: 'omologata',
  non_omolo: 'da-omologare',
  Non_omologato: 'da-omologare',
  non_trasf: 'non-trasferita',
  Rifiutato: 'non-trasferita',
  In_elaborazione: 'in-elaborazione',
  Annullato: 'annullata',
  invito: 'invito',
  'no-pallino': 'in-calendario',
}

export interface GaraCalendario {
  codice: string
  /** Date in formato "AAAA-MM-GG". */
  dal: string
  al: string
  /** Interregionale, Nazionale, Giovanile, Sperimentale… */
  calendario: string
  /** "Umbria" (dal prefisso della località), se c'è. */
  regione: string | null
  localita: string
  /** Come la scrive Fitarco: "18 m", "25+18 m", "Doppio 70/60mt Round - …", "3D"… */
  tipologia: string
  dettaglio: string | null
  societa: Societa
  stato: StatoGara
  /** La classe del pallino così com'è (per capire uno stato "sconosciuto"). */
  statoFitarco: string
}

export function leggiCalendario(html: string): GaraCalendario[] {
  const doc = analizza(html)
  if (!doc.querySelector('.risultati')) {
    throw new ErroreFormatoFitarco('Il calendario non ha il contenitore dei risultati')
  }
  return doc.querySelectorAll('.tab_row').map((riga) => {
    const cols = colonne(riga)
    const linkGara = riga.querySelector('[data-call="dett_gara"]')
    const codice = linkGara?.getAttribute('data-id')?.trim() ?? ''
    if (!codice) throw new ErroreFormatoFitarco('Gara senza codice nel calendario')

    // Lo stato è la classe del contenitore del codice: `<span class="value Terminato">`.
    const contenitore = cols.get('Codice')?.querySelector('.value')
    const classi = (contenitore?.getAttribute('class') ?? '').split(/\s+/)
    const statoFitarco = classi.filter((c) => c !== 'value').join(' ')

    const date = /dal:\s*(\S+)\s*al:\s*(\S+)/.exec(valore(cols, 'Data'))
    if (!date) throw new ErroreFormatoFitarco(`Date non riconosciute per la gara ${codice}`)

    const luogo = valore(cols, 'Località')
    const divisa = /^([^:]+):\s*(.+)$/.exec(luogo)
    const dettaglio = valore(cols, 'Dettaglio')

    return {
      codice,
      dal: dataItaliana(date[1]!),
      al: dataItaliana(date[2]!),
      calendario: valore(cols, 'Calendario'),
      regione: divisa ? divisa[1]!.trim() : null,
      localita: divisa ? divisa[2]!.trim() : luogo,
      tipologia: valore(cols, 'Tipologia'),
      dettaglio: dettaglio === '' || dettaglio === '--' ? null : dettaglio,
      societa: societa(cols.get('Società')),
      stato: STATI[statoFitarco] ?? 'sconosciuto',
      statoFitarco,
    }
  })
}
