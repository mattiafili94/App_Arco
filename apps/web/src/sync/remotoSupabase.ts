import type { SupabaseClient } from '@supabase/supabase-js'
import type { Remoto } from './remoto'
import { TABELLE, type Eliminazione, type Riga } from './tabelle'

function controlla<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}

/** La sincronizzazione sul server vero (Supabase): le regole di accesso decidono cosa vede ognuno. */
export function creaRemotoSupabase(supabase: SupabaseClient): Remoto {
  return {
    async cambiamenti(tabella, dal, da, quante) {
      const def = TABELLE.find((t) => t.nome === tabella)!
      let richiesta = supabase.from(tabella).select(def.colonne)
      if (dal) richiesta = richiesta.gte('aggiornato_il', dal)
      // Ordine stabile (data e poi chiave): le pagine non si sovrappongono né saltano righe.
      richiesta = richiesta.order('aggiornato_il', { ascending: true })
      for (const colonna of def.chiave) richiesta = richiesta.order(colonna, { ascending: true })
      return controlla(await richiesta.range(da, da + quante - 1)) as unknown as Riga[]
    },

    async eliminazioni(dopoId, quante) {
      return controlla(
        await supabase
          .from('eliminazioni')
          .select('id, tabella, chiave')
          .gt('id', dopoId)
          .order('id', { ascending: true })
          .limit(quante),
      ) as Eliminazione[]
    },

    async ultimaEliminazione() {
      const righe = controlla(
        await supabase.from('eliminazioni').select('id').order('id', { ascending: false }).limit(1),
      ) as { id: number }[]
      return righe[0]?.id ?? 0
    },
  }
}
