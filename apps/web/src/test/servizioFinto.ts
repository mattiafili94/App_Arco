import { vi } from 'vitest'
import type { Atleta, ServizioAccesso } from '../accesso/servizio'

/** Atleti inventati per i test (nessun dato vero). */
export const AMMINISTRATORE: Atleta = {
  id: 'id-anna',
  matricola: '900001',
  nome: 'Anna',
  cognome: 'Prova',
  ruolo: 'amministratore',
  attivo: true,
  haAccesso: true,
}
export const ATLETA: Atleta = {
  id: 'id-bruno',
  matricola: '900002',
  nome: 'Bruno',
  cognome: 'Prova',
  ruolo: 'atleta',
  attivo: true,
  haAccesso: true,
}
export const SENZA_ACCESSO: Atleta = {
  id: 'id-carla',
  matricola: '900003',
  nome: 'Carla',
  cognome: 'Esempio',
  ruolo: 'atleta',
  attivo: true,
  haAccesso: false,
}

export const CODICE_GIUSTO = 'K7PM3XQR9A'

/**
 * Servizio finto: si comporta come Supabase con questi atleti. `collegato` è l'atleta con
 * l'accesso già fatto su questo "telefono" (null = nessuno).
 */
export function servizioFinto({
  collegato = ATLETA as Atleta | null,
  atleti = [AMMINISTRATORE, ATLETA, SENZA_ACCESSO],
  rete = true,
} = {}) {
  let utente: string | null = collegato?.id ?? null
  // Copie: un test non deve modificare gli atleti usati dagli altri.
  const elenco = atleti.map((a) => ({ ...a }))
  let avvisaUscita: (() => void) | null = null

  const servizio = {
    sessioneSalvata: vi.fn(async () => (utente ? { utenteId: utente } : null)),
    accedi: vi.fn(async (matricola: string, codice: string) => {
      if (!rete) return { esito: 'offline' as const }
      const atleta = elenco.find((a) => a.matricola === matricola)
      if (!atleta || codice !== CODICE_GIUSTO) return { esito: 'errato' as const }
      utente = atleta.id
      return { esito: 'ok' as const, utenteId: atleta.id }
    }),
    esci: vi.fn(async () => {
      utente = null
    }),
    profilo: vi.fn(async (utenteId: string) => {
      if (!rete) throw new Error('offline')
      return elenco.find((a) => a.id === utenteId && a.attivo) ?? null
    }),
    quandoEsce: vi.fn((avvisa: () => void) => {
      avvisaUscita = avvisa
      return () => {
        avvisaUscita = null
      }
    }),
    elencoAtleti: vi.fn(async () => {
      if (!rete) throw new Error('offline')
      return [...elenco].sort((a, b) => a.cognome.localeCompare(b.cognome))
    }),
    aggiungiAtleta: vi.fn(async (dati: { matricola: string; nome: string; cognome: string }) => {
      if (elenco.some((a) => a.matricola === dati.matricola)) return { esito: 'duplicato' as const }
      elenco.push({
        ...dati,
        id: `id-${dati.matricola}`,
        ruolo: 'atleta',
        attivo: true,
        haAccesso: false,
      })
      return { esito: 'ok' as const }
    }),
    generaLink: vi.fn(async (atletaId: string) => {
      const a = elenco.find((x) => x.id === atletaId)!
      a.haAccesso = true
      return {
        link: `https://arcieri-eugubini.pages.dev/accesso#m=${a.matricola}&c=${CODICE_GIUSTO}`,
        codice: CODICE_GIUSTO,
      }
    }),
    revocaAccesso: vi.fn(async (atletaId: string) => {
      elenco.find((x) => x.id === atletaId)!.haAccesso = false
    }),
  } satisfies ServizioAccesso

  return {
    servizio,
    /** Simula un accesso terminato dal server (es. revocato dall'amministratore). */
    simulaUscita: () => avvisaUscita?.(),
    impostaRete: (valore: boolean) => {
      rete = valore
    },
  }
}
