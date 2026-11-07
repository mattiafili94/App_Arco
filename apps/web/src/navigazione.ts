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
