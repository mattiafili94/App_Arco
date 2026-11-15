/**
 * Il sondaggio "Partecipo / Non partecipo" di una gara (Fase 3.5, Mattia 15/11/2026): regole pure per l'app.
 * - L'amministratore lo apre per una gara futura, non annullata, con l'invito; lo chiude quando vuole.
 * - Ogni atleta risponde solo per sé e può cambiare idea finché il sondaggio è aperto e la gara non è passata.
 * - Tutti vedono le risposte.
 */
import { garaPassata, type Gara } from './gare'

/** Un sondaggio com'è sul telefono (tabella `sondaggi`). */
export interface Sondaggio {
  gara_codice: string
  aperto: boolean
  aperto_da: string | null
  aperto_il: string
  chiuso_il: string | null
  /** I turni della gara (`AAAA-MM-GG:mattina|pomeriggio`); vuoto = senza turni. Manca nelle copie vecchie. */
  turni?: string[]
  aggiornato_il: string
}

/** Una risposta com'è sul telefono (tabella `risposte_sondaggio`). */
export interface RispostaSondaggio {
  gara_codice: string
  atleta_id: string
  partecipa: boolean
  /** Il turno scelto da chi partecipa (uno dei turni del sondaggio); vuoto se non partecipa o senza turni. */
  turno?: string | null
  /** Ora del telefono quando l'atleta ha risposto: vince la più recente. */
  modificato_il: string
  /** Ora del server; manca finché la risposta non è arrivata al server. */
  aggiornato_il?: string
}

/** Si può aprire il sondaggio di questa gara? (come `apri_sondaggio` sul server) */
export function puoAprireSondaggio(
  g: Pick<Gara, 'al' | 'stato' | 'ha_invito'>,
  oggi: string,
): boolean {
  return g.ha_invito && g.stato !== 'annullata' && !garaPassata(g, oggi)
}

/** Si può ancora rispondere? (come `rispondi_sondaggio` sul server) */
export function sondaggioRispondibile(
  s: Pick<Sondaggio, 'aperto'> | null | undefined,
  g: Pick<Gara, 'al'>,
  oggi: string,
): boolean {
  return !!s?.aperto && !garaPassata(g, oggi)
}

export interface PersonaSondaggio {
  id: string
  nome: string
  cognome: string
}

export interface RiepilogoSondaggio<P extends PersonaSondaggio> {
  partecipano: P[]
  nonPartecipano: P[]
  /** Chi è nell'elenco degli atleti e non ha ancora risposto. */
  senzaRisposta: P[]
}

const perCognome = (a: PersonaSondaggio, b: PersonaSondaggio) =>
  a.cognome.localeCompare(b.cognome, 'it') || a.nome.localeCompare(b.nome, 'it')

/**
 * Chi partecipa, chi no e chi non ha risposto, in ordine di cognome. `atleti` = chi può rispondere (gli atleti
 * attivi con l'accesso); chi ha risposto e poi è uscito dall'elenco resta tra le risposte se è tra `tutti`.
 */
export function riepilogoSondaggio<P extends PersonaSondaggio>(
  risposte: readonly Pick<RispostaSondaggio, 'atleta_id' | 'partecipa'>[],
  atleti: readonly P[],
  tutti: readonly P[] = atleti,
): RiepilogoSondaggio<P> {
  const perId = new Map([...tutti, ...atleti].map((a) => [a.id, a]))
  const risposto = new Map(risposte.map((r) => [r.atleta_id, r.partecipa]))
  const con = (partecipa: boolean) =>
    risposte
      .filter((r) => r.partecipa === partecipa)
      .map((r) => perId.get(r.atleta_id))
      .filter((a): a is P => a !== undefined)
      .sort(perCognome)
  return {
    partecipano: con(true),
    nonPartecipano: con(false),
    senzaRisposta: atleti.filter((a) => !risposto.has(a.id)).sort(perCognome),
  }
}

/** "Mario Rossi, Anna Verdi" (nome e cognome, nell'ordine dato). */
export const elencoNomi = (persone: readonly PersonaSondaggio[]) =>
  persone.map((p) => `${p.nome} ${p.cognome}`).join(', ')

