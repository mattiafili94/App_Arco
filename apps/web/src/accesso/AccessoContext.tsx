import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CHIAVE_PROFILO, Contesto, type Stato, type ValoreAccesso } from './contesto'
import type { Atleta, ServizioAccesso } from './servizio'

const leggiProfilo = (utenteId: string): Atleta | null => {
  try {
    const salvato = JSON.parse(localStorage.getItem(CHIAVE_PROFILO) ?? 'null') as
      (Atleta & { utenteId: string }) | null
    return salvato?.utenteId === utenteId ? salvato : null
  } catch {
    return null
  }
}

const salvaProfilo = (utenteId: string, atleta: Atleta | null) => {
  try {
    if (atleta) localStorage.setItem(CHIAVE_PROFILO, JSON.stringify({ ...atleta, utenteId }))
    else localStorage.removeItem(CHIAVE_PROFILO)
  } catch {
    // memoria non disponibile: l'app funzionerà solo con la rete
  }
}

const AVVISO_NON_VALIDO =
  "Il tuo accesso non è più valido. Chiedi un nuovo link all'amministratore."

export function AccessoProvider({
  servizio,
  children,
}: {
  servizio: ServizioAccesso
  children: ReactNode
}) {
  const [stato, setStato] = useState<Stato>({ tipo: 'caricamento' })

  // All'avvio: accesso già fatto? Si apre subito con la copia salvata, poi si aggiorna dalla rete.
  useEffect(() => {
    let attivo = true
    void (async () => {
      const sessione = await servizio.sessioneSalvata()
      if (!attivo) return
      if (!sessione) return setStato({ tipo: 'ospite' })
      const salvato = leggiProfilo(sessione.utenteId)
      if (salvato) setStato({ tipo: 'membro', atleta: salvato })
      try {
        const aggiornato = await servizio.profilo(sessione.utenteId)
        if (!attivo) return
        if (aggiornato) {
          salvaProfilo(sessione.utenteId, aggiornato)
          setStato({ tipo: 'membro', atleta: aggiornato })
        } else {
          salvaProfilo(sessione.utenteId, null)
          await servizio.esci()
          setStato({ tipo: 'ospite', avviso: AVVISO_NON_VALIDO })
        }
      } catch {
        // Senza rete: si resta con la copia salvata; senza copia serve la rete.
        if (attivo && !salvato) setStato({ tipo: 'ospite' })
      }
    })()
    return () => {
      attivo = false
    }
  }, [servizio])

  // Accesso terminato da solo (es. revocato): si torna alla pagina Accedi.
  useEffect(
    () =>
      servizio.quandoEsce(() => {
        setStato((s) => (s.tipo === 'membro' ? { tipo: 'ospite', avviso: AVVISO_NON_VALIDO } : s))
      }),
    [servizio],
  )

  const accedi = useCallback<ValoreAccesso['accedi']>(
    async (matricola, codice, opzioni) => {
      const esito = await servizio.accedi(matricola, codice)
      if (esito.esito !== 'ok') return esito
      try {
        const atleta = await servizio.profilo(esito.utenteId)
        if (!atleta) {
          await servizio.esci()
          return { esito: 'non-membro' }
        }
        salvaProfilo(esito.utenteId, atleta)
        setStato({ tipo: 'membro', atleta, codiceDaLink: opzioni?.daLink ? codice : undefined })
        return esito
      } catch {
        await servizio.esci()
        return { esito: 'errore' }
      }
    },
    [servizio],
  )

  const esci = useCallback(async () => {
    try {
      localStorage.removeItem(CHIAVE_PROFILO)
    } catch {
      // niente da togliere
    }
    await servizio.esci()
    setStato({ tipo: 'ospite' })
  }, [servizio])

  const valore = useMemo(() => ({ stato, servizio, accedi, esci }), [stato, servizio, accedi, esci])
  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>
}
