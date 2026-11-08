/**
 * Come si mostra la classifica (ranking) nell'app (Fase 5.2): titoli, ricerca, "la tua posizione".
 * Funzioni pure sulle classifiche salvate dal server (tabella `classifiche_ranking`).
 */
import type { FiltroClassifica, RigaClassificaRanking } from './aggiornamento'
import { nomeDivisione } from './atleti'
import { formattaDate } from './gare'

/** Una classifica completa, com'è salvata sul telefono. */
export interface ClassificaRanking extends FiltroClassifica {
  categoria: string
  totale: number
  righe: RigaClassificaRanking[]
  /** Quando il server l'ha letta da Fitarco (ISO). */
  letta_il: string
  /** Quando il suo contenuto è cambiato (ISO). */
  aggiornato_il: string
}

/** La posizione di un atleta in una classifica (senza scaricare tutta la classifica). */
export interface MiaPosizione extends FiltroClassifica {
  categoria: string
  totale: number
  letta_il: string
  aggiornato_il: string
  riga: RigaClassificaRanking
}

export const NOMI_TIPO: Record<string, string> = {
  I: 'Indoor',
  T: 'Outdoor',
  C: 'Campagna',
  '3': '3D',
}
export const NOMI_CLASSE: Record<string, string> = {
  M: 'Master',
  S: 'Senior',
  J: 'Junior',
  A: 'Allievi',
  R: 'Ragazzi',
}
export const NOMI_GENERE: Record<string, string> = { M: 'Maschile', F: 'Femminile' }

/** "Indoor · Ricurvo · Senior M". */
export const titoloClassifica = (f: FiltroClassifica) =>
  `${NOMI_TIPO[f.tipo] ?? f.tipo} · ${nomeDivisione(f.divisione)} · ${NOMI_CLASSE[f.classe] ?? f.classe} ${f.genere}`

/** Indirizzo di una classifica nell'app: "/classifica/I/OL/S/M". */
export const percorsoClassifica = (f: FiltroClassifica) =>
  `/classifica/${f.tipo}/${f.divisione}/${f.classe}/${f.genere}`

/** Gli atleti dell'Umbria: i codici delle società iniziano con il numero del comitato (11). */
export const eUmbria = (r: Pick<RigaClassificaRanking, 'societa_codice'>) =>
  r.societa_codice.startsWith('11')

const semplifica = (testo: string) => testo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Le righe che corrispondono ai filtri: `testo` cerca nel nome e nella società (senza badare a maiuscole
 * e accenti), `soloUmbria` tiene gli atleti di società umbre. Le posizioni restano quelle nazionali.
 */
export function filtraClassifica(
  righe: readonly RigaClassificaRanking[],
  filtri: { testo?: string; soloUmbria?: boolean },
): RigaClassificaRanking[] {
  const parole = semplifica(filtri.testo ?? '')
    .split(/\s+/)
    .filter(Boolean)
  return righe.filter((r) => {
    if (filtri.soloUmbria && !eUmbria(r)) return false
    const pagliaio = semplifica(`${r.nome} ${r.societa_nome}`)
    return parole.every((p) => pagliaio.includes(p))
  })
}

/** "Terni (TR) 564 · Roma (RM) 554": le gare che fanno il punteggio. */
export const descriviGareRanking = (r: Pick<RigaClassificaRanking, 'gare'>) =>
  r.gare.map((g) => `${g.localita} ${g.punti}`).join(' · ')

/** "1.060": i punti con il punto delle migliaia, all'italiana (anche a 4 cifre, come sul sito Fitarco). */
export const formattaPunti = (punti: number) => String(punti).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

/**
 * "oggi alle 10:12", "ieri alle 10:12", "9 nov alle 10:12" (l'ora è quella del telefono): quando i dati
 * sono stati letti da Fitarco.
 */
export function descriviLettura(lettaIl: string, adesso: Date = new Date()): string {
  const quando = new Date(lettaIl)
  const due = (n: number) => String(n).padStart(2, '0')
  const giorno = (d: Date) => `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`
  const ora = `${due(quando.getHours())}:${due(quando.getMinutes())}`
  const ieri = new Date(adesso)
  ieri.setDate(ieri.getDate() - 1)
  if (giorno(quando) === giorno(adesso)) return `oggi alle ${ora}`
  if (giorno(quando) === giorno(ieri)) return `ieri alle ${ora}`
  const g = giorno(quando)
  return `${formattaDate(g, g, adesso.getFullYear())} alle ${ora}`
}

/** Le risposte della funzione "Aggiorna" (supabase/functions/aggiorna-classifica). */
export type RispostaAggiorna =
  | { esito: 'ok'; atleti: number; lettaIl: string }
  | {
      esito: 'anomalia' | 'troppo-presto' | 'troppe-richieste' | 'fitarco-non-risponde' | 'errore'
      errore: string
      riprovaDopo?: string
    }
  | { esito: 'rete' }

/** Cosa dire all'atleta dopo aver premuto "Aggiorna". */
export function messaggioAggiornamento(
  r: RispostaAggiorna,
  adesso: Date = new Date(),
): { tipo: 'success' | 'warning' | 'error'; testo: string } {
  switch (r.esito) {
    case 'ok':
      return { tipo: 'success', testo: `Classifica aggiornata: ${r.atleti} atleti.` }
    case 'rete':
      return { tipo: 'warning', testo: 'Serve la rete per aggiornare la classifica.' }
    case 'troppo-presto':
    case 'troppe-richieste':
    case 'fitarco-non-risponde': {
      const dopo = r.riprovaDopo ? ` Riprova ${descriviLettura(r.riprovaDopo, adesso)}.` : ''
      return { tipo: 'warning', testo: `${r.errore}${dopo}` }
    }
    default:
      return { tipo: 'error', testo: r.errore }
  }
}