/**
 * Come si mostra una gara negli elenchi per chi guarda (Mattia, 15/11/2026): solo le gare future.
 * - `da-rispondere` (giallo): il sondaggio è aperto e non hai ancora risposto;
 * - `partecipi` (verde) / `non-partecipi` (rosso): la tua risposta, anche a sondaggio chiuso.
 * `null`: niente da mostrare (gara passata, nessun sondaggio, sondaggio chiuso senza risposta).
 */
export type StatoSondaggioGara = 'da-rispondere' | 'scegli-turno' | 'partecipi' | 'non-partecipi'

/**
 * `scegli-turno` (giallo): partecipi ma senza turno (risposta da un'app vecchia) a un sondaggio aperto con i turni.
 */
export function statoSondaggioGara(
  s: Pick<Sondaggio, 'aperto' | 'turni'> | null | undefined,
  risposta: Pick<RispostaSondaggio, 'partecipa' | 'turno'> | null | undefined,
  g: Pick<Gara, 'al'>,
  oggi: string,
): StatoSondaggioGara | null {
  if (garaPassata(g, oggi)) return null
  if (risposta) {
    if (!risposta.partecipa) return 'non-partecipi'
    if (s?.aperto && s.turni?.length && !risposta.turno) return 'scegli-turno'
    return 'partecipi'
  }
  return s?.aperto ? 'da-rispondere' : null
}

// I turni (Mattia, 15/11/2026): mattina e pomeriggio di ogni giorno della gara; chi partecipa ne sceglie uno.

const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

const dataUtc = (giorno: string) => new Date(`${giorno}T00:00:00Z`)

/** Tutti i turni che una gara può avere: mattina e pomeriggio di ogni giorno, in ordine (al massimo 14 giorni). */
export function turniPossibili(g: Pick<Gara, 'dal' | 'al'>): string[] {
  const turni: string[] = []
  const fine = dataUtc(g.al).getTime()
  for (
    const d = dataUtc(g.dal);
    d.getTime() <= fine && turni.length < 28;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const giorno = d.toISOString().slice(0, 10)
    turni.push(`${giorno}:mattina`, `${giorno}:pomeriggio`)
  }
  return turni
}

/**
 * "Sabato mattina"; con `conData` "Sabato 12 dic, mattina" (serve quando la gara dura più di una settimana e lo
 * stesso giorno della settimana torna due volte).
 */
export function etichettaTurno(turno: string, conData = false): string {
  const [giorno = '', parte = ''] = turno.split(':')
  const d = dataUtc(giorno)
  const nome = GIORNI[d.getUTCDay()] ?? giorno
  return conData
    ? `${nome} ${d.getUTCDate()} ${MESI[d.getUTCMonth()]}, ${parte}`
    : `${nome} ${parte}`
}

/** Le etichette di un elenco di turni: con la data solo se un giorno della settimana si ripete. */
export function etichetteTurni(turni: readonly string[]): Map<string, string> {
  const giorni = [...new Set(turni.map((t) => t.split(':')[0] ?? ''))]
  const nomi = giorni.map((g) => dataUtc(g).getUTCDay())
  const conData = new Set(nomi).size < nomi.length
  return new Map(turni.map((t) => [t, etichettaTurno(t, conData)]))
}

export interface TurnoConPersone<P extends PersonaSondaggio> {
  turno: string
  persone: P[]
}

/**
 * Chi partecipa, turno per turno (nell'ordine dei turni del sondaggio, anche quelli senza nessuno), e chi partecipa
 * senza un turno valido (risposte da un'app vecchia).
 */
export function partecipantiPerTurno<P extends PersonaSondaggio>(
  partecipano: readonly P[],
  risposte: readonly Pick<RispostaSondaggio, 'atleta_id' | 'partecipa' | 'turno'>[],
  turni: readonly string[],
): { perTurno: TurnoConPersone<P>[]; senzaTurno: P[] } {
  const turnoDi = new Map(
    risposte.filter((x) => x.partecipa).map((x) => [x.atleta_id, x.turno ?? null]),
  )
  return {
    perTurno: turni.map((turno) => ({
      turno,
      persone: partecipano.filter((p) => turnoDi.get(p.id) === turno),
    })),
    senzaTurno: partecipano.filter((p) => {
      const t = turnoDi.get(p.id)
      return !t || !turni.includes(t)
    }),
  }
}
