// Controlla le impostazioni di accesso in supabase/config.toml, che `npx supabase config push`
// applica al progetto vero. Un errore qui chiude fuori tutti (è già successo) o apre le iscrizioni.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** Legge `chiave = valore` di una sezione [nome] del file (basta per i valori semplici usati qui). */
function valore(sezione: string, chiave: string): string | undefined {
  const testo = readFileSync(new URL('./config.toml', import.meta.url), 'utf8')
  let corrente = ''
  for (const riga of testo.split(/\r?\n/)) {
    const titolo = /^\[([^\]]+)\]/.exec(riga)
    if (titolo) corrente = titolo[1]
    const coppia = /^(\w+)\s*=\s*(.+?)\s*$/.exec(riga)
    if (coppia && corrente === sezione && coppia[1] === chiave) return coppia[2]
  }
  return undefined
}

describe('impostazioni di accesso di Supabase', () => {
  it('nessuno può iscriversi da solo', () => {
    expect(valore('auth', 'enable_signup')).toBe('false')
    expect(valore('auth', 'enable_anonymous_sign_ins')).toBe('false')
  })

  it("l'accesso con email tecnica e codice resta acceso (spegnerlo blocca anche gli utenti esistenti)", () => {
    expect(valore('auth.email', 'enable_signup')).toBe('true')
  })

  it('niente email di conferma e codici di almeno 10 caratteri', () => {
    expect(valore('auth.email', 'enable_confirmations')).toBe('false')
    expect(valore('auth', 'minimum_password_length')).toBe('10')
  })
})
