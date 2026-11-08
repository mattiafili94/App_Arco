/**
 * Un PDF minimo costruito nei test (nessun dato vero): una pagina con pezzi di testo nelle posizioni date.
 * Riproduce il caso dei PDF Fitarco: pezzi della stessa riga ad altezze leggermente diverse.
 */
export function pdfDiProva(pezzi: { testo: string; x: number; y: number }[]): Uint8Array {
  // Nel PDF le parentesi e la barra rovesciata si scrivono con "\" davanti.
  const testoPdf = (t: string) => t.replace(/[\\()]/g, (c) => `\\${c}`)
  const flusso = pezzi
    .map((p) => `BT /F1 10 Tf ${p.x} ${p.y} Td (${testoPdf(p.testo)}) Tj ET`)
    .join('\n')
  const oggetti = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${flusso.length} >>\nstream\n${flusso}\nendstream`,
  ]
  let testo = '%PDF-1.4\n'
  const posizioni: number[] = []
  oggetti.forEach((o, i) => {
    posizioni.push(testo.length)
    testo += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = testo.length
  testo += `xref\n0 ${oggetti.length + 1}\n0000000000 65535 f \n`
  testo += posizioni.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')
  testo += `trailer\n<< /Size ${oggetti.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  // Un byte per carattere (WinAnsi: "à" = 0xE0), niente UTF-8 dentro il PDF.
  return Uint8Array.from(testo, (c) => c.charCodeAt(0))
}

/** Un PDF con una riga di testo per elemento, dall'alto in basso (12 punti tra una riga e l'altra). */
export function pdfConRighe(righe: string[]): Uint8Array {
  return pdfDiProva(righe.map((testo, i) => ({ testo, x: 40, y: 800 - i * 12 })))
}
