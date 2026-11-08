/**
 * Il pulsante "Aggiorna" del tab Classifica (Fase 5): rilegge una classifica da Fitarco, se è consentito.
 * La funzione del server `aggiorna-classifica` passa database e Fitarco veri, i test quelli finti.
 *
 * Regole: solo i membri; la stessa classifica al massimo ogni 6 ore; un tetto di letture all'ora per
 * tutta la compagnia; se Fitarco non risponde ci si ferma (come il controllo automatico).
 */
import {
  filtroValido,
  chiaveClassifica,
  valutaAggiornamento,
  type Valutazione,
} from './classifica.ts'
import {
  aggiornaClassifica,
  FitarcoNonRisponde,
  PAUSA_DOPO_BLOCCO_MS,
  PREFISSO_BLOCCO,
  type Contesto,
} from './motore.ts'

export interface DipendenzeAggiornaClassifica {
  ctx: Contesto
  /** Chi chiama è un atleta attivo? */
  chiamanteMembro(): Promise<boolean>
  adesso(): Date
}

export type RispostaAggiornaClassifica = { stato: number; corpo: Record<string, unknown> }

const risposta = (stato: number, corpo: Record<string, unknown>): RispostaAggiornaClassifica => ({
  stato,
  corpo,
})

/** I motivi per cui non si può leggere adesso, con il codice HTTP e le parole per l'atleta. */
const RIFIUTI: Record<
  Extract<Valutazione, { consentita: false }>['motivo'],
  { stato: number; messaggio: string }
> = {
  'troppo-presto': {
    stato: 429,
    messaggio: 'Questa classifica è stata aggiornata da poco: si può rileggere ogni 6 ore.',
  },
  'troppe-richieste': {
    stato: 429,
    messaggio: 'Troppe classifiche aggiornate nell’ultima ora: riprova tra poco.',
  },
  'fitarco-non-risponde': {
    stato: 503,
    messaggio: 'Il sito Fitarco non risponde: riprova più tardi.',
  },
}

export async function gestisciAggiornaClassifica(
  corpo: unknown,
  dip: DipendenzeAggiornaClassifica,
): Promise<RispostaAggiornaClassifica> {
  if (!(await dip.chiamanteMembro())) return risposta(403, { errore: 'Accesso non consentito.' })

  const richiesta = (typeof corpo === 'object' && corpo !== null ? corpo : {}) as Record<
    string,
    unknown
  >
  if (!filtroValido(richiesta)) return risposta(400, { errore: 'Classifica non valida.' })
  const filtro = {
    tipo: richiesta.tipo,
    divisione: richiesta.divisione,
    classe: richiesta.classe,
    genere: richiesta.genere,
  }

  const { archivio } = dip.ctx
  const adesso = dip.adesso()
  const chiave = chiaveClassifica(filtro)
  const salvata = (await archivio.classificheRanking()).find((c) => chiaveClassifica(c) === chiave)
  const valutazione = valutaAggiornamento({
    adesso,
    lettaIl: salvata?.letta_il ?? null,
    lettureUltimaOra: await archivio.lettureClassificheDa(new Date(adesso.getTime() - 3_600_000)),
    ultimoBlocco: await archivio.ultimoBlocco(),
    pausaDopoBloccoMs: PAUSA_DOPO_BLOCCO_MS,
  })
  if (!valutazione.consentita) {
    const { stato, messaggio } = RIFIUTI[valutazione.motivo]
    return risposta(stato, {
      esito: valutazione.motivo,
      errore: messaggio,
      riprovaDopo: valutazione.riprovaDopo,
    })
  }

  const prima = dip.ctx.fonte.richiesteFatte
  const fatte = () => dip.ctx.fonte.richiesteFatte - prima
  try {
    const r = await aggiornaClassifica(dip.ctx, filtro)
    await archivio.registra({
      tipo: 'ranking',
      chiave,
      esito: r.esito,
      messaggio: `Pulsante Aggiorna: ${r.messaggio}`,
      richieste: fatte(),
    })
    if (r.esito === 'anomalia') {
      return risposta(200, {
        esito: 'anomalia',
        errore: 'Fitarco ha risposto in modo strano: la classifica non è stata aggiornata.',
      })
    }
    return risposta(200, { esito: 'ok', atleti: r.atleti, lettaIl: adesso.toISOString() })
  } catch (e) {
    const testo = e instanceof Error ? e.message : String(e)
    const blocco = e instanceof FitarcoNonRisponde
    await archivio.registra({
      tipo: 'ranking',
      chiave,
      esito: 'errore',
      messaggio: blocco ? `${PREFISSO_BLOCCO}${testo}` : testo,
      richieste: fatte(),
    })
    if (blocco) {
      return risposta(503, {
        esito: 'fitarco-non-risponde',
        errore: RIFIUTI['fitarco-non-risponde'].messaggio,
        riprovaDopo: new Date(adesso.getTime() + PAUSA_DOPO_BLOCCO_MS).toISOString(),
      })
    }
    return risposta(502, {
      esito: 'errore',
      errore: 'Non sono riuscito a leggere la classifica da Fitarco. Riprova più tardi.',
    })
  }
}
