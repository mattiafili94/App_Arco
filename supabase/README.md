# Supabase: database e accessi

Il server dell'app. Qui ci sono:

| Cartella | Cosa contiene |
|---|---|
| `migrations/` | le tabelle e i permessi (in ordine di data) |
| `tests/database/` | i test dei permessi (pgTAP): girano su GitHub a ogni PR, su un Supabase di prova |
| `functions/crea-accesso/` | la funzione del server che crea e revoca i link personali |
| `functions/_shared/` | regole comuni ad app e server (codice, link, email tecnica) |
| `config.toml` | impostazioni: nessuna iscrizione libera, niente email di conferma, codici di 10+ caratteri |

**Mai** mettere nella repo o in chat: la password del database, la chiave segreta (`service_role` / `secret`),
i codici personali. La chiave **pubblica** (`publishable`) invece è fatta per stare nell'app.

## Messa in funzione (una volta sola)

1. **Progetto**: su https://supabase.com crea un progetto (regione Europa, Francoforte). Conserva la password
   del database in un posto sicuro (non serve in chat).
2. **Accesso dal Terminale**: `npx supabase login` (si apre il browser, confermi).
3. **Collegamento della repo al progetto**: `npx supabase link --project-ref <id del progetto>`
   (l'id è nell'indirizzo del progetto: `supabase.com/dashboard/project/<id>`). Chiede la password del database:
   la scrivi tu nel Terminale.
4. **Tabelle e permessi**: `npx supabase db push`.
5. **Impostazioni dell'accesso** (nessuna iscrizione libera, ecc.): `npx supabase config push`.
6. **Funzione del server**:
   - `npx supabase functions deploy crea-accesso --use-api`
   - `npx supabase secrets set INDIRIZZO_APP=https://arcieri-eugubini.pages.dev`
7. **Cloudflare Pages** → progetto `arcieri-eugubini` → Settings → Variables and Secrets, sia per Production che
   per Preview:
   - `VITE_SUPABASE_URL` = `https://<id del progetto>.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = la chiave **publishable** (Supabase → Project Settings → API Keys)

   poi ripubblica (Deployments → Retry deployment, oppure unendo una PR).

## Il primo amministratore (il tuo accesso)

L'app crea gli accessi solo per chi è già amministratore: il primo si crea a mano, una volta sola.

1. Nel Terminale, dalla cartella del progetto: `npm run genera-codice -- <tua matricola>`.
   Mostra l'email tecnica e il codice **solo** lì: copialo.
2. Supabase → **Authentication** → **Users** → **Add user** → **Create new user**:
   email = l'email tecnica, password = il codice, spunta **Auto Confirm User**.
3. Supabase → **SQL Editor**, sostituisci matricola, nome e cognome ed esegui:

   ```sql
   insert into public.atleti (matricola, nome, cognome, ruolo, utente_id)
   select '<matricola>', '<Nome>', '<Cognome>', 'amministratore', id
   from auth.users
   where email = 'matricola-<matricola>@accesso.arcieri-eugubini.pages.dev';
   ```

4. Apri l'app, **Accedi** con matricola e codice. Da Impostazioni → Amministrazione aggiungi gli altri atleti e
   genera i loro link.

Il tuo stesso accesso non si rigenera dall'app (per non chiuderti fuori per sbaglio): se serve, ripeti i passi 1–2
su quel tuo utente (Authentication → Users → … → Reset password, oppure eliminalo e ricrealo, poi rifai il passo 3
con `update public.atleti set utente_id = ...`).

## Comandi utili

| Comando | Cosa fa |
|---|---|
| `npm run test:db` | test dei permessi (serve Docker in locale; su GitHub girano da soli) |
| `npx supabase db push` | applica al progetto le migrazioni nuove |
| `npx supabase functions deploy crea-accesso --use-api` | pubblica la funzione del server |
