// Worker "arcieri-eugubini-controllo": il cron (wrangler.toml) lo sveglia ogni 30 minuti.
import { controlla, type Ambiente } from './controllo.ts'

interface ControlloProgrammato {
  scheduledTime: number
}

interface ContestoEsecuzione {
  waitUntil(lavoro: Promise<unknown>): void
}

export default {
  scheduled(evento: ControlloProgrammato, env: Ambiente, ctx: ContestoEsecuzione) {
    ctx.waitUntil(controlla(env, new Date(evento.scheduledTime)).then((r) => console.log(r.esito)))
  },

  // Nessuna pagina: il Worker serve solo al cron.
  fetch() {
    return new Response('Controllo automatico dell’app Arcieri Eugubini', { status: 404 })
  },
}
