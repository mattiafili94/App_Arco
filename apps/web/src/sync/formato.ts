const due = (n: number) => String(n).padStart(2, '0')

/** "Oggi alle 10:32", "Ieri alle 18:05", "8/11 alle 07:00" oppure "Mai". */
export function descriviUltima(ultima: number | null, adesso: number = Date.now()): string {
  if (ultima === null) return 'Mai'
  const quando = new Date(ultima)
  const ora = `${due(quando.getHours())}:${due(quando.getMinutes())}`
  const inizioGiorno = (t: Date) => new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()
  const giorni = Math.round((inizioGiorno(new Date(adesso)) - inizioGiorno(quando)) / 86_400_000)
  if (giorni === 0) return `Oggi alle ${ora}`
  if (giorni === 1) return `Ieri alle ${ora}`
  return `${quando.getDate()}/${quando.getMonth() + 1} alle ${ora}`
}
