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

/** "AAAA-MM-GG" di un giorno a `giorni` da oggi (negativo = nel passato): le gare di prova non invecchiano. */
const giornoRelativo = (giorni: number) => {
  const d = new Date()
  d.setDate(d.getDate() + giorni)
  const due = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`
}

/**
 * Tre gare di prova (due passate, una futura con invito) per sincronizzazione, tab Gare e tab Atleti
 * (dati inventati). La più vecchia, senza PDF, dà a Bruno un secondo punteggio per l'andamento.
 */
export const GARE_PROVA = [
  {
    codice: 'R9900001',
    dal: giornoRelativo(-20),
    al: giornoRelativo(-19),
    calendario: 'Interregionale',
    regione: 'Umbria',
    localita: 'Gubbio (PG)',
    tipologia: '18 m',
    dettaglio: null,
    societa_codice: '11003',
    societa_nome: 'Arcieri Eugubini',
    stato: 'omologata',
    in_calendario_umbria: true,
    ha_invito: false,
    url_risultati: 'https://www.fitarco-italia.org/upload_2026/r9900001.pdf',
    aggiornato_il: '2026-11-01T10:00:00+00:00',
  },
  {
    codice: 'R9900002',
    dal: giornoRelativo(30),
    al: giornoRelativo(31),
    calendario: 'Interregionale',
    regione: 'Umbria',
    localita: 'Perugia (PG)',
    tipologia: '18 m',
    dettaglio: 'competizione interregionale',
    societa_codice: '11018',
    societa_nome: 'ASD Arcieri Augusta Perusia',
    stato: 'invito',
    in_calendario_umbria: true,
    ha_invito: true,
    url_risultati: null,
    aggiornato_il: '2026-11-02T10:00:00+00:00',
  },
  {
    codice: 'R9900003',
    dal: giornoRelativo(-200),
    al: giornoRelativo(-200),
    calendario: 'Interregionale',
    regione: 'Umbria',
    localita: 'Terni (TR)',
    tipologia: '18 m',
    dettaglio: null,
    societa_codice: '11005',
    societa_nome: 'Arcieri Ternani',
    stato: 'omologata',
    in_calendario_umbria: true,
    ha_invito: false,
    url_risultati: null,
    aggiornato_il: '2026-11-01T10:00:00+00:00',
  },
]

/** Classifica della gara passata di prova: un atleta della compagnia e uno di un'altra società. */
export const CLASSIFICA_PROVA = [
  {
    gara_codice: 'R9900001',
    categoria: 'Arco Ricurvo - Senior Maschile',
    ordine: 1,
    divisione: 'OL',
    classe: 'Senior Maschile',
    posizione: 1,
    esito: '1',
    turno: '1-1A',
    nome_completo: 'VERDI Luca',
    cognome: 'VERDI',
    nome: 'Luca',
    classe_atleta: null,
    categoria_eta: '02',
    societa_codice: '11004',
    societa_nome: 'Arcieri di Assisi',
    parziali: [
      { colonna: '18m-1', punti: 280, posizione: 1 },
      { colonna: '18m-2', punti: 272, posizione: 1 },
    ],
    prove: [],
    totale: 552,
    conteggi: [21, 26],
    colonne_conteggi: ['10', '9'],
    atleta_id: null,
    provvisoria: false,
    aggiornato_il: '2026-11-01T10:00:00+00:00',
  },
  {
    gara_codice: 'R9900001',
    categoria: 'Arco Ricurvo - Senior Maschile',
    ordine: 2,
    divisione: 'OL',
    classe: 'Senior Maschile',
    posizione: 2,
    esito: '2',
    turno: '1-1B',
    nome_completo: 'PROVA Bruno',
    cognome: 'PROVA',
    nome: 'Bruno',
    classe_atleta: null,
    categoria_eta: '02',
    societa_codice: '11003',
    societa_nome: 'Arcieri Eugubini',
    parziali: [
      { colonna: '18m-1', punti: 263, posizione: 2 },
      { colonna: '18m-2', punti: 271, posizione: 2 },
    ],
    prove: [],
    totale: 534,
    conteggi: [17, 25],
    colonne_conteggi: ['10', '9'],
    atleta_id: '10000000-0000-0000-0000-00000000000b',
    provvisoria: false,
    aggiornato_il: '2026-11-01T10:00:00+00:00',
  },
]

/** Lo storico di Bruno: due gare passate da 18 m (534 punti, secondo; 520 punti, quarto). */
export const PARTECIPAZIONI_PROVA = [
  {
    atleta_id: '10000000-0000-0000-0000-00000000000b',
    gara_codice: 'R9900001',
    divisione: 'OL',
    classe: 'SM',
    rank: 'SM',
    posizione: 2,
    totale: 534,
    aggiornato_il: '2026-11-01T10:00:00+00:00',
  },
  {
    atleta_id: '10000000-0000-0000-0000-00000000000b',
    gara_codice: 'R9900003',
    divisione: 'OL',
    classe: 'SM',
    rank: 'SM',
    posizione: 4,
    totale: 520,
    aggiornato_il: '2026-11-01T10:00:00+00:00',
  },
]

/** Una classifica (ranking) di prova: 60 atleti, Bruno è il 2°. Indoor · Ricurvo · Senior M. */
const LETTA_PROVA = '2026-11-02T09:30:00+00:00'
export const CLASSIFICA_RANKING_PROVA = {
  tipo: 'I',
  divisione: 'OL',
  classe: 'S',
  genere: 'M',
  categoria: 'Arco Ricurvo - Seniores Maschile',
  totale: 60,
  righe: Array.from({ length: 60 }, (_, i) => {
    const posizione = i + 1
    const bruno = posizione === 2
    return {
      posizione,
      matricola: bruno ? '900002' : `91${String(posizione).padStart(4, '0')}`,
      nome: bruno ? 'Prova Bruno' : `Cognome${posizione} Nome`,
      societa_codice: bruno ? '11003' : posizione % 4 === 0 ? '11018' : '05001',
      societa_nome: bruno
        ? 'A.S.D. Compagnia Arcieri Eugubini'
        : posizione % 4 === 0
          ? 'ASD Arcieri Augusta Perusia'
          : 'Arcieri del Nord',
      punti: 1200 - posizione,
      gare: [
        {
          codice: 'R9900001',
          punti: 600 - posizione,
          localita: 'Terni (TR)',
          dal: '2026-03-14',
          al: '2026-03-15',
        },
        {
          codice: 'N9900002',
          punti: 600,
          localita: 'Roma (RM)',
          dal: '2026-02-26',
          al: '2026-03-01',
        },
      ],
    }
  }),
  letta_il: LETTA_PROVA,
  aggiornato_il: LETTA_PROVA,
}

export const INVITO_PROVA = {
  gara_codice: 'R9900002',
  testo: 'PROGRAMMA\n\nSABATO\n9,30 Accreditamento\n\nISCRIZIONI dal 3 ottobre al 2 novembre',
  luogo: 'CVA - Piazza della Torre, Perugia',
  riferimento: 'Mario Rossi 3330000000',
  email: 'societa@example.com',
  web: null,
  verificato: true,
  aggiornato_il: '2026-11-02T10:00:00+00:00',
}

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
  /** Le simulazioni di gara salvate dal telefono di prova (vuote all'inizio). */
  const simulazioni: Record<string, unknown>[] = []
  /** L'allenamento salvato dal telefono di prova (vuoto all'inizio). */
  const allenamento: {
    atleta_id: string
    giorno: string
    programma: string
    fatto: boolean
    frecce_libere: number
    nota: string
    modificato_il: string
    aggiornato_il: string
  }[] = []
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
      // Come il server: `ha_accesso` è calcolato da `utente_id`.
      const conAccesso = (a: AtletaProva) => ({ ...a, ha_accesso: a.utente_id !== null })
      return json(route, oggetto ? (righe[0] ? conAccesso(righe[0]) : null) : righe.map(conAccesso))
    }

    // Dati condivisi della sincronizzazione (gare, inviti, classifiche…) e registro delle eliminazioni.
    const tabella = /^\/rest\/v1\/(\w+)$/.exec(url.pathname)?.[1]
    if (tabella === 'gare') return json(route, GARE_PROVA)
    if (tabella === 'inviti') return json(route, [INVITO_PROVA])
    if (tabella === 'classifiche') return json(route, CLASSIFICA_PROVA)
    if (tabella === 'partecipazioni') return json(route, PARTECIPAZIONI_PROVA)
    if (tabella === 'classifiche_ranking') {
      // Solo la classifica di prova esiste; le altre "non sono ancora scaricate".
      const ricercata = ['tipo', 'divisione', 'classe', 'genere'].every(
        (c) => url.searchParams.get(c) === `eq.${CLASSIFICA_RANKING_PROVA[c as 'tipo']}`,
      )
      const solaData = url.searchParams.get('select') === 'aggiornato_il'
      const corpo = solaData
        ? { aggiornato_il: CLASSIFICA_RANKING_PROVA.aggiornato_il }
        : CLASSIFICA_RANKING_PROVA
      // maybeSingle(): il server risponde con un elenco di 0 o 1 righe.
      return json(route, ricercata ? [corpo] : [])
    }
    if (tabella === 'eliminazioni') {
      return json(route, [])
    }

    // "La tua posizione": la riga di Bruno in ogni classifica in cui compare.
    if (url.pathname === '/rest/v1/rpc/mie_classifiche') {
      const { righe, ...testata } = CLASSIFICA_RANKING_PROVA
      const mia = righe.find(
        (r) => r.matricola === (richiesta.postDataJSON() as { p_matricola: string }).p_matricola,
      )
      return json(route, mia ? [{ ...testata, riga: mia }] : [])
    }

    // Il pulsante "Aggiorna" delle classifiche: Fitarco è stato letto da poco.
    if (url.pathname === '/functions/v1/aggiorna-classifica') {
      return json(
        route,
        {
          esito: 'troppo-presto',
          errore: 'Questa classifica è stata aggiornata da poco: si può rileggere ogni 6 ore.',
          riprovaDopo: new Date(Date.now() + 5 * 3_600_000).toISOString(),
        },
        429,
      )
    }

    // Allenamento di Bruno (privato): si legge e si salva come sul server, vince la modifica più recente.
    if (tabella === 'allenamento_giorni') return json(route, allenamento)
    if (url.pathname === '/rest/v1/rpc/salva_allenamento_giorno') {
      const p = richiesta.postDataJSON() as {
        p_atleta: string
        p_giorno: string
        p_programma: string
        p_fatto: boolean
        p_frecce_libere: number
        p_nota: string
        p_modificato_il: string
      }
      const esistente = allenamento.find((r) => r.giorno === p.p_giorno)
      if (esistente && Date.parse(esistente.modificato_il) >= Date.parse(p.p_modificato_il)) {
        return json(route, esistente)
      }
      const nuova = {
        atleta_id: p.p_atleta,
        giorno: p.p_giorno,
        programma: p.p_programma,
        fatto: p.p_fatto,
        frecce_libere: p.p_frecce_libere,
        nota: p.p_nota,
        modificato_il: p.p_modificato_il,
        aggiornato_il: new Date().toISOString(),
      }
      if (esistente) Object.assign(esistente, nuova)
      else allenamento.push(nuova)
      return json(route, nuova)
    }

    // Simulazioni di gara di Bruno (private): come sul server, vince la modifica più recente.
    if (tabella === 'simulazioni') return json(route, simulazioni)
    if (url.pathname === '/rest/v1/rpc/salva_simulazione') {
      const p = richiesta.postDataJSON() as Record<string, unknown>
      const riga = {
        id: p.p_id,
        atleta_id: p.p_atleta,
        giorno: p.p_giorno,
        formato: p.p_formato,
        distanza: p.p_distanza,
        bersaglio: p.p_bersaglio,
        frecce: p.p_frecce,
        // Come il server: senza note nella richiesta restano quelle che c'erano.
        note: p.p_note ?? simulazioni.find((r) => r.id === p.p_id)?.note ?? {},
        posizioni: p.p_posizioni ?? simulazioni.find((r) => r.id === p.p_id)?.posizioni ?? [],
        compound: p.p_compound ?? simulazioni.find((r) => r.id === p.p_id)?.compound ?? false,
        conclusa: p.p_conclusa,
        eliminata: p.p_eliminata,
        creata_il: p.p_creata_il,
        modificato_il: p.p_modificato_il,
        aggiornato_il: new Date().toISOString(),
      }
      const esistente = simulazioni.find((r) => r.id === riga.id)
      if (
        esistente &&
        Date.parse(String(esistente.modificato_il)) >= Date.parse(String(riga.modificato_il))
      ) {
        return json(route, esistente)
      }
      if (esistente) Object.assign(esistente, riga)
      else simulazioni.push(riga)
      return json(route, riga)
    }

    // Funzione del server aggiorna-atleta (lettura immediata della scheda di un atleta appena aggiunto).
    if (url.pathname === '/functions/v1/aggiorna-atleta') {
      richiesteFunzione.push({ azione: 'aggiorna-atleta' })
      return json(route, { letture: [], fermato: null })
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

  return { atleti, richiesteFunzione, allenamento, simulazioni }
}
