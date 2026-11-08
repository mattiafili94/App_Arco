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
  /** Anni che compaiono negli storici degli atleti. */
  anniStorico: readonly number[]
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
  calendario: 7,
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

/** Giorni dopo i quali i risultati di una gara fuori Umbria si considerano definitivi. */
export const GIORNI_DEFINITIVI_FUORI_UMBRIA = 60
/** Giorni dopo la gara oltre i quali non si cerca più un PDF dei risultati mai uscito. */
export const GIORNI_MASSIMI_ATTESA_PDF = 90

export const giorni = (da: string, a: string) =>
  Math.round((Date.parse(a) - Date.parse(da)) / 86_400_000)

/**
 * I risultati di una gara sono ancora provvisori? Per le gare dell'Umbria lo dice il calendario
 * (omologata o no). Per quelle fuori regione lo stato non si conosce (il calendario "00" ha solo le
 * gare nazionali): si considerano definitivi dopo GIORNI_DEFINITIVI_FUORI_UMBRIA giorni.
 */
/** Anni interi, prima di quello in corso, con le classifiche complete (scelta di Mattia, 8/11/2026). */
export const ANNI_CLASSIFICHE_COMPLETE = 2

/**
 * Dal giorno restituito ("AAAA-01-01") le classifiche si tengono complete (tutti gli atleti); per le
 * gare più vecchie solo le righe dei nostri atleti (con parziali e prove, per record e statistiche).
 * Novembre 2026 → "2024-01-01": 2026, 2025 e 2024 complete.
 */
export function inizioClassificheComplete(oggi: string): string {
  return `${Number(oggi.slice(0, 4)) - ANNI_CLASSIFICHE_COMPLETE}-01-01`
}

export function risultatiProvvisori(g: { stato: StatoGara; al: string }, oggi: string): boolean {
  if (g.stato === 'omologata') return false
  if (g.stato === 'sconosciuto') return giorni(g.al, oggi) <= GIORNI_DEFINITIVI_FUORI_UMBRIA
  return true
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
  const annoInizio = Number(inizio.slice(0, 4))

  // Calendari: l'anno in corso, il prossimo da ottobre (calendario provvisorio), e gli anni degli
  // storici (dentro la finestra) finché hanno gare dell'Umbria non ancora definitive.
  const anno = Number(s.oggi.slice(0, 4))
  const anni = new Set([anno, ...s.anniStorico.filter((a) => a >= annoInizio)])
  if (Number(s.oggi.slice(5, 7)) >= 10) anni.add(anno + 1)
  for (const a of [...anni].sort()) {
    const inSospeso = s.gare.some(
      (g) =>
        g.rilevante &&
        g.inCalendarioUmbria &&
        g.dal.startsWith(String(a)) &&
        !['omologata', 'annullata'].includes(g.stato),
    )
    const daLeggere = a >= anno || inSospeso || ultima('calendario', String(a)) === undefined
    if (daLeggere && scaduta('calendario', String(a), OGNI.calendario)) {
      aggiungi('calendario', String(a), PRIORITA.calendario)
    }
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
