// Date in italiano, usate sia dall'app (tramite packages/shared) sia dalle funzioni del server.

export const MESI = [
  'gen',
  'feb',
  'mar',
  'apr',
  'mag',
  'giu',
  'lug',
  'ago',
  'set',
  'ott',
  'nov',
  'dic',
]

export const analizza = (data: string) => {
  const [anno, mese, giorno] = data.split('-').map(Number) as [number, number, number]
  return { anno, mese, giorno }
}

/**
 * "24–25 ott 2026", "24 ott 2026", "30 ott – 1 nov 2026". Con `annoCorrente` l'anno si omette per le
 * gare di quell'anno (nell'elenco: "24–25 ott").
 */
export function formattaDate(dal: string, al: string, annoCorrente?: number): string {
  const a = analizza(dal)
  const b = analizza(al)
  const anno = (n: number) => (n === annoCorrente ? '' : ` ${n}`)
  if (dal === al) return `${a.giorno} ${MESI[a.mese - 1]}${anno(a.anno)}`
  if (a.anno === b.anno && a.mese === b.mese) {
    return `${a.giorno}–${b.giorno} ${MESI[a.mese - 1]}${anno(a.anno)}`
  }
  if (a.anno === b.anno) {
    return `${a.giorno} ${MESI[a.mese - 1]} – ${b.giorno} ${MESI[b.mese - 1]}${anno(a.anno)}`
  }
  return `${a.giorno} ${MESI[a.mese - 1]}${anno(a.anno)} – ${b.giorno} ${MESI[b.mese - 1]}${anno(b.anno)}`
}
