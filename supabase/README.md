# Supabase: database e accessi

Il server dell'app. Qui ci sono:

| Cartella | Cosa contiene |
|---|---|
| `migrations/` | le tabelle e i permessi (in ordine di data) |
| `tests/database/` | i test dei permessi (pgTAP): girano su GitHub a ogni PR, su un Supabase di prova |
| `functions/crea-accesso/` | la funzione del server che crea e revoca i link personali |
| `functions/aggiorna-fitarco/` | la funzione del server che legge e salva i dati Fitarco (lista di lavoro) |
| `functions/prova-fitarco/` | prova (temporanea) che il sito Fitarco risponda dal cloud: non resta pubblicata |
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

## Aggiornamento dei dati Fitarco (`aggiorna-fitarco`)

La funzione legge da Fitarco calendario, schede, inviti, PDF dei risultati e ranking, un pezzo alla volta,
e scrive com'è andata nella tabella `letture` (il "diario", lo vede l'amministratore).

- Messa in funzione: `npx supabase secrets set AGGIORNA_CHIAVE=<lettere a caso>` e
  `npx supabase functions deploy aggiorna-fitarco --use-api --no-verify-jwt`. La chiave serve anche al
  controllo giornaliero (Fase 2.5): non metterla in chat né nella repo.
- Un giro a mano (al massimo 6 letture):
  `curl -X POST https://<id del progetto>.supabase.co/functions/v1/aggiorna-fitarco -H "x-aggiorna-chiave: <chiave>"`
- Mettere in lista le classifiche (ranking): stesso comando con `-d '{"azione":"ranking"}'`.
- Diario delle ultime letture (SQL Editor):
  `select creato_il, tipo, chiave, esito, messaggio from letture order by creato_il desc limit 50;`
- Lista di lavoro: `select * from coda_letture order by priorita desc, da_fare_dal;`

## Prova di lettura di Fitarco dal cloud

`functions/prova-fitarco/` fa **una** richiesta al calendario Fitarco dal server e dice se il sito risponde
(fatta l'8/11/2026: superata). Non resta pubblicata: si pubblica, si prova una volta e si elimina.

1. Una chiave usa e getta (non serve conservarla): `npx supabase secrets set PROVA_FITARCO_CHIAVE=<lettere a caso>`
2. `npx supabase functions deploy prova-fitarco --use-api --no-verify-jwt`
3. Una sola chiamata: `curl -X POST https://<id del progetto>.supabase.co/functions/v1/prova-fitarco -H "x-prova: <chiave>"`
   → `stato_http` 200 e `lettura` "ok" vuol dire che passa.
4. Subito dopo: `npx supabase functions delete prova-fitarco` e `npx supabase secrets unset PROVA_FITARCO_CHIAVE`.

## Comandi utili

| Comando | Cosa fa |
|---|---|
| `npm run test:db` | test dei permessi (serve Docker in locale; su GitHub girano da soli) |
| `npx supabase db push` | applica al progetto le migrazioni nuove |
| `npx supabase functions deploy crea-accesso --use-api` | pubblica la funzione del server |
