/**
 * Cosa leggere da Fitarco, e quando (CLAUDE.md, "Dati Fitarco: cosa, da dove, quando").
 * Funzione pura: riceve lo stato (dal database) e restituisce la lista di lavoro. Poche letture, di rado.
 */
import type { StatoGara } from '../fitarco/calendario.ts'

/** `ranking` non lo pianifica il calendario: si chiede con il pulsante "Aggiorna". */
export type TipoLettura =
  'calendario' | 'scheda-gara' | 'invito' | 'scheda-atleta' | 'risultati' | 'ranking'

export interface Lettura {
  tipo: TipoLettura
  chiave: string
  /** Più alta = prima. */
  priorita: number
}

export interface StatoPianificazione {
  /** Data di oggi, "AAAA-MM-GG". */
  oggi: string
  /** Quando è stata letta l'ultima volta (con successo) una cosa: "tipo|chiave" → "AAAA-MM-GG". */
  ultimeLetture: ReadonlyMap<string, string>
  gare: readonly {
    codice: string
    dal: string
    al: string
    stato: StatoGara
    /** Nel calendario dell'Umbria o nello storico di un nostro atleta. */
    rilevante: boolean
    inCalendarioUmbria: boolean
    haInvito: boolean
    urlRisultati: string | null
    /** Classifica salvata: null se non ancora letta. */
    risultati: { provvisoria: boolean } | null
  }[]
  atleti: readonly { id: string }[]
}

/** Ogni quanti giorni rileggere. */
export const OGNI = {
  /** Calendario completo dell'anno in corso (gare nuove, cambiate, annullate). */
  calendario: 7,
  /** I mesi con gare future dell'Umbria ancora senza invito: ogni giorno, per accorgersi presto degli inviti. */
  calendarioInviti: 1,
  invito: 7,
  schedaAtleta: 7,
  /** Scheda gara (link al PDF) dopo la gara, finché non escono i risultati… */
  schedaGaraPrimoMese: 1,
  /** …e dopo il primo mese, se non sono ancora usciti. */
  schedaGaraDopo: 7,
  /** Risultati provvisori, finché la gara non è omologata. */
  risultatiProvvisori: 3,
} as const

export const PRIORITA = {
  schedaAtletaNuova: 30,
  calendario: 20,
  risultati: 15,
  schedaGara: 10,
  invito: 5,
  schedaAtleta: 5,
} as const

/** Giorni dopo la gara oltre i quali i risultati si considerano definitivi anche senza omologazione. */
export const GIORNI_RISULTATI_DEFINITIVI = 60
/** Giorni dopo la gara oltre i quali non si cerca più un PDF dei risultati mai uscito. */
export const GIORNI_MASSIMI_ATTESA_PDF = 90

/**
 * Il controllo giornaliero degli inviti guarda solo le gare dei prossimi 60 giorni (Mattia, 10/11/2026): di solito
 * l'invito esce poche settimane prima, e per le gare più lontane basta il calendario intero della settimana.
 * Così a gennaio non partono 10 richieste al giorno (una per ogni mese dell'anno).
 */
export const GIORNI_CONTROLLO_INVITI = 60

export const giorni = (da: string, a: string) =>
  Math.round((Date.parse(a) - Date.parse(da)) / 86_400_000)

/** Anni interi, prima di quello in corso, con le classifiche complete (scelta di Mattia, 9/11/2026). */
export const ANNI_CLASSIFICHE_COMPLETE = 1

/**
 * Dal giorno restituito ("AAAA-01-01") le classifiche si tengono complete (tutti gli atleti); per le
 * gare più vecchie solo le righe dei nostri atleti (con parziali e prove, per record e statistiche).
 * Novembre 2026 → "2025-01-01": 2026 e 2025 complete.
 */
export function inizioClassificheComplete(oggi: string): string {
  return `${Number(oggi.slice(0, 4)) - ANNI_CLASSIFICHE_COMPLETE}-01-01`
}

/**
 * I risultati di una gara sono ancora provvisori? Sì finché la gara non è omologata, ma al massimo per
 * GIORNI_RISULTATI_DEFINITIVI giorni: lo stato arriva solo dal calendario dell'Umbria dell'anno in corso,
 * quindi per le gare fuori regione (stato sconosciuto) e per quelle di fine anno (a gennaio il loro
 * calendario non si legge più) l'omologazione non si vedrebbe mai.
 */
export function risultatiProvvisori(g: { stato: StatoGara; al: string }, oggi: string): boolean {
  return g.stato !== 'omologata' && giorni(g.al, oggi) <= GIORNI_RISULTATI_DEFINITIVI
}

