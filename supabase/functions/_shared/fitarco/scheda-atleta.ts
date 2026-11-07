/**
 * Lettore della scheda atleta (`call=scheda_tesserato`, `render=scheda_tesserato_result`).
 * Si prende solo quello che serve all'app: niente data di nascita né tecnico.
 */
import {
  analizza,
  colonne,
  dataItaliana,
  ErroreFormatoFitarco,
  etichette,
  numero,
  societa,
  testo,
  valore,
  vle,
  type Societa,
} from './html.ts'

export interface GaraStorico {
  codice: string
  /** "AAAA-MM-GG" (primo giorno di gara). */
  data: string
  calendario: string
  /** Località e nome della gara insieme, come le scrive Fitarco. */
  localita: string
  tipologia: string
  /** Classe di gara (es. "SM") e classe di ranking. */
  classe: string
  rank: string
  /** OL ricurvo, CO compound, AN nudo, AI istintivo, LB longbow. */
  divisione: string
  /** Posizione in classifica (Fitarco usa 999 in alcuni casi: da capire con i PDF). */
  posizione: number | null
  totale: number | null
}

export interface SchedaAtleta {
  matricola: string
  nome: string
  cognome: string
  societa: Societa
  /** Codice della classe anagrafica, es. "SM" (Seniores Maschile). */
  classe: string | null
  /** Classe di ranking per tipo: { Indoor: "SM", Outdoor: "SM", Campagna: "SM", 3D: "SM" }. */
  classiRanking: Record<string, string>
  /** Posizione nella ranking list principale, se c'è. */
  ranking: { posizione: number; tipo: string } | null
  storico: GaraStorico[]
}

export function leggiSchedaAtleta(html: string): SchedaAtleta {
  const radice = analizza(html).querySelector('.scheda_tesserato')
  if (!radice) throw new ErroreFormatoFitarco('La scheda atleta non ha il contenitore atteso')
  const campi = etichette(radice, '.tesserato_info p.dato')

  const classe = /\(\s*([A-Z]{1,3})\s*\)/.exec(
    campi.has('Classe Anagrafica') ? vle(campi, 'Classe Anagrafica') : '',
  )

  // Ogni "p.dato.ranking" ha più valori: "Indoor: SM", oppure "Posizione: 133" e "Tipo: …".
  const valoriRanking = (etichetta: string) =>
    (campi.get(etichetta)?.querySelectorAll('.vle') ?? []).map((v) => {
      const [chiave, ...resto] = testo(v).split(':')
      return [chiave!.trim(), resto.join(':').trim()] as const
    })
  const classiRanking = Object.fromEntries(valoriRanking('Classe di ranking'))
  const lista = Object.fromEntries(valoriRanking('Ranking list'))
  const posizione = lista['Posizione'] ? numero(lista['Posizione']) : null

  const storico = radice.querySelectorAll('.dettaglio_gare .tab_row').map((riga) => {
    const cols = colonne(riga)
    const codice = riga.querySelector('[data-call="dett_gara"]')?.getAttribute('data-id')?.trim()
    if (!codice) throw new ErroreFormatoFitarco('Gara senza codice nello storico')
    return {
      codice,
      data: dataItaliana(valore(cols, 'Data')),
      calendario: valore(cols, 'Calendario'),
      localita: valore(cols, 'Località'),
      tipologia: valore(cols, 'Tipologia'),
      classe: valore(cols, 'Classe'),
      rank: valore(cols, 'Rank'),
      divisione: valore(cols, 'Divisione'),
      posizione: numero(valore(cols, 'Classifica')),
      totale: numero(valore(cols, 'Totale')),
    }
  })

  return {
    matricola: vle(campi, 'Matricola'),
    nome: vle(campi, 'Nome'),
    cognome: vle(campi, 'Cognome'),
    societa: societa(campi.get('Società')),
    classe: classe ? classe[1]! : null,
    classiRanking,
    ranking: posizione !== null ? { posizione, tipo: lista['Tipo'] ?? '' } : null,
    storico,
  }
}
