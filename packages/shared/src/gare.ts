/**
 * Come si mostra una gara nell'app (Fase 3.2): date, stato, nome della tipologia e "Aggiungi al
 * calendario" (file .ics per il telefono e link per Google Calendar). Funzioni pure, nessun accesso
 * a dati o rete.
 */
import { riconosciTipologia } from './tipologie'

/** Una gara com'è salvata sul telefono (tabella `gare`, vedi supabase/migrations). */
export interface Gara {
  codice: string
  /** "AAAA-MM-GG". */
  dal: string
  al: string
  calendario: string
  regione: string | null
  localita: string
  /** Come la scrive Fitarco: "18 m", "Doppio 70/60mt Round - Doppio 50mt Round"… */
  tipologia: string
  dettaglio: string | null
  societa_codice: string | null
  societa_nome: string | null
  stato:
    | 'omologata'
    | 'da-omologare'
    | 'non-trasferita'
    | 'in-elaborazione'
    | 'annullata'
    | 'invito'
    | 'in-calendario'
    | 'sconosciuto'
  in_calendario_umbria: boolean
  ha_invito: boolean
  url_risultati: string | null
}

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

const analizza = (data: string) => {
  const [anno, mese, giorno] = data.split('-').map(Number) as [number, number, number]
  return { anno, mese, giorno }
}

/**
 * "24–25 ott 2026", "24 ott 2026", "30 ott – 1 nov 2026". Con `annoCorrente` l'anno si omette per le
 * gare di quell'anno (nell'elenco: "24–25 ott").
 */
export function formattaDate(dal: string, al: string, annoCorrente?: number): string {
  const a = analizza(dal)
  const b = analizza(al)
  const anno = (n: number) => (n === annoCorrente ? '' : ` ${n}`)
  if (dal === al) return `${a.giorno} ${MESI[a.mese - 1]}${anno(a.anno)}`
  if (a.anno === b.anno && a.mese === b.mese) {
    return `${a.giorno}–${b.giorno} ${MESI[a.mese - 1]}${anno(a.anno)}`
  }
  if (a.anno === b.anno) {
    return `${a.giorno} ${MESI[a.mese - 1]} – ${b.giorno} ${MESI[b.mese - 1]}${anno(a.anno)}`
  }
  return `${a.giorno} ${MESI[a.mese - 1]}${anno(a.anno)} – ${b.giorno} ${MESI[b.mese - 1]}${anno(b.anno)}`
}

/** Nome breve della tipologia ("18 m", "Doppio 70 m"); se non la conosciamo, quello di Fitarco. */
export function etichettaTipologia(tipologia: string): string {
  return riconosciTipologia(tipologia)?.etichetta ?? tipologia
}

/** La gara è finita? (`oggi` = "AAAA-MM-GG") */
export const garaPassata = (g: Pick<Gara, 'al'>, oggi: string) => g.al < oggi

/**
 * Una frase sullo stato della gara, o `null` se non c'è niente da dire:
 * gare future → invito; gare passate → risultati. Le gare annullate lo dicono sempre.
 */
export function descriviStato(g: Gara, oggi: string): string | null {
  if (g.stato === 'annullata') return 'Annullata'
  if (!garaPassata(g, oggi))
    return g.ha_invito || g.stato === 'invito' ? 'Invito disponibile' : null
  if (!g.url_risultati) return null
  return g.stato === 'omologata' ? 'Risultati definitivi' : 'Risultati disponibili'
}

// --- Aggiungi al calendario ---------------------------------------------------------------------

/** "2026-12-13" → "20261213" (formato dei calendari). */
const senzaTrattini = (data: string) => data.replaceAll('-', '')

/** Il giorno dopo ("AAAA-MM-GG"): i calendari vogliono la fine "esclusa" per gli eventi di giorni interi. */
export function giornoDopo(data: string): string {
  const { anno, mese, giorno } = analizza(data)
  return new Date(Date.UTC(anno, mese - 1, giorno + 1)).toISOString().slice(0, 10)
}

const titoloEvento = (g: Gara) => `${etichettaTipologia(g.tipologia)} – ${g.localita}`

const descrizioneEvento = (g: Gara) =>
  [
    g.societa_nome ? `Organizza ${g.societa_nome}` : null,
    g.dettaglio ? g.dettaglio : null,
    `Gara ${g.codice}`,
  ]
    .filter(Boolean)
    .join('\n')

/** Testo per un campo .ics: va protetto da barre rovesciate, virgole, punti e virgola e a capo. */
const protetto = (testo: string) =>
  testo.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** Va a capo ogni 75 byte (UTF-8), come vuole lo standard: le righe seguenti iniziano con uno spazio. */
function piegaRiga(riga: string): string[] {
  const codifica = new TextEncoder()
  const righe: string[] = []
  let corrente = ''
  let byte = 0
  for (const carattere of riga) {
    const dimensione = codifica.encode(carattere).length
    // Le righe di continuazione iniziano con uno spazio, che conta anch'esso.
    const limite = righe.length === 0 ? 75 : 74
    if (byte + dimensione > limite) {
      righe.push(corrente)
      corrente = ''
      byte = 0
    }
    corrente += carattere
    byte += dimensione
  }
  righe.push(corrente)
  return righe.map((r, i) => (i === 0 ? r : ` ${r}`))
}

/** "20261110T100000Z". */
const marcaTempo = (istante: Date) => istante.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'

/**
 * File .ics (iCalendar) con un evento di giorni interi per la gara e un avviso alle 9:00 del giorno
 * prima. Si apre con il calendario del telefono (iPhone e Android).
 */
export function creaIcs(g: Gara, adesso: Date = new Date()): string {
  const righe = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Arcieri Eugubini//App//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${g.codice}@arcieri-eugubini.pages.dev`,
    `DTSTAMP:${marcaTempo(adesso)}`,
    `DTSTART;VALUE=DATE:${senzaTrattini(g.dal)}`,
    `DTEND;VALUE=DATE:${senzaTrattini(giornoDopo(g.al))}`,
    `SUMMARY:${protetto(titoloEvento(g))}`,
    `LOCATION:${protetto(g.localita)}`,
    `DESCRIPTION:${protetto(descrizioneEvento(g))}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT15H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${protetto(`Domani: ${titoloEvento(g)}`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return righe.flatMap(piegaRiga).join('\r\n') + '\r\n'
}

/** Nome del file da scaricare: "gara-R2611039.ics". */
export const nomeFileIcs = (g: Pick<Gara, 'codice'>) => `gara-${g.codice}.ics`

/** Link che apre Google Calendar con l'evento già compilato (Android). */
export function linkGoogleCalendar(g: Gara): string {
  const parametri = new URLSearchParams({
    action: 'TEMPLATE',
    text: titoloEvento(g),
    dates: `${senzaTrattini(g.dal)}/${senzaTrattini(giornoDopo(g.al))}`,
    location: g.localita,
    details: descrizioneEvento(g),
  })
  return `https://calendar.google.com/calendar/render?${parametri.toString()}`
}
