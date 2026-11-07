import { describe, expect, it, vi } from 'vitest'
import {
  gestisciCreaAccesso,
  leggiRichiesta,
  type AtletaPerAccesso,
  type Dipendenze,
} from '../../../supabase/functions/_shared/crea-accesso.ts'

const ID_ATLETA = '10000000-0000-0000-0000-00000000000b'
const ID_AMMINISTRATORE = 'utente-amministratore'

function finte(
  atleta: AtletaPerAccesso | null = { id: ID_ATLETA, matricola: '900002', utenteId: null },
  { chiamante = ID_AMMINISTRATORE as string | null, amministratore = true } = {},
) {
  const d = {
    indirizzoApp: 'https://arcieri-eugubini.pages.dev',
    utenteChiamante: vi.fn(async () => chiamante),
    chiamanteAmministratore: vi.fn(async () => amministratore),
    leggiAtleta: vi.fn(async () => atleta),
    eliminaAccesso: vi.fn(async () => {}),
    creaAccesso: vi.fn(async () => 'utente-nuovo'),
    collegaAccesso: vi.fn(async () => {}),
    generaCodice: () => 'K7PM3XQR9A',
  } satisfies Dipendenze
  return d
}

describe('leggiRichiesta', () => {
  it('accetta solo le azioni previste con un id valido', () => {
    expect(leggiRichiesta({ azione: 'genera', atletaId: ID_ATLETA })).toEqual({
      azione: 'genera',
      atletaId: ID_ATLETA,
    })
    expect(leggiRichiesta({ azione: 'cancella', atletaId: ID_ATLETA })).toBeNull()
    expect(leggiRichiesta({ azione: 'genera', atletaId: 'x' })).toBeNull()
    expect(leggiRichiesta({ azione: 'genera' })).toBeNull()
    expect(leggiRichiesta(null)).toBeNull()
    expect(leggiRichiesta('genera')).toBeNull()
  })
})

describe('gestisciCreaAccesso', () => {
  it('rifiuta chi non ha fatto l accesso', async () => {
    const d = finte(undefined, { chiamante: null })
    expect((await gestisciCreaAccesso({ azione: 'genera', atletaId: ID_ATLETA }, d)).stato).toBe(
      401,
    )
    expect(d.creaAccesso).not.toHaveBeenCalled()
  })

  it('rifiuta chi non è amministratore', async () => {
    const d = finte(undefined, { amministratore: false })
    const r = await gestisciCreaAccesso({ azione: 'genera', atletaId: ID_ATLETA }, d)
    expect(r.stato).toBe(403)
    expect(d.leggiAtleta).not.toHaveBeenCalled()
  })

  it('rifiuta una richiesta non valida e un atleta inesistente', async () => {
    expect((await gestisciCreaAccesso({ azione: 'x' }, finte())).stato).toBe(400)
    const r = await gestisciCreaAccesso({ azione: 'genera', atletaId: ID_ATLETA }, finte(null))
    expect(r).toEqual({ stato: 404, corpo: { errore: 'Atleta non trovato.' } })
  })

  it('genera un accesso nuovo e restituisce link e codice', async () => {
    const d = finte()
    const r = await gestisciCreaAccesso({ azione: 'genera', atletaId: ID_ATLETA }, d)
    expect(r).toEqual({
      stato: 200,
      corpo: {
        link: 'https://arcieri-eugubini.pages.dev/accesso#m=900002&c=K7PM3XQR9A',
        codice: 'K7PM3XQR9A',
      },
    })
    expect(d.eliminaAccesso).not.toHaveBeenCalled()
    expect(d.creaAccesso).toHaveBeenCalledWith(
      'matricola-900002@accesso.arcieri-eugubini.pages.dev',
      'K7PM3XQR9A',
      ID_ATLETA,
    )
    expect(d.collegaAccesso).toHaveBeenCalledWith(ID_ATLETA, 'utente-nuovo')
  })

  it('rigenerando, elimina prima il vecchio accesso (il vecchio telefono viene scollegato)', async () => {
    const d = finte({ id: ID_ATLETA, matricola: '900002', utenteId: 'utente-vecchio' })
    await gestisciCreaAccesso({ azione: 'genera', atletaId: ID_ATLETA }, d)
    expect(d.eliminaAccesso).toHaveBeenCalledWith('utente-vecchio')
    expect(d.eliminaAccesso.mock.invocationCallOrder[0]!).toBeLessThan(
      d.creaAccesso.mock.invocationCallOrder[0]!,
    )
  })

  it('revoca l accesso di un atleta', async () => {
    const d = finte({ id: ID_ATLETA, matricola: '900002', utenteId: 'utente-vecchio' })
    const r = await gestisciCreaAccesso({ azione: 'revoca', atletaId: ID_ATLETA }, d)
    expect(r).toEqual({ stato: 200, corpo: { revocato: true } })
    expect(d.eliminaAccesso).toHaveBeenCalledWith('utente-vecchio')
    expect(d.collegaAccesso).toHaveBeenCalledWith(ID_ATLETA, null)
  })

  it('revocare chi non ha un accesso non dà errore', async () => {
    const d = finte()
    const r = await gestisciCreaAccesso({ azione: 'revoca', atletaId: ID_ATLETA }, d)
    expect(r.stato).toBe(200)
    expect(d.eliminaAccesso).not.toHaveBeenCalled()
  })

  it('l amministratore non può revocare né rigenerare il proprio accesso dall app', async () => {
    const proprio = { id: ID_ATLETA, matricola: '900001', utenteId: ID_AMMINISTRATORE }
    for (const azione of ['revoca', 'genera'] as const) {
      const d = finte(proprio)
      const r = await gestisciCreaAccesso({ azione, atletaId: ID_ATLETA }, d)
      expect(r.stato).toBe(409)
      expect(d.eliminaAccesso).not.toHaveBeenCalled()
    }
  })

  it('senza un generatore indicato usa codici casuali validi', async () => {
    const senzaGeneratore: Dipendenze = { ...finte(), generaCodice: undefined }
    const r = await gestisciCreaAccesso({ azione: 'genera', atletaId: ID_ATLETA }, senzaGeneratore)
    expect(r.stato).toBe(200)
    expect('codice' in r.corpo && r.corpo.codice).toMatch(/^[2-9A-Z]{10}$/)
  })
})
