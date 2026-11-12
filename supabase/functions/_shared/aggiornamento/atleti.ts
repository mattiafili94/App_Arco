/**
 * Riconoscere gli atleti della compagnia nei dati Fitarco.
 * Il PDF dei risultati non ha la matricola: si confrontano cognome, nome e codice società.
 */

/** Codice Fitarco della A.S.D. Compagnia Arcieri Eugubini. */
export const CODICE_SOCIETA = '11003'

/**
 * Nelle gare tra rappresentative regionali (es. Coppa Italia delle Regioni) la "società" nel PDF è il comitato
 * regionale: per l'Umbria "11000 Umbria" (visto il 12/11/2026). Lì i nostri atleti si riconoscono per nome come
 * sempre; gli omonimi restano senza collegamento.
 */
export const CODICE_RAPPRESENTATIVA_UMBRIA = '11000'

/** I codici società sotto cui un nostro atleta può comparire in un PDF. */
export const CODICI_NOSTRI = [CODICE_SOCIETA, CODICE_RAPPRESENTATIVA_UMBRIA] as const

export interface AtletaNoto {
  id: string
  matricola: string
  nome: string
  cognome: string
}

/** "D’Àmico  Gian-Luca" → "D'AMICO GIAN-LUCA": niente accenti, maiuscole, spazi sistemati. */
export function normalizzaNome(testo: string): string {
  return testo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`´]/g, "'")
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * L'atleta della compagnia che corrisponde a una riga del PDF, oppure null.
 * Il nome nel PDF può avere un secondo nome ("Mario Luigi") che da noi manca, o viceversa.
 * Se due atleti corrispondono, non se ne sceglie nessuno (meglio nessun collegamento che uno sbagliato).
 */
export function trovaAtleta(
  riga: { cognome: string; nome: string; societa: { codice: string } },
  atleti: readonly AtletaNoto[],
): string | null {
  if (!(CODICI_NOSTRI as readonly string[]).includes(riga.societa.codice)) return null
  const cognome = normalizzaNome(riga.cognome)
  const nome = normalizzaNome(riga.nome)
  const stessoNome = (a: string, b: string) =>
    a === b || a.startsWith(b + ' ') || b.startsWith(a + ' ')
  const trovati = atleti.filter(
    (a) => normalizzaNome(a.cognome) === cognome && stessoNome(normalizzaNome(a.nome), nome),
  )
  return trovati.length === 1 ? trovati[0]!.id : null
}

/** "SM" → genere "M"; "MF" → "F". Null se la classe non finisce con M o F. */
export function genereDaClasse(classe: string | null): 'M' | 'F' | null {
  const ultima = classe?.at(-1)
  return ultima === 'M' || ultima === 'F' ? ultima : null
}
