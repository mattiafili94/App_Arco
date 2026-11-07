/**
 * Genera un codice personale di accesso e lo mostra SOLO in questo Terminale.
 * Serve per il primo accesso dell'amministratore (vedi supabase/README.md).
 *   npm run genera-codice -- 123456
 * Non incollare il codice in chat né in file della repo.
 */
import {
  emailTecnica,
  formattaCodice,
  generaCodice,
  matricolaValida,
  normalizzaMatricola,
} from '../supabase/functions/_shared/accesso.ts'

const matricola = normalizzaMatricola(process.argv[2] ?? '')
if (!matricolaValida(matricola)) {
  console.error('Scrivi la matricola dopo il comando, per esempio: npm run genera-codice -- 123456')
  process.exit(1)
}

const codice = generaCodice()
console.log(`
Email tecnica (Supabase > Authentication > Add user):
  ${emailTecnica(matricola)}

Password = codice personale (copialo ora, non viene salvato):
  ${codice}

Nell'app lo scriverai così (con o senza trattino):
  ${formattaCodice(codice)}
`)
