import { useCallback, useEffect, useState } from 'react'
import { useServizioNotifiche } from './contesto'
import type { Avvisi, EsitoAttiva, StatoNotifiche } from './servizio'

export type TipoAvviso = keyof Avvisi

/**
 * Gli interruttori delle notifiche: "Nuovi inviti" e, per chi ha un allenatore, "Programma dell'allenatore"
 * (Fase 7.3). Il telefono è registrato finché almeno un avviso è acceso: spegnendo l'ultimo si toglie, accendendo
 * il primo si registra (e riceve solo quello).
 * `programmaPossibile`: falso se nessuno segue l'atleta (l'interruttore del programma non c'è e non conta).
 */
export function useNotifiche(programmaPossibile = false) {
  const servizio = useServizioNotifiche()
  const [stato, setStato] = useState<StatoNotifiche>('caricamento')
  const [avvisi, setAvvisi] = useState<Avvisi>(() => servizio.avvisi())
  const [occupato, setOccupato] = useState(false)
  const [errore, setErrore] = useState<EsitoAttiva | null>(null)

  const leggi = useCallback(
    () => servizio.stato().catch(() => 'spente' as StatoNotifiche),
    [servizio],
  )

  useEffect(() => {
    let attivo = true
    void leggi().then((s) => {
      if (attivo) setStato(s)
    })
    return () => {
      attivo = false
    }
  }, [leggi])

  /** Gli avvisi che contano davvero: senza allenatore il programma non c'è. */
  const effettivi = (a: Avvisi): Avvisi => ({
    inviti: a.inviti,
    programma: programmaPossibile && a.programma,
  })

  const cambia = useCallback(
    async (tipo: TipoAvviso = 'inviti') => {
      setOccupato(true)
      setErrore(null)
      try {
        const correnti = effettivi(servizio.avvisi())
        if (stato === 'accese') {
          const nuovi = { ...correnti, [tipo]: !correnti[tipo] }
          if (!nuovi.inviti && !nuovi.programma) await servizio.disattiva()
          else await servizio.imposta(nuovi)
        } else {
          const esito = await servizio.attiva()
          if (esito !== 'ok') setErrore(esito)
          // Acceso il telefono per un avviso: riceve solo quello.
          else await servizio.imposta({ inviti: false, programma: false, [tipo]: true })
        }
      } catch {
        setErrore('errore')
      } finally {
        setStato(await leggi())
        setAvvisi(servizio.avvisi())
        setOccupato(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `effettivi` dipende solo da programmaPossibile
    [stato, servizio, leggi, programmaPossibile],
  )

  const acceso = (tipo: TipoAvviso) => stato === 'accese' && effettivi(avvisi)[tipo]

  return { stato, avvisi, acceso, occupato, errore, cambia }
}
