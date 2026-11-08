// Il database vero per il motore dell'aggiornamento (interfaccia `Archivio` in
// _shared/aggiornamento/motore.ts). Usa la chiave di servizio: scrive dove l'app non può.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3'
import { PREFISSO_BLOCCO } from '../_shared/aggiornamento/index.ts'
import type {
  Archivio,
  AtletaArchivio,
  GaraSalvata,
  RigaInvito,
  RigaPartecipazione,
  StatoArchivio,
} from '../_shared/aggiornamento/index.ts'

/** Ferma tutto se il database risponde con un errore. */
function controlla<T>(r: { data: T; error: { message: string } | null }, cosa: string): T {
  if (r.error) throw new Error(`Database (${cosa}): ${r.error.message}`)
  return r.data
}

const COLONNE_GARA =
  'codice, dal, al, calendario, regione, localita, tipologia, dettaglio, societa_codice, societa_nome, stato, in_calendario_umbria, ha_invito, url_risultati, impronta_risultati'

export function archivioSupabase(db: SupabaseClient): Archivio {
  return {
    async stato() {
      return controlla(await db.rpc('stato_aggiornamento'), 'stato') as StatoArchivio
    },

    async accoda(letture) {
      if (letture.length === 0) return
      controlla(
        await db
          .from('coda_letture')
          .upsert(letture, { onConflict: 'tipo,chiave', ignoreDuplicates: true }),
        'accoda',
      )
    },

    async prossime(quante) {
      return controlla(
        await db
          .from('coda_letture')
          .select('tipo, chiave, tentativi')
          .lte('da_fare_dal', new Date().toISOString())
          .order('priorita', { ascending: false })
          .order('creato_il')
          .limit(quante),
        'prossime',
      )
    },

    async completa(tipo, chiave) {
      controlla(await db.from('coda_letture').delete().match({ tipo, chiave }), 'completa')
    },

    async rimanda(tipo, chiave, tentativi, errore, quando) {
      controlla(
        await db
          .from('coda_letture')
          .update({ tentativi, ultimo_errore: errore, da_fare_dal: quando.toISOString() })
          .match({ tipo, chiave }),
        'rimanda',
      )
    },

    async registra(r) {
      controlla(await db.from('letture').insert(r), 'diario')
    },

    async gare(codici) {
      if (codici.length === 0) return []
      return controlla(
        await db.from('gare').select(COLONNE_GARA).in('codice', codici),
        'gare',
      ) as GaraSalvata[]
    },

    async gareDiAnno(anno) {
      return controlla(
        await db
          .from('gare')
          .select(COLONNE_GARA)
          .gte('dal', `${anno}-01-01`)
          .lte('dal', `${anno}-12-31`),
        'gare dell’anno',
      ) as GaraSalvata[]
    },

    async salvaGare(righe) {
      // A gruppi: le righe di un gruppo devono avere le stesse colonne.
      const gruppi = new Map<string, typeof righe>()
      for (const r of righe) {
        const chiave = Object.keys(r).sort().join(',')
        gruppi.set(chiave, [...(gruppi.get(chiave) ?? []), r])
      }
      for (const gruppo of gruppi.values()) {
        controlla(await db.from('gare').upsert(gruppo, { onConflict: 'codice' }), 'salva gare')
      }
    },

    async aggiornaGara(codice, campi) {
      controlla(await db.from('gare').update(campi).eq('codice', codice), 'aggiorna gara')
    },

    async invito(codice) {
      return controlla(
        await db
          .from('inviti')
          .select('gara_codice, testo, luogo, riferimento, email, web, verificato')
          .eq('gara_codice', codice)
          .maybeSingle(),
        'invito',
      ) as RigaInvito | null
    },

    async salvaInvito(riga) {
      controlla(await db.from('inviti').upsert(riga, { onConflict: 'gara_codice' }), 'salva invito')
    },

    async atleti() {
      return controlla(
        await db
          .from('atleti')
          .select('id, matricola, nome, cognome, classi_ranking')
          .eq('attivo', true),
        'atleti',
      ) as AtletaArchivio[]
    },

    async aggiornaAtleta(id, campi) {
      controlla(await db.from('atleti').update(campi).eq('id', id), 'aggiorna atleta')
    },

    async storico(atletaId) {
      return controlla(
        await db
          .from('partecipazioni')
          .select('gara_codice, divisione, classe, rank, posizione, totale')
          .eq('atleta_id', atletaId),
        'storico',
      ) as RigaPartecipazione[]
    },

    async storicoConTipologia() {
      const righe = controlla(
        await db.from('partecipazioni').select('atleta_id, divisione, gare(tipologia, dal)'),
        'storico con tipologia',
      ) as unknown as {
        atleta_id: string
        divisione: string
        gare: { tipologia: string; dal: string } | null
      }[]
      return righe.map((r) => ({
        atleta_id: r.atleta_id,
        divisione: r.divisione,
        tipologia: r.gare?.tipologia ?? '',
        dal: r.gare?.dal ?? '',
      }))
    },

    async salvaStorico(atletaId, righe) {
      controlla(
        await db.rpc('salva_storico', { p_atleta: atletaId, p_righe: righe }),
        'salva storico',
      )
    },

    async partecipanti(codiceGara) {
      const righe = controlla(
        await db
          .from('partecipazioni')
          .select('atleta_id, divisione, totale')
          .eq('gara_codice', codiceGara),
        'partecipanti',
      )
      return righe.map((r) => ({
        atletaId: r.atleta_id as string,
        divisione: r.divisione as string,
        totale: r.totale as number | null,
      }))
    },

    async potaClassifiche(primaDel) {
      return controlla(
        await db.rpc('pota_classifiche', { p_prima_del: primaDel }),
        'pota classifiche',
      ) as number
    },

    async ultimoBlocco() {
      const righe = controlla(
        await db
          .from('letture')
          .select('creato_il')
          .eq('esito', 'errore')
          .like('messaggio', `${PREFISSO_BLOCCO}%`)
          .order('creato_il', { ascending: false })
          .limit(1),
        'ultimo blocco',
      )
      return righe.length === 0 ? null : Date.parse(righe[0]!.creato_il as string)
    },

    async classificaProvvisoria(codiceGara) {
      const righe = controlla(
        await db.from('classifiche').select('provvisoria').eq('gara_codice', codiceGara).limit(1),
        'classifica provvisoria',
      )
      return righe.length === 0 ? null : (righe[0]!.provvisoria as boolean)
    },

    async salvaClassifica(codice, righe, impronta, provvisoria) {
      controlla(
        await db.rpc('salva_classifica', {
          p_gara: codice,
          p_righe: righe,
          p_impronta: impronta,
          p_provvisoria: provvisoria,
        }),
        'salva classifica',
      )
    },

    async salvaRanking(tipo, divisione, atleti, righe) {
      controlla(
        await db.rpc('salva_ranking', {
          p_tipo: tipo,
          p_divisione: divisione,
          p_atleti: atleti,
          p_righe: righe,
        }),
        'salva ranking',
      )
    },
  }
}
