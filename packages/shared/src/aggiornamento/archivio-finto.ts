/**
 * Database finto, in memoria, per i test del motore: si comporta come quello vero (funzione del
 * server) per quello che serve al motore. Nessun dato vero.
 */
import type {
  Archivio,
  FiltroClassifica,
  AtletaArchivio,
  Esito,
  GaraSalvata,
  Lettura,
  RigaGara,
  NotificaInvito,
  RigaInvito,
  RigaPartecipazione,
  StatoArchivio,
  TipoLettura,
} from '../aggiornamento'
import { chiaveClassifica, PREFISSO_BLOCCO } from '../aggiornamento'

export interface LavoroInCoda {
  tipo: TipoLettura
  chiave: string
  priorita: number
  tentativi: number
  daFareDal: number
  ultimoErrore: string | null
}
/** Le righe di classifica salvate hanno le colonne prodotte da `righeClassifica`. */
/** Le righe di classifica salvate hanno le colonne di . */
interface RigaSalvata {
  atleta_id: string | null
  categoria: string
  ordine: number
  cognome: string
  nome: string
  societa_codice: string
}
const riga = (r: { atleta_id: string | null }) => r as RigaSalvata

export class ArchivioFinto implements Archivio {
  gareSalvate = new Map<string, GaraSalvata>()
  inviti = new Map<string, RigaInvito>()
  notifiche: NotificaInvito[] = []
  atletiSalvati: (AtletaArchivio & { attivo: boolean; campi?: Record<string, unknown> })[] = []
  storici = new Map<string, RigaPartecipazione[]>()
  classifiche = new Map<
    string,
    { righe: { atleta_id: string | null }[]; impronta: string; provvisoria: boolean }
  >()
  /** Le classifiche (ranking) complete salvate, per chiave "tipo|divisione|classe|genere". */
  classificheComplete = new Map<
    string,
    FiltroClassifica & { categoria: string; totale: number; righe: unknown[]; letta_il: string }
  >()
  coda: LavoroInCoda[] = []
  diario: {
    tipo: TipoLettura
    chiave: string
    esito: Esito
    messaggio: string
    richieste: number
    giorno: string
    /** Istante della lettura (per la pausa dopo un blocco). */
    istante?: number
  }[] = []
  /** Giorno "di oggi" usato per le ultime letture del diario. */
  oggi = '2027-03-01'
  /** Istante di adesso (per `prossime`). */
  adesso = Date.parse('2027-03-01T10:00:00Z')

  async stato(): Promise<StatoArchivio> {
    const ultime = new Map<string, { tipo: string; chiave: string; letto_il: string }>()
    for (const l of this.diario) {
      if (l.esito !== 'errore')
        ultime.set(`${l.tipo}|${l.chiave}`, { tipo: l.tipo, chiave: l.chiave, letto_il: l.giorno })
    }
    const partecipate = new Set([...this.storici.values()].flat().map((r) => r.gara_codice))
    return {
      ultimeLetture: [...ultime.values()],
      gare: [...this.gareSalvate.values()].map((g) => ({
        codice: g.codice,
        dal: g.dal,
        al: g.al,
        stato: g.stato,
        in_calendario_umbria: g.in_calendario_umbria,
        ha_invito: g.ha_invito,
        url_risultati: g.url_risultati,
        con_partecipanti: partecipate.has(g.codice),
        classifica_provvisoria: this.classifiche.get(g.codice)?.provvisoria ?? null,
      })),
      atleti: this.atletiSalvati.filter((a) => a.attivo).map((a) => ({ id: a.id })),
    }
  }

  async accoda(letture: Lettura[]) {
    for (const l of letture) {
      if (!this.coda.some((c) => c.tipo === l.tipo && c.chiave === l.chiave)) {
        this.coda.push({ ...l, tentativi: 0, daFareDal: 0, ultimoErrore: null })
      }
    }
  }

