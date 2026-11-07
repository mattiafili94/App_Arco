/**
 * Cosa leggere da Fitarco, e quando (CLAUDE.md, "Dati Fitarco: cosa, da dove, quando").
 * Funzione pura: riceve lo stato (dal database) e restituisce la lista di lavoro. Poche letture, di rado.
 */
import type { StatoGara } from '../fitarco/calendario.ts'

export type TipoLettura = 'calendario' | 'scheda-gara' | 'invito' | 'scheda-atleta' | 'risultati'

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

const giorni = (da: string, a: string) => Math.round((Date.parse(a) - Date.parse(da)) / 86_400_000)

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

  // Calendari: l'anno in corso, il prossimo da ottobre (calendario provvisorio), e gli anni degli
  // storici finché hanno gare non ancora definitive.
  const anno = Number(s.oggi.slice(0, 4))
  const anni = new Set([anno, ...s.anniStorico])
  if (Number(s.oggi.slice(5, 7)) >= 10) anni.add(anno + 1)
  for (const a of [...anni].sort()) {
    const inSospeso = s.gare.some(
      (g) =>
        g.rilevante && g.dal.startsWith(String(a)) && !['omologata', 'annullata'].includes(g.stato),
    )
    const daLeggere = a >= anno || inSospeso || ultima('calendario', String(a)) === undefined
    if (daLeggere && scaduta('calendario', String(a), OGNI.calendario)) {
      aggiungi('calendario', String(a), PRIORITA.calendario)
    }
  }

  for (const g of s.gare) {
    if (!g.rilevante || g.stato === 'annullata') continue
    const futura = g.dal >= s.oggi
    const finita = g.al < s.oggi

    // Inviti delle gare future dell'Umbria.
    if (futura && g.inCalendarioUmbria && (g.haInvito || g.stato === 'invito')) {
      if (scaduta('invito', g.codice, OGNI.invito)) aggiungi('invito', g.codice, PRIORITA.invito)
    }

    // Dopo la gara: la scheda dà il link al PDF dei risultati.
    if (finita && !g.urlRisultati) {
      const ogni = giorni(g.al, s.oggi) <= 30 ? OGNI.schedaGaraPrimoMese : OGNI.schedaGaraDopo
      if (scaduta('scheda-gara', g.codice, ogni))
        aggiungi('scheda-gara', g.codice, PRIORITA.schedaGara)
    }

    // PDF dei risultati: la prima volta, poi finché sono provvisori (subito quando la gara è omologata).
    if (g.urlRisultati) {
      const daLeggere =
        g.risultati === null ||
        (g.risultati.provvisoria &&
          (g.stato === 'omologata' || scaduta('risultati', g.codice, OGNI.risultatiProvvisori)))
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
