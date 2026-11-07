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
  motivo: 'non-trovato' | 'totale-diverso'
}

/**
 * Gli atleti che secondo il loro storico hanno fatto la gara devono comparire nel PDF, con lo stesso
 * totale. Se no, il riconoscimento per nome ha sbagliato (o Fitarco ha corretto qualcosa).
 */
export function controllaClassifica(
  righe: readonly { atleta_id: string | null; totale: number }[],
  attesi: readonly { atletaId: string; totale: number | null }[],
): AnomaliaClassifica[] {
  return attesi.flatMap((a): AnomaliaClassifica[] => {
    const trovate = righe.filter((r) => r.atleta_id === a.atletaId)
    if (trovate.length === 0) return [{ atletaId: a.atletaId, motivo: 'non-trovato' }]
    if (a.totale !== null && !trovate.some((r) => r.totale === a.totale)) {
      return [{ atletaId: a.atletaId, motivo: 'totale-diverso' }]
    }
    return []
  })
}
