import type {
  ClassificaRanking,
  FiltroClassifica,
  MiaPosizione,
  RispostaAggiorna,
} from '@arco/shared'

/**
 * Cosa serve al tab Classifica dal server. L'implementazione vera usa Supabase
 * (servizioSupabase.ts); i test ne usano una finta.
 */
export interface ServizioClassifica {
  /** Le classifiche in cui compare la matricola, con la sua riga. Lancia un errore senza rete. */
  miePosizioni(matricola: string): Promise<MiaPosizione[]>
  /**
   * Una classifica dal nostro database (mai da Fitarco). `conosciuta` è la data di modifica della copia
   * che il telefono ha già: se non è cambiata non si riscarica niente (`'invariata'`). `null` se la
   * classifica non è mai stata scaricata. Lancia un errore senza rete.
   */
  leggi(
    filtro: FiltroClassifica,
    conosciuta: string | null,
  ): Promise<ClassificaRanking | 'invariata' | null>
  /** Il pulsante "Aggiorna": rilegge la classifica da Fitarco, se è consentito. */
  aggiorna(filtro: FiltroClassifica): Promise<RispostaAggiorna>
}
