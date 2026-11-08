/**
 * Database finto, in memoria, per i test del motore: si comporta come quello vero (funzione del
 * server) per quello che serve al motore. Nessun dato vero.
 */
import type {
  Archivio,
  AtletaArchivio,
  Esito,
  GaraSalvata,
  Lettura,
  RigaInvito,
  RigaPartecipazione,
  StatoArchivio,
  TipoLettura,
} from '../aggiornamento'

export interface LavoroInCoda {
  tipo: TipoLettura
  chiave: string
  priorita: number
  tentativi: number
  daFareDal: number
  ultimoErrore: string | null
}

export class ArchivioFinto implements Archivio {
  gareSalvate = new Map<string, GaraSalvata>()
  inviti = new Map<string, RigaInvito>()
  atletiSalvati: (AtletaArchivio & { attivo: boolean; campi?: Record<string, unknown> })[] = []
  storici = new Map<string, RigaPartecipazione[]>()
  classifiche = new Map<
    string,
    { righe: { atleta_id: string | null }[]; impronta: string; provvisoria: boolean }
  >()
  ranking = new Map<string, unknown[]>()
  coda: LavoroInCoda[] = []
  diario: {
    tipo: TipoLettura
    chiave: string
    esito: Esito
    messaggio: string
    richieste: number
    giorno: string
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
      anniStorico: [
        ...new Set(
          [...partecipate]
            .map((c) => Number(this.gareSalvate.get(c)?.dal.slice(0, 4)))
            .filter(Boolean),
        ),
      ],
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
    this.diario.push({ ...r, giorno: this.oggi })
  }

  async gare(codici: string[]) {
    return codici.flatMap((c) => (this.gareSalvate.has(c) ? [this.gareSalvate.get(c)!] : []))
  }

  async gareDiAnno(anno: number) {
    return [...this.gareSalvate.values()].filter((g) => g.dal.startsWith(String(anno)))
  }

  async salvaGare(righe: (Partial<GaraSalvata> & { codice: string })[]) {
    for (const r of righe) {
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

  async invito(codice: string) {
    return this.inviti.get(codice) ?? null
  }

  async salvaInvito(riga: RigaInvito) {
    this.inviti.set(riga.gara_codice, riga)
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
        .map((r) => ({ atletaId, totale: r.totale })),
    )
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

  async salvaRanking(tipo: string, divisione: string, atleti: string[], righe: unknown[]) {
    this.ranking.set(`${tipo}|${divisione}|${atleti.join(',')}`, righe)
  }
}
