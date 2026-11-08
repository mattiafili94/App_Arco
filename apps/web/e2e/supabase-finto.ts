import type { Page, Route } from '@playwright/test'

/**
 * Supabase simulato nel browser di prova: risponde alle chiamate dell'app con dati inventati.
 * L'app di prova è costruita con questo indirizzo (vedi playwright.config.ts).
 */
export const URL_SUPABASE_FINTO = 'https://supabase.prova.invalid'
export const CODICE_PROVA = 'K7PM3XQR9A'

export interface AtletaProva {
  id: string
  matricola: string
  nome: string
  cognome: string
  ruolo: 'atleta' | 'amministratore'
  attivo: boolean
  utente_id: string | null
}

export const AMMINISTRATORE_PROVA: AtletaProva = {
  id: '10000000-0000-0000-0000-00000000000a',
  matricola: '900001',
  nome: 'Anna',
  cognome: 'Prova',
  ruolo: 'amministratore',
  attivo: true,
  utente_id: '00000000-0000-0000-0000-00000000000a',
}
export const ATLETA_PROVA: AtletaProva = {
  id: '10000000-0000-0000-0000-00000000000b',
  matricola: '900002',
  nome: 'Bruno',
  cognome: 'Prova',
  ruolo: 'atleta',
  attivo: true,
  utente_id: '00000000-0000-0000-0000-00000000000b',
}
export const SENZA_ACCESSO_PROVA: AtletaProva = {
  id: '10000000-0000-0000-0000-00000000000c',
  matricola: '900003',
  nome: 'Carla',
  cognome: 'Esempio',
  ruolo: 'atleta',
  attivo: true,
  utente_id: null,
}

/** Due gare di prova per la sincronizzazione (dati inventati). */
export const GARE_PROVA = [
  {
    codice: 'R9900001',
    dal: '2026-10-24',
    al: '2026-10-25',
    calendario: 'Interregionale',
    localita: 'Gubbio (PG)',
    tipologia: '18 m',
    stato: 'omologata',
    aggiornato_il: '2026-11-01T10:00:00+00:00',
  },
  {
    codice: 'R9900002',
    dal: '2026-12-12',
    al: '2026-12-13',
    calendario: 'Interregionale',
    localita: 'Perugia (PG)',
    tipologia: '18 m',
    stato: 'invito',
    aggiornato_il: '2026-11-02T10:00:00+00:00',
  },
]

const base64url = (testo: string) =>
  Buffer.from(testo).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')

/** Sessione finta nel formato che supabase-js salva sul telefono. */
function sessione(utenteId: string) {
  const scadenza = Math.floor(Date.now() / 1000) + 24 * 3600
  const token = [
    base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
    base64url(JSON.stringify({ sub: utenteId, role: 'authenticated', exp: scadenza })),
    'firma-finta',
  ].join('.')
  return {
    access_token: token,
    token_type: 'bearer',
    expires_in: 24 * 3600,
    expires_at: scadenza,
    refresh_token: 'rinnovo-finto',
    user: {
      id: utenteId,
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: {},
      user_metadata: {},
    },
  }
}

const json = (route: Route, corpo: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(corpo),
  })

/**
 * Prepara Supabase finto e, se indicato, un atleta con l'accesso già fatto su questo "telefono".
 * Restituisce l'elenco degli atleti (modificabile) e le richieste ricevute dalla funzione del server.
 */
export async function simulaSupabase(
  page: Page,
  { collegato = ATLETA_PROVA as AtletaProva | null } = {},
) {
  const atleti = [AMMINISTRATORE_PROVA, ATLETA_PROVA, SENZA_ACCESSO_PROVA].map((a) => ({ ...a }))
  const richiesteFunzione: unknown[] = []

  if (collegato?.utente_id) {
    await page.addInitScript((s) => {
      localStorage.setItem('arco.sessione', JSON.stringify(s))
    }, sessione(collegato.utente_id))
  }

  await page.route(`${URL_SUPABASE_FINTO}/**`, async (route) => {
    const richiesta = route.request()
    const url = new URL(richiesta.url())
    if (richiesta.method() === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': '*',
        },
      })
    }

    // Accesso con matricola e codice.
    if (url.pathname === '/auth/v1/token') {
      const { email, password } = richiesta.postDataJSON() as { email: string; password: string }
      const matricola = /matricola-(\d+)@/.exec(email)?.[1]
      const atleta = atleti.find((a) => a.matricola === matricola && a.utente_id)
      if (!atleta || password !== CODICE_PROVA) {
        return json(
          route,
          { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' },
          400,
        )
      }
      return json(route, sessione(atleta.utente_id!))
    }
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204 })

    // Tabella atleti.
    if (url.pathname === '/rest/v1/atleti') {
      if (richiesta.method() === 'POST') {
        const nuovo = richiesta.postDataJSON() as Pick<
          AtletaProva,
          'matricola' | 'nome' | 'cognome'
        >
        if (atleti.some((a) => a.matricola === nuovo.matricola)) {
          return json(route, { code: '23505', message: 'duplicate key' }, 409)
        }
        atleti.push({
          ...nuovo,
          id: `10000000-0000-0000-0000-${nuovo.matricola.padStart(12, '0')}`,
          ruolo: 'atleta',
          attivo: true,
          utente_id: null,
        })
        return route.fulfill({ status: 201, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      const filtroUtente = url.searchParams.get('utente_id')?.replace(/^eq\./, '')
      const righe = filtroUtente ? atleti.filter((a) => a.utente_id === filtroUtente) : atleti
      const oggetto = (richiesta.headers()['accept'] ?? '').includes('vnd.pgrst.object')
      return json(route, oggetto ? (righe[0] ?? null) : righe)
    }

    // Dati condivisi della sincronizzazione (gare, inviti, classifiche…) e registro delle eliminazioni.
    const tabella = /^\/rest\/v1\/(\w+)$/.exec(url.pathname)?.[1]
    if (tabella === 'gare') return json(route, GARE_PROVA)
    if (
      ['inviti', 'partecipazioni', 'classifiche', 'ranking', 'eliminazioni'].includes(tabella ?? '')
    ) {
      return json(route, [])
    }

    // Funzione del server crea-accesso.
    if (url.pathname === '/functions/v1/crea-accesso') {
      const corpo = richiesta.postDataJSON() as { azione: string; atletaId: string }
      richiesteFunzione.push(corpo)
      const atleta = atleti.find((a) => a.id === corpo.atletaId)!
      if (corpo.azione === 'revoca') {
        atleta.utente_id = null
        return json(route, { revocato: true })
      }
      atleta.utente_id = `00000000-0000-0000-0000-${atleta.matricola.padStart(12, '0')}`
      return json(route, {
        link: `https://arcieri-eugubini.pages.dev/accesso#m=${atleta.matricola}&c=${CODICE_PROVA}`,
        codice: CODICE_PROVA,
      })
    }

    return json(route, { message: `Non simulato: ${url.pathname}` }, 404)
  })

  return { atleti, richiesteFunzione }
}