export function pianificaLetture(s: StatoPianificazione): Lettura[] {
  const lista: Lettura[] = []
  const ultima = (tipo: TipoLettura, chiave: string) => s.ultimeLetture.get(`${tipo}|${chiave}`)
  /** Da leggere se mai letta o letta da almeno `ogni` giorni. */
  const scaduta = (tipo: TipoLettura, chiave: string, ogni: number) => {
    const quando = ultima(tipo, chiave)
    return quando === undefined || giorni(quando, s.oggi) >= ogni
  }
  const aggiungi = (tipo: TipoLettura, chiave: string, priorita: number) =>
    lista.push({ tipo, chiave, priorita })

  // Le gare più vecchie della finestra delle classifiche complete si conoscono solo dallo storico
  // degli atleti (una richiesta per atleta): niente calendari, schede gara né PDF per loro.
  const inizio = inizioClassificheComplete(s.oggi)

  // Calendari (Mattia, 8/11 e 10/11/2026). Quelli degli anni passati non interessano: le gare passate
  // arrivano dagli storici degli atleti.
  // - Anno in corso: tutto, una volta a settimana (gare nuove, cambiate, annullate).
  // - Ogni giorno, solo i MESI con gare dell'Umbria dei prossimi 60 giorni ancora senza invito (una richiesta per mese, chiave
  //   "AAAA-MM"): così un invito nuovo si vede entro un giorno. Non serve quando si legge tutto l'anno.
  // - Anno prossimo: solo a dicembre, una volta a settimana, per sapere quando diventa definitivo (finché è
  //   provvisorio non si salva niente: vedi il motore).
  const anno = Number(s.oggi.slice(0, 4))
  const tuttoLAnno = scaduta('calendario', String(anno), OGNI.calendario)
  if (tuttoLAnno) aggiungi('calendario', String(anno), PRIORITA.calendario)
  if (!tuttoLAnno) {
    const mesi = new Set(
      s.gare
        .filter(
          (g) =>
            g.inCalendarioUmbria &&
            g.dal >= s.oggi &&
            giorni(s.oggi, g.dal) <= GIORNI_CONTROLLO_INVITI &&
            g.dal.startsWith(`${anno}-`) &&
            g.stato !== 'annullata' &&
            g.stato !== 'invito' &&
            !g.haInvito,
        )
        .map((g) => g.dal.slice(0, 7)),
    )
    for (const m of [...mesi].sort()) {
      if (scaduta('calendario', m, OGNI.calendarioInviti)) {
        aggiungi('calendario', m, PRIORITA.calendario)
      }
    }
  }
  if (s.oggi.slice(5, 7) === '12' && scaduta('calendario', String(anno + 1), OGNI.calendario)) {
    aggiungi('calendario', String(anno + 1), PRIORITA.calendario)
  }

  for (const g of s.gare) {
    if (!g.rilevante || g.stato === 'annullata' || g.dal < inizio) continue
    const futura = g.dal >= s.oggi
    const finita = g.al < s.oggi

    // Inviti delle gare future dell'Umbria.
    if (futura && g.inCalendarioUmbria && (g.haInvito || g.stato === 'invito')) {
      if (scaduta('invito', g.codice, OGNI.invito)) aggiungi('invito', g.codice, PRIORITA.invito)
    }

    // Dopo la gara: la scheda dà il link al PDF dei risultati (le gare vecchie si controllano una
    // volta sola, poi si smette se il PDF non è mai uscito).
    if (finita && !g.urlRisultati) {
      const dopo = giorni(g.al, s.oggi)
      const ogni = dopo <= 30 ? OGNI.schedaGaraPrimoMese : OGNI.schedaGaraDopo
      const maiLetta = ultima('scheda-gara', g.codice) === undefined
      if (
        (dopo <= GIORNI_MASSIMI_ATTESA_PDF || maiLetta) &&
        scaduta('scheda-gara', g.codice, ogni)
      ) {
        aggiungi('scheda-gara', g.codice, PRIORITA.schedaGara)
      }
    }

    // PDF dei risultati: la prima volta, poi finché sono provvisori (subito quando diventano definitivi).
    // Un PDF letto ma non salvato (anomalia della sentinella) si riprova ogni 3 giorni.
    if (g.urlRisultati) {
      // Senza classifica salvata (anomalia, o gara vecchia senza nostri atleti riconosciuti): si
      // riprova ogni 3 giorni, ma per le gare finite da più di 90 giorni basta la prima lettura.
      const recente = giorni(g.al, s.oggi) <= GIORNI_MASSIMI_ATTESA_PDF
      const daLeggere =
        g.risultati === null
          ? ultima('risultati', g.codice) === undefined ||
            (recente && scaduta('risultati', g.codice, OGNI.risultatiProvvisori))
          : g.risultati.provvisoria &&
            (!risultatiProvvisori(g, s.oggi) ||
              scaduta('risultati', g.codice, OGNI.risultatiProvvisori))
      if (daLeggere) aggiungi('risultati', g.codice, PRIORITA.risultati)
    }
  }

  // Schede atleta: subito per chi è appena entrato, poi una volta a settimana.
  for (const a of s.atleti) {
    if (ultima('scheda-atleta', a.id) === undefined) {
      aggiungi('scheda-atleta', a.id, PRIORITA.schedaAtletaNuova)
    } else if (scaduta('scheda-atleta', a.id, OGNI.schedaAtleta)) {
      aggiungi('scheda-atleta', a.id, PRIORITA.schedaAtleta)
    }
  }

  return lista.sort((x, y) => y.priorita - x.priorita)
}
