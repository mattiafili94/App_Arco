/**
 * Il confronto tra le medie (Fase 6.3b): la media per freccia di una simulazione, delle altre simulazioni dello
 * stesso tipo e delle gare vere. Funzioni pure.
 *
 * Si confronta **prova per prova** (un 25+18 dà una riga per i 25 m e una per i 18 m; il doppio 70 m una sola,
 * perché le due prove sono uguali), sempre con la **media per freccia** (punti diviso frecce): così contano allo
 * stesso modo gare da 60, 72 o 144 frecce.
 * - **Altre simulazioni**: stesso formato, distanza, bersaglio e (indoor) compound; solo prove tirate fino in
 *   fondo, senza quella in corso e senza le cancellate.
 * - **Gare**: le ultime `GARE_NEL_CONFRONTO` prove dello stesso tipo, con **un solo arco**: il compound se la
 *   simulazione è compound, altrimenti l'arco dell'ultima gara. Il numero di frecce è quello del formato della
 *   simulazione (60 indoor, 72 outdoor, campagna 12+12 e 3D, 144 il 24+24).
 */
import { nomeProva, type ProvaGara } from './atleti'
import {
  eIndoor,
  proveDelFormato,
  riepilogoSimulazione,
  type FormatoSimulazione,
  type Prova,
  type Simulazione,
} from './segnapunti'

/** Quante gare (le più recenti) entrano nella media delle gare. */
export const GARE_NEL_CONFRONTO = 5

/** La chiave di una prova, uguale a `ProvaGara.chiave`: "indoor:18m", "outdoor:70m", "campagna:12+12", "3d:3d". */
export function chiaveProva(formato: FormatoSimulazione, prova: Pick<Prova, 'distanza'>): string {
  if (formato === '3d') return '3d:3d'
  if (formato === '12+12' || formato === '24+24') return `campagna:${formato}`
  return `${eIndoor(formato) ? 'indoor' : 'outdoor'}:${prova.distanza}m`
}

/** Una media per freccia e da quante simulazioni o gare viene. */
export interface MediaConfronto {
  /** Punti per freccia, con due decimali. */
  media: number
  quanti: number
}

export interface ConfrontoProva {
  /** "25 m", "18 m", "12+12", "3D". */
  nome: string
  /** Questa simulazione (se ha almeno una freccia in questa prova). */
  questa: number | null
  /** Le altre simulazioni dello stesso tipo. */
  allenamento: MediaConfronto | null
  /** Le gare: la divisione ("OL", "CO"…) è l'arco usato per il confronto. */
  gare: (MediaConfronto & { divisione: string }) | null
}

const due = (n: number) => Math.round(n * 100) / 100

type DatiSimulazione = Pick<
  Simulazione,
  'formato' | 'distanza' | 'bersaglio' | 'frecce' | 'compound' | 'id' | 'eliminata'
>

/** Punti e frecce che una simulazione ha in una prova (`completa`: tutte le frecce della prova segnate). */
function sulla(
  s: DatiSimulazione,
  chiave: string,
): { punti: number; frecce: number; completa: boolean } {
  const r = riepilogoSimulazione(s)
  const giuste = r.prove.filter((p) => chiaveProva(s.formato, p.prova) === chiave)
  return {
    punti: giuste.reduce((t, p) => t + p.totale, 0),
    frecce: giuste.reduce((t, p) => t + p.frecceSegnate, 0),
    completa: giuste.length > 0 && giuste.every((p) => p.frecceSegnate === p.prova.frecceTotali),
  }
}

const stessoTipo = (a: DatiSimulazione, b: DatiSimulazione) =>
  a.formato === b.formato &&
  a.distanza === b.distanza &&
  a.bersaglio === b.bersaglio &&
  (a.compound ?? false) === (b.compound ?? false)

/** Le gare dello stesso arco: il compound per un compound, altrimenti l'arco della gara più recente. */
function gareDelConfronto(
  proveGara: readonly ProvaGara[],
  compound: boolean,
): { divisione: string; prove: ProvaGara[]; gare: number } | null {
  const candidate = compound ? proveGara.filter((p) => p.divisione === 'CO') : [...proveGara]
  if (candidate.length === 0) return null
  const piuRecente = (a: ProvaGara, b: ProvaGara) =>
    b.data.localeCompare(a.data) || b.gara_codice.localeCompare(a.gara_codice)
  const divisione = [...candidate].sort(piuRecente)[0]!.divisione
  const dellArco = candidate.filter((p) => p.divisione === divisione).sort(piuRecente)
  const codici: string[] = []
  for (const p of dellArco) if (!codici.includes(p.gara_codice)) codici.push(p.gara_codice)
  const scelti = new Set(codici.slice(0, GARE_NEL_CONFRONTO))
  return {
    divisione,
    prove: dellArco.filter((p) => scelti.has(p.gara_codice)),
    gare: scelti.size,
  }
}

/**
 * Il confronto di una simulazione: una riga per prova. `altre` può contenere anche questa simulazione e quelle
 * cancellate (si saltano); `proveGara` sono le prove dell'atleta (`proveDiAtleta`).
 */
export function confrontoMedie(
  s: Simulazione,
  altre: readonly Simulazione[],
  proveGara: readonly ProvaGara[],
): ConfrontoProva[] {
  const prove = proveDelFormato(s.formato, s.distanza)
  const chiavi = [...new Set(prove.map((p) => chiaveProva(s.formato, p)))]

  return chiavi.map((chiave) => {
    const prova = prove.find((p) => chiaveProva(s.formato, p) === chiave)!
    const [famiglia = '', nome = ''] = chiave.split(':')
    const questa = sulla(s, chiave)

    const simili = altre
      .filter((o) => o.id !== s.id && !o.eliminata && stessoTipo(o, s))
      .map((o) => sulla(o, chiave))
      .filter((o) => o.completa)
    const frecceAllenamento = simili.reduce((t, o) => t + o.frecce, 0)

    const delleGare = gareDelConfronto(
      proveGara.filter((p) => p.chiave === chiave),
      s.compound ?? false,
    )

    return {
      nome: nomeProva({ famiglia: famiglia as ProvaGara['famiglia'], prova: nome }),
      questa: questa.frecce > 0 ? due(questa.punti / questa.frecce) : null,
      allenamento:
        simili.length > 0
          ? {
              media: due(simili.reduce((t, o) => t + o.punti, 0) / frecceAllenamento),
              quanti: simili.length,
            }
          : null,
      gare: delleGare
        ? {
            divisione: delleGare.divisione,
            media: due(
              delleGare.prove.reduce((t, p) => t + p.totale, 0) /
                (delleGare.prove.length * prova.frecceTotali),
            ),
            quanti: delleGare.gare,
          }
        : null,
    }
  })
}
