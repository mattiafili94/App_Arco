import { Calendar, Target, Trophy, Users } from 'lucide-react'
import type { Destination } from './componenti/NavigationBar'

/** I quattro tab dell'app, sempre in questo ordine (icone: design-system/README.md). */
export const DESTINAZIONI: readonly Destination[] = [
  { id: 'gare', label: 'Gare', icon: Calendar, href: '/gare' },
  { id: 'atleti', label: 'Atleti', icon: Users, href: '/atleti' },
  { id: 'classifica', label: 'Classifica', icon: Trophy, href: '/classifica' },
  { id: 'allenamento', label: 'Allenamento', icon: Target, href: '/allenamento' },
]

export const PERCORSO_IMPOSTAZIONI = '/impostazioni'

/** Il tab a cui appartiene un indirizzo, se c'è. */
export function destinazioneDi(percorso: string): Destination | undefined {
  return DESTINAZIONI.find((d) => percorso === d.href || percorso.startsWith(`${d.href}/`))
}

/** Titolo della finestra/scheda del browser per un indirizzo. */
export function titoloDocumento(percorso: string): string {
  const pagina =
    destinazioneDi(percorso)?.label ??
    (percorso.startsWith(PERCORSO_IMPOSTAZIONI)
      ? 'Impostazioni'
      : percorso.startsWith('/amministrazione')
        ? 'Amministrazione'
        : undefined)
  return pagina ? `${pagina} · Arcieri Eugubini` : 'Arcieri Eugubini'
}

/** Dove porta la freccia "indietro" di una pagina che si apre da più posti (es. la scheda di una gara). */
export interface Indietro {
  label: string
  href: string
  /** Lo stato della pagina a cui si torna (se anche lei sa dove tornare). */
  state?: unknown
}

/**
 * Il "da dove vengo" che una pagina riceve con il collegamento (`state: { indietro }`), se c'è ed è valido.
 * Senza (pagina aperta da una notifica o da un link) la pagina usa il suo genitore di sempre.
 */
export function leggiIndietro(stato: unknown): Indietro | null {
  if (typeof stato !== 'object' || stato === null || !('indietro' in stato)) return null
  const i = (stato as { indietro: unknown }).indietro
  if (typeof i !== 'object' || i === null) return null
  const { label, href, state } = i as Record<string, unknown>
  if (typeof label !== 'string' || typeof href !== 'string' || !href.startsWith('/')) return null
  return { label, href, state }
}