  async prossime(quante: number) {
    return this.coda
      .filter((c) => c.daFareDal <= this.adesso)
      .sort((a, b) => b.priorita - a.priorita)
      .slice(0, quante)
      .map(({ tipo, chiave, tentativi }) => ({ tipo, chiave, tentativi }))
  }

  async completa(tipo: TipoLettura, chiave: string) {
    this.coda = this.coda.filter((c) => !(c.tipo === tipo && c.chiave === chiave))
  }

  async rimanda(
    tipo: TipoLettura,
    chiave: string,
    tentativi: number,
    errore: string,
    quando: Date,
  ) {
    const c = this.coda.find((x) => x.tipo === tipo && x.chiave === chiave)!
    Object.assign(c, { tentativi, ultimoErrore: errore, daFareDal: quando.getTime() })
  }

  async registra(r: {
    tipo: TipoLettura
    chiave: string
    esito: Esito
    messaggio: string
    richieste: number
  }) {
    // Come il database vero: solo le colonne della tabella `letture` (altre colonne = errore).
    const colonne = Object.keys(r).sort().join(',')
    if (colonne !== 'chiave,esito,messaggio,richieste,tipo') {
      throw new Error(`Database (diario): colonne sconosciute in ${colonne}`)
    }
    this.diario.push({ ...r, giorno: this.oggi, istante: this.adesso })
  }

  async ultimoBlocco() {
    const blocchi = this.diario.filter(
      (d) => d.esito === 'errore' && d.messaggio.startsWith(PREFISSO_BLOCCO),
    )
    return blocchi.length > 0 ? (blocchi.at(-1)!.istante ?? 0) : null
  }

  async gare(codici: string[]) {
    return codici.flatMap((c) => (this.gareSalvate.has(c) ? [this.gareSalvate.get(c)!] : []))
  }

  async gareDiAnno(anno: number) {
    return [...this.gareSalvate.values()].filter((g) => g.dal.startsWith(String(anno)))
  }

  async salvaGare(righe: RigaGara[]) {
    for (const r of righe) {
      // Come il database vero ("inserisci o aggiorna"): servono sempre i campi obbligatori.
      for (const campo of ['dal', 'al', 'calendario', 'localita', 'tipologia', 'stato'] as const) {
        if (r[campo] == null) throw new Error(`Database (salva gare): manca "${campo}"`)
      }
      if (!/^[A-Z][0-9]{7}$/.test(r.codice))
        throw new Error(`Database (salva gare): codice ${r.codice}`)
      const prima = this.gareSalvate.get(r.codice)
      this.gareSalvate.set(r.codice, {
        ha_invito: false,
        url_risultati: null,
        impronta_risultati: null,
        ...prima,
        ...r,
      } as GaraSalvata)
    }
  }

  async aggiornaGara(codice: string, campi: Partial<GaraSalvata>) {
    const g = this.gareSalvate.get(codice)
    if (g) Object.assign(g, campi)
  }

  async invito(codice: string) {
    return this.inviti.get(codice) ?? null
  }

  async salvaInvito(riga: RigaInvito) {
    this.inviti.set(riga.gara_codice, riga)
  }

  async accodaNotifica(n: NotificaInvito) {
    // Come il database vero: una sola notifica per gara.
    if (!this.notifiche.some((x) => x.gara_codice === n.gara_codice)) this.notifiche.push(n)
  }

  async atleti() {
    return this.atletiSalvati.filter((a) => a.attivo)
  }

  async aggiornaAtleta(id: string, campi: Record<string, unknown>) {
    const a = this.atletiSalvati.find((x) => x.id === id)!
    a.campi = campi
    if (campi.classi_ranking) a.classi_ranking = campi.classi_ranking as Record<string, string>
  }

  async storico(atletaId: string) {
    return this.storici.get(atletaId) ?? []
  }

