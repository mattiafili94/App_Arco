import { Calendar, Target, Trophy, Users } from 'lucide-react'
import type { Destination } from './componenti/NavigationBar'

/** I quattro tab dell'app, sempre in questo ordine (icone: design-system/README.md). */
export const DESTINAZIONI: readonly Destination[] = [
  { id: 'gare', label: 'Gare', icon: Calendar, href: '#gare' },
  { id: 'atleti', label: 'Atleti', icon: Users, href: '#atleti' },
  { id: 'classifica', label: 'Classifica', icon: Trophy, href: '#classifica' },
  { id: 'allenamento', label: 'Allenamento', icon: Target, href: '#allenamento' },
]
