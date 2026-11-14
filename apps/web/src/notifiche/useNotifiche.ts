import { useCallback, useEffect, useState } from 'react'
import { useServizioNotifiche } from './contesto'
import { NESSUN_AVVISO, type Avvisi, type EsitoAttiva, type StatoNotifiche } from './servizio'

export type TipoAvviso = keyof Avvisi

/**
 * Gli interruttori delle notifiche: "Nuovi inviti", "Sondaggi delle gare" e, per chi ha un allenatore, "Programma
 * dell'allenatore" (Fase 7.3); per l'amministratore "Risposte ai sondaggi" (Fase 3.5). Il telefono è registrato
 * finché almeno un avviso è acceso: spegnendo l'ultimo si toglie, accendendo il primo si registra (e riceve solo
 * quello).
 * `programmaPossibile`: falso se nessuno segue l'atleta; `rispostePossibili`: falso se non è l'amministratore (in
 * quei casi l'interruttore non c'è e non conta).
 */
export function useNotifiche(programmaPossibile = false, rispostePossibili = false) {
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

  /** Gli avvisi che contano davvero: senza allenatore il programma non c'è, le risposte solo per l'amministratore. */
  const effettivi = (a: Avvisi): Avvisi => ({
    inviti: a.inviti,
    programma: programmaPossibile && a.programma,
    sondaggi: a.sondaggi,
    risposte: rispostePossibili && a.risposte,
  })

  const cambia = useCallback(
    async (tipo: TipoAvviso = 'inviti') => {
      setOccupato(true)
      setErrore(null)
      try {
        const correnti = effettivi(servizio.avvisi())
        if (stato === 'accese') {
          const nuovi = { ...correnti, [tipo]: !correnti[tipo] }
          if (!Object.values(nuovi).some(Boolean)) await servizio.disattiva()
          else await servizio.imposta(nuovi)
        } else {
          const esito = await servizio.attiva()
          if (esito !== 'ok') setErrore(esito)
          // Acceso il telefono per un avviso: riceve solo quello.
          else await servizio.imposta({ ...NESSUN_AVVISO, [tipo]: true })
        }
      } catch {
        setErrore('errore')
      } finally {
        setStato(await leggi())
        setAvvisi(servizio.avvisi())
        setOccupato(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `effettivi` dipende solo da programmaPossibile e rispostePossibili
    [stato, servizio, leggi, programmaPossibile, rispostePossibili],
  )

  const acceso = (tipo: TipoAvviso) => stato === 'accese' && effettivi(avvisi)[tipo]

  return { stato, avvisi, acceso, occupato, errore, cambia }
}