  async storicoConTipologia() {
    return [...this.storici.entries()].flatMap(([atleta_id, righe]) =>
      righe.map((r) => ({
        atleta_id,
        tipologia: this.gareSalvate.get(r.gara_codice)?.tipologia ?? '',
        divisione: r.divisione,
        dal: this.gareSalvate.get(r.gara_codice)?.dal ?? '',
      })),
    )
  }

  async salvaStorico(atletaId: string, righe: RigaPartecipazione[]) {
    this.storici.set(atletaId, righe)
  }

  async partecipanti(codiceGara: string) {
    return [...this.storici.entries()].flatMap(([atletaId, righe]) =>
      righe
        .filter((r) => r.gara_codice === codiceGara)
        .map((r) => ({ atletaId, divisione: r.divisione, totale: r.totale })),
    )
  }

  async potaClassifiche(primaDel: string) {
    let tolte = 0
    for (const [codice, c] of this.classifiche) {
      if ((this.gareSalvate.get(codice)?.dal ?? '') >= primaDel) continue
      // Restano le righe collegate e quelle della società 11003 (Eugubini non ancora nell'app).
      const eugubini = c.righe.filter(
        (r) => r.atleta_id !== null || riga(r).societa_codice === '11003',
      )
      tolte += c.righe.length - eugubini.length
      c.righe = eugubini
    }
    return tolte
  }

  async righeNonCollegate(codiciGare: string[]) {
    return codiciGare.flatMap((codice) =>
      (this.classifiche.get(codice)?.righe ?? [])
        .map(riga)
        .filter((r) => r.atleta_id === null && r.societa_codice === '11003')
        .map(({ categoria, ordine, cognome, nome }) => ({
          gara_codice: codice,
          categoria,
          ordine,
          cognome,
          nome,
        })),
    )
  }

  async collegaRighe(
    righe: { gara_codice: string; categoria: string; ordine: number; atleta_id: string }[],
  ) {
    for (const r of righe) {
      const trovata = (this.classifiche.get(r.gara_codice)?.righe ?? [])
        .map(riga)
        .find((x) => x.categoria === r.categoria && x.ordine === r.ordine)
      if (trovata) trovata.atleta_id = r.atleta_id
    }
  }

  async potaGare(primaDel: string) {
    const partecipate = new Set([...this.storici.values()].flat().map((r) => r.gara_codice))
    let tolte = 0
    for (const [codice, g] of this.gareSalvate) {
      if (g.dal < primaDel && !partecipate.has(codice)) {
        this.gareSalvate.delete(codice)
        this.classifiche.delete(codice)
        this.inviti.delete(codice)
        tolte++
      }
    }
    return tolte
  }

  async classificaProvvisoria(codiceGara: string) {
    return this.classifiche.get(codiceGara)?.provvisoria ?? null
  }

  async salvaClassifica(codice: string, righe: unknown[], impronta: string, provvisoria: boolean) {
    this.classifiche.set(codice, {
      righe: righe as { atleta_id: string | null }[],
      impronta,
      provvisoria,
    })
    this.gareSalvate.get(codice)!.impronta_risultati = impronta
  }

  async classificheRanking() {
    return [...this.classificheComplete.values()].map((c) => ({
      tipo: c.tipo,
      divisione: c.divisione,
      classe: c.classe,
      genere: c.genere,
      letta_il: c.letta_il,
      totale: c.totale,
    }))
  }

  async salvaClassificaRanking(
    filtro: FiltroClassifica,
    dati: { categoria: string; totale: number; righe: unknown[] },
  ) {
    this.classificheComplete.set(chiaveClassifica(filtro), {
      ...filtro,
      ...dati,
      letta_il: new Date(this.adesso).toISOString(),
    })
  }

  async lettureClassificheDa(da: Date) {
    return this.diario.filter(
      (d) => d.tipo === 'ranking' && d.richieste > 0 && (d.istante ?? 0) >= da.getTime(),
    ).length
  }
}
