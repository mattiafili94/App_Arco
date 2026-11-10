/**
 * "Leggi subito la scheda del nuovo atleta": quando l'amministratore aggiunge un atleta, l'app chiede al server
 * di leggere subito la sua scheda Fitarco (storico, classe, genere, righe nelle classifiche già salvate), senza
 * aspettare il prossimo giro del controllo automatico (che parte ogni 15 minuti).
 * La funzione del server `aggiorna-atleta` passa database e Fitarco veri, i test quelli finti.
 *
 * Regole: solo l'amministratore; è un giro normale del motore con **una sola lettura: una scheda atleta**
 * (quella di un atleta nuovo ha la priorità più alta, quindi è la prima). Se non c'è nessuna scheda da leggere
 * non fa nessuna richiesta a Fitarco: le altre letture restano al controllo automatico. Se Fitarco non risponde il giro si ferma e il controllo automatico riprova.
 */
import { giro, type Contesto } from './motore.ts'

export interface DipendenzeAggiornaAtleta {
  ctx: Contesto
  /** Chi chiama è l'amministratore? */
  chiamanteAmministratore(): Promise<boolean>
  adesso(): number
}

export type RispostaAggiornaAtleta = { stato: number; corpo: Record<string, unknown> }

/** Tempo massimo per questa lettura (il piano gratuito dà poco tempo di calcolo). */
export const TEMPO_MASSIMO_ATLETA_MS = 30_000

export async function gestisciAggiornaAtleta(
  dip: DipendenzeAggiornaAtleta,
): Promise<RispostaAggiornaAtleta> {
  if (!(await dip.chiamanteAmministratore())) {
    return { stato: 403, corpo: { errore: 'Accesso non consentito.' } }
  }
  const riepilogo = await giro(dip.ctx, {
    massimo: 1,
    massimoPesanti: 0,
    soloTipi: ['scheda-atleta'],
    scadenza: dip.adesso() + TEMPO_MASSIMO_ATLETA_MS,
    adesso: dip.adesso,
  })
  return {
    stato: 200,
    corpo: {
      letture: riepilogo.eseguite.map((e) => ({ tipo: e.tipo, esito: e.esito })),
      fermato: riepilogo.fermato,
    },
  }
}
