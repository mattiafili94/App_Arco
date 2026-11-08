import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js'
import type {
  ClassificaRanking,
  FiltroClassifica,
  MiaPosizione,
  RispostaAggiorna,
} from '@arco/shared'
import type { ServizioClassifica } from './servizio'

const senzaRete = () => typeof navigator !== 'undefined' && !navigator.onLine

function controlla<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}

/** Le classifiche sul server vero: lettura dal database con le regole dei membri, "Aggiorna" dalla funzione. */
export function creaServizioClassifica(supabase: SupabaseClient): ServizioClassifica {
  const dove = (f: FiltroClassifica) =>
    supabase
      .from('classifiche_ranking')
      .select('aggiornato_il')
      .eq('tipo', f.tipo)
      .eq('divisione', f.divisione)
      .eq('classe', f.classe)
      .eq('genere', f.genere)

  return {
    async miePosizioni(matricola) {
      return controlla(
        await supabase.rpc('mie_classifiche', { p_matricola: matricola }),
      ) as MiaPosizione[]
    },

    async leggi(filtro, conosciuta) {
      // Prima solo la data di modifica (pochi byte): la classifica intera pesa ~150 KB.
      const attuale = controlla(await dove(filtro).maybeSingle()) as {
        aggiornato_il: string
      } | null
      if (!attuale) return null
      if (conosciuta !== null && Date.parse(conosciuta) === Date.parse(attuale.aggiornato_il)) {
        return 'invariata'
      }
      const completa = controlla(
        await supabase
          .from('classifiche_ranking')
          .select(
            'tipo, divisione, classe, genere, categoria, totale, righe, letta_il, aggiornato_il',
          )
          .eq('tipo', filtro.tipo)
          .eq('divisione', filtro.divisione)
          .eq('classe', filtro.classe)
          .eq('genere', filtro.genere)
          .maybeSingle(),
      ) as ClassificaRanking | null
      return completa
    },

    async aggiorna(filtro) {
      if (senzaRete()) return { esito: 'rete' }
      const { data, error } = await supabase.functions.invoke<RispostaAggiorna>(
        'aggiorna-classifica',
        {
          body: filtro,
        },
      )
      if (!error) return data as RispostaAggiorna
      // Rifiuti previsti (troppo presto, Fitarco non risponde…) arrivano come errori HTTP con un corpo.
      if (error instanceof FunctionsHttpError) {
        const corpo = (await error.context.json().catch(() => null)) as RispostaAggiorna | null
        if (corpo && 'esito' in corpo) return corpo
      }
      return { esito: 'errore', errore: 'Non è stato possibile aggiornare. Riprova tra poco.' }
    },
  }
}
