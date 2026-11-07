import type { ServizioAccesso } from './servizio'
import { creaServizioSupabase } from './servizioSupabase'

const url = import.meta.env.VITE_SUPABASE_URL
const chiave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/**
 * Servizio usato dall'app. Se la build non ha l'indirizzo di Supabase (es. una copia senza
 * configurazione), l'app resta sulla pagina Accedi e lo dice, invece di rompersi.
 */
export const servizioPredefinito: ServizioAccesso =
  url && chiave
    ? creaServizioSupabase(url, chiave)
    : {
        sessioneSalvata: async () => null,
        accedi: async () => ({ esito: 'errore' }),
        esci: async () => {},
        profilo: async () => null,
        quandoEsce: () => () => {},
        elencoAtleti: async () => [],
        aggiungiAtleta: async () => ({ esito: 'errore' }),
        generaLink: async () => {
          throw new Error('App non collegata al server.')
        },
        revocaAccesso: async () => {
          throw new Error('App non collegata al server.')
        },
      }
