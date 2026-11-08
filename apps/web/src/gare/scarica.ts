/** Fa scaricare al telefono un file di testo (es. il .ics della gara, che si apre con il calendario). */
export function scaricaTesto(nomeFile: string, contenuto: string, tipo: string) {
  const indirizzo = URL.createObjectURL(new Blob([contenuto], { type: tipo }))
  const collegamento = document.createElement('a')
  collegamento.href = indirizzo
  collegamento.download = nomeFile
  document.body.append(collegamento)
  collegamento.click()
  collegamento.remove()
  // Il file ha già iniziato a scaricarsi: l'indirizzo temporaneo non serve più.
  setTimeout(() => URL.revokeObjectURL(indirizzo), 10_000)
}
