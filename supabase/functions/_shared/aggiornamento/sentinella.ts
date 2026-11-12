/**
 * Sentinella: controlli sui dati letti prima di salvarli (CLAUDE.md, "Sentinella").
 * Se qualcosa non torna si avvisa (diario delle letture, esito "anomalia") invece di cancellare o
 * salvare dati sbagliati. I lettori fanno già i controlli di formato (ErroreFormatoFitarco).
 */

/** Il calendario non deve svuotarsi né dimezzarsi da una lettura all'altra. */
export function controllaCalendario(gareSalvate: number, gareLette: number): string | null {
  if (gareSalvate > 0 && gareLette === 0) {
    return `Il calendario letto è vuoto, prima aveva ${gareSalvate} gare: non salvo niente.`
  }
  if (gareLette < gareSalvate / 2) {
    return `Il calendario letto ha ${gareLette} gare, prima ne aveva ${gareSalvate}: controllare.`
  }
  return null
}

/** Lo storico di un atleta non deve accorciarsi (le gare passate non spariscono). */
export function controllaStorico(gareSalvate: number, gareLette: number): string | null {
  return gareLette < gareSalvate
    ? `Lo storico letto ha ${gareLette} gare, prima ne aveva ${gareSalvate}: non salvo niente.`
    : null
}

export interface AnomaliaClassifica {
  atletaId: string
  divisione: string
  motivo: 'non-trovato' | 'totale-diverso'
}

/**
 * Gli atleti che secondo il loro storico hanno fatto la gara devono comparire nel PDF, con lo stesso
 * totale. Se no, il riconoscimento per nome ha sbagliato (o Fitarco ha corretto qualcosa).
 * Il confronto è per atleta E arco (divisione): nella stessa gara un arciere può tirare in due
 * sessioni con due archi diversi, e allora ha due righe nel PDF e due nello storico.
 */
export function controllaClassifica(
  righe: readonly { atleta_id: string | null; divisione: string; totale: number }[],
  attesi: readonly {
    atletaId: string
    divisione: string
    totale: number | null
    /** Senza posizione nello storico ("fuori classifica", es. il campionato regionale di un'altra regione) il PDF può non averlo. */
    posizione?: number | null
  }[],
): AnomaliaClassifica[] {
  return attesi.flatMap((a): AnomaliaClassifica[] => {
    if (a.posizione === null) return []
    const trovate = righe.filter((r) => r.atleta_id === a.atletaId && r.divisione === a.divisione)
    const { atletaId, divisione } = a
    if (trovate.length === 0) return [{ atletaId, divisione, motivo: 'non-trovato' }]
    if (a.totale !== null && !trovate.some((r) => r.totale === a.totale)) {
      return [{ atletaId, divisione, motivo: 'totale-diverso' }]
    }
    return []
  })
}

/**
 * Una classifica (ranking) letta da Fitarco: i conti devono tornare con quello che dichiara il sito e
 * non deve svuotarsi né dimezzarsi rispetto a quella già salvata. `null` = tutto a posto.
 */
export function controllaRanking(
  righeLette: number,
  totaleDichiarato: number,
  totaleSalvato: number | null,
): string | null {
  if (righeLette !== totaleDichiarato) {
    return `Fitarco dichiara ${totaleDichiarato} atleti ma ne ho letti ${righeLette}: non salvo niente.`
  }
  if (totaleSalvato !== null && totaleSalvato > 0 && righeLette === 0) {
    return `La classifica letta è vuota, prima aveva ${totaleSalvato} atleti: non salvo niente.`
  }
  if (totaleSalvato !== null && righeLette < totaleSalvato / 2) {
    return `La classifica letta ha ${righeLette} atleti, prima ne aveva ${totaleSalvato}: non salvo niente.`
  }
  return null
}
