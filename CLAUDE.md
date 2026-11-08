# App Arco — istruzioni per Claude

Web app per il tiro con l'arco della **A.S.D. Compagnia Arcieri Eugubini** (Gubbio, codice società Fitarco 11003).
Proprietario e amministratore: Mattia (repo `mattiafili94/App_Arco`).
Lingua di lavoro: **italiano** (testi dell'app, commenti, messaggi di commit). Mattia è alle prime armi con
Claude Code: spiegare le cose in modo semplice.

## Obiettivo

Un'app privata per i 10-12 atleti attivi della compagnia che:
1. mostra **calendario gare dell'Umbria** e iscrizioni, con avviso quando esce un invito;
2. mostra **risultati, storico, record personali e posizione in classifica** (ammissione ai Campionati Italiani)
   di tutti, presi in automatico dal sito pubblico Fitarco;
3. offre un'area **allenamento** personale: programma settimanale, diario, segnapunti per le simulazioni di gara.

Principio guida: **automatizzare tutto quello che si può**, Mattia vuole scrivere il meno possibile.

## Decisioni prese (brainstorming del 7/11/2026)

Queste decisioni sostituiscono quelle della prima versione di questo file (app Expo personale e solo offline).

### Tecnologia
- **Web app installabile (PWA)** per tutti: si apre da un link e si aggiunge alla schermata Home.
  Stessa app per Android e iPhone, niente store e niente account Apple Developer.
- **React + TypeScript + Vite** (non più Expo). Monorepo:
  ```
  apps/web/          ← la web app (PWA)
  packages/shared/   ← tipi e logica comune: punteggi, prove, record, lettura dei PDF
  supabase/          ← database, permessi, funzioni che leggono Fitarco
  ```
- **Server: Supabase** (piano gratuito): database Postgres condiviso, permessi (row-level security), funzioni.
  - Il piano gratuito va **in pausa dopo una settimana di inattività** (es. ad agosto): un controllo automatico
    giornaliero lo tiene attivo e avvia anche le letture periodiche di Fitarco.
- **Cloudflare** (gratis): **Cloudflare Pages** pubblica la web app (anche da repo privata, indirizzo `…pages.dev`;
  GitHub Pages con repo privata è a pagamento) e un **Cloudflare Worker** con cron fa il controllo giornaliero.
  - **Indirizzo dell'app: https://arcieri-eugubini.pages.dev** (progetto Pages `arcieri-eugubini`, account
    Cloudflare di Mattia collegato a GitHub, accesso solo alla repo App_Arco).
  - Pubblicazione automatica: ogni unione in `main` va in produzione; ogni PR riceve un indirizzo di anteprima
    (Cloudflare lo scrive nella PR). Impostazioni: build `npm run build`, output `apps/web/dist`,
    `NODE_VERSION=24`. Nessun segreto nella build per ora.
  - Per provare i test nel browser su un indirizzo pubblicato:
    `E2E_BASE_URL=https://arcieri-eugubini.pages.dev npm run test:e2e -w @arco/web`.
- Scelte confermate dalla verifica "avvocato del diavolo" del 7/11/2026: React + Vite (non Next.js: non serve un
  server per le pagine), Supabase (non Firebase: dati relazionali; non PocketBase: niente server da gestire),
  Dexie + sincronizzazione scritta da noi (non PowerSync/RxDB/Dexie Cloud: troppo per 12 persone o a pagamento).
  Se in futuro servirà un'app nativa (es. smartwatch) si può impacchettare la stessa web app con **Capacitor**.
- **Niente AI sul server**: tutte le letture (JSON Fitarco, PDF dei risultati) con codice normale (estrazione testo + regole).
- **Tutta l'app funziona offline** (in palestra la rete è debole):
  - database nel telefono (IndexedDB con Dexie) con la copia di **tutti** i dati: calendario, risultati, record, classifica, allenamento;
  - sincronizzazione quando c'è rete (all'apertura, al ritorno della connessione, periodicamente), con indicatore di stato;
  - dati condivisi: solo dal server al telefono, scaricando solo le novità;
  - dati di allenamento: nei due sensi, vince la modifica più recente;
  - l'app stessa si apre offline (service worker). La copia sul server fa anche da backup.

### Utenti e accesso
- Si parte con i **10-12 atleti attivi** (la società ha 34 tesserati). Un atleta entra nella lista quando fa il
  primo accesso, e solo allora se ne scaricano i dati.
- Accesso con **matricola + link personale** generato dall'amministratore (contiene anche un codice breve da
  digitare se serve, es. su iPhone dopo "Aggiungi a Home"). Il telefono si ricorda la persona: niente password.
  - Realizzazione: Supabase Auth è pensato per email/password, quindi per ogni atleta il server crea un utente
    "tecnico" e il link personale ne contiene le credenziali. Per l'atleta resta "tocca il link e sei dentro".
  - Dettagli (passo 5 della Base): codice di 10 caratteri senza caratteri ambigui; email tecnica
    `matricola-<n>@accesso.arcieri-eugubini.pages.dev`; link `/accesso#m=<matricola>&c=<codice>` (dopo il `#`,
    mai inviato ai server). Tabella `atleti` con `utente_id` collegato all'utente tecnico (gestito solo dalla
    funzione `crea-accesso`). Rigenerare il link elimina il vecchio utente tecnico (il vecchio telefono si
    scollega); revocare lo elimina. Il primo amministratore si crea a mano: vedi `supabase/README.md`.
  - Sul telefono restano la sessione (`arco.sessione`) e la scheda dell'atleta (`arco.profilo`): l'app si apre
    anche offline. Senza accesso si vede solo la pagina Accedi.
- Ruoli: amministratore (Mattia) e atleta.

### Struttura dell'app: 4 tab + impostazioni
1. **Gare**: calendario Umbria (tutte le tipologie) con stato delle iscrizioni. Scheda gara: invito completo,
   risultati (classifica come schermata con gli Eugubini evidenziati + PDF originale), "Aggiungi al calendario".
2. **Atleti**: elenco membri (l'utente in cima). Scheda atleta: record personali, andamento, storico gare.
3. **Classifica**: la ranking per l'ammissione ai Campionati Italiani, **completa** come sul sito Fitarco (tutti gli
   atleti, punti totali e le due gare che contano), con filtri (tipo di gara, arco, classe, genere, regione). In
   primo piano **solo la tua posizione**; gli altri si cercano con i filtri. Pulsante "Aggiorna" con data
   dell'ultimo aggiornamento (Mattia, 10/11/2026). Soglia di ammissione: più avanti.
4. **Allenamento** (privato, visibile solo all'atleta): settimana con il programma dettato dall'allenatore e
   scritto dall'atleta, attività da segnare come fatte, "copia la settimana scorsa", diario, segnapunti.
- **Impostazioni** (icona in alto): tema, interruttore "Notifiche nuovi inviti", stato sincronizzazione.
  **Area amministratore** (solo Mattia): membri e link di accesso, importazione calendario, primo caricamento storico.

### Dati Fitarco: cosa, da dove, quando
| Dato | Fonte | Quando |
|---|---|---|
| Membri e matricole | ricerca tesserati per società | al primo accesso di ognuno |
| Storico gare | scheda atleta (dalla matricola) | una volta, poi in automatico |
| Risultati dettagliati (parziali, 10, X…) | PDF dei risultati della gara | quando la gara risulta "Terminata" |
| Record personali | **calcolati da noi** (Fitarco non li pubblica) | a ogni nuovo risultato |
| Classifica Campionati Italiani | ranking (nazionale completa) | **lunedì alle 10:00** (una classifica ogni 15 minuti) e pulsante "Aggiorna" (stessa classifica al massimo ogni 6 ore); cercare con i filtri legge solo il nostro database |
| Calendario Umbria | calendario | **solo l'anno in corso** (da ottobre anche il provvisorio del prossimo), ogni settimana; gli anni passati no (Mattia, 8/11/2026): delle gare passate restano solo quelle dei nostri atleti |
| Inviti (date iscrizioni) | scheda gara → invito | controllo periodico delle gare future |

- **Inviti** (decisione di Mattia, 10/11/2026, sostituisce i promemoria gestiti dall'app): niente estrazione
  automatica delle date e **nessun promemoria creato nell'app**. Quando esce l'invito NUOVO di una gara
  **futura**, a tutti i telefoni con l'interruttore "Notifiche → Nuovi inviti" acceso arriva una notifica push
  ("È arrivato l'invito di 18 m · Perugia (12 dic 2026). Tocca per leggerlo."); toccandola si apre la scheda
  gara, dove c'è il testo completo e "Aggiungi al calendario": gli orari li legge ognuno e si crea il suo
  promemoria. Niente notifica per inviti già salvati, modificati, di gare passate o annullate.
- **Come funzionano le notifiche** (una web app non può programmare da sola notifiche future sul telefono):
  **Web Push dal server** (gratis, chiavi VAPID). Android sì; iPhone da iOS 16.4 e solo con l'app aggiunta
  alla schermata Home (l'interruttore lo spiega). Il telefono deve aver dato il permesso almeno una volta.
  Il "Aggiungi al calendario" (file `.ics` per iPhone, link Google Calendar per Android) resta il modo più
  affidabile per avere l'allarme.
- **Quanti dati tenere** (deciso l'8/11/2026, finestra ridotta il 9/11/2026): classifiche **complete** (tutti
  gli atleti) solo per le gare dell'anno in corso e dell'**anno scorso** (oggi 2025–2026,
  `ANNI_CLASSIFICHE_COMPLETE = 1`); le letture rimaste in lista per gare più vecchie escono senza richieste.
  **Inviti**: solo per le gare future dell'Umbria (promemoria iscrizioni); per le gare passate si legge solo la
  scheda, una volta, per il link al PDF. Per le gare più vecchie della finestra si tengono
  solo le righe degli Eugubini, **anche di chi non è ancora nell'app** (società 11003: quando entra avrà i
  dettagli), con parziali e prove. A inizio anno il server riduce da solo la stagione uscita dalla finestra
  (`pota_classifiche`) e toglie le gare uscite dalla finestra senza nostri atleti (`pota_gare`). Lo storico
  dalla scheda atleta resta intero.
  **Quali gare si leggono** (scheda gara + PDF, Mattia 9/11/2026, `DATA_AVVIO` = 7/11/2026, primo accesso
  dell'amministratore): le gare finite **prima** dell'avvio solo se le ha fatte un nostro atleta (dallo
  storico); le gare dell'Umbria **dall'avvio in poi** tutte, chiunque abbia partecipato (`garaRilevante`).
  **Atleta che entra dopo**: alla lettura della sua scheda il server collega a lui le sue righe nelle
  classifiche già salvate (`collega_righe`, per cognome + nome + società 11003): niente da riscaricare.
  **Per risparmiare richieste** (Mattia, 8/11/2026): le gare più vecchie della finestra si conoscono SOLO dallo
  storico della scheda atleta (una richiesta per atleta): niente calendari, schede gara né PDF per loro (un
  arciere che tira dal 2009 non costa ~500 richieste). Compromesso: per quelle gare ci sono totale e posizione
  ma non parziali, prove e conteggi 10/X, quindi i 25+18 e i doppi 70 m vecchi non si dividono in prove per i
  record. Le gare lette mentre erano nella finestra tengono invece i dettagli dei nostri atleti per sempre.
- **Storico automatico**: dopo ogni gara il server legge il PDF, trova gli Eugubini (per nome + società, il PDF non
  ha la matricola) e aggiorna storico e record. Risultato "provvisorio" finché la gara non è omologata.
  Le gare fuori dall'Umbria si trovano tramite i codici gara nelle schede atleta.
- **Classifica**: il server scarica solo le classifiche necessarie (tipo × divisione × classe × genere), senza
  doppioni: quelle dei nostri atleti (se mancano, subito; poi ogni lunedì dalle 10) e quelle che qualcuno ha
  scaricato col pulsante "Aggiorna" (anche queste si rileggono il lunedì). Una classifica nazionale ha centinaia
  di atleti (421 per Ricurvo Senior M indoor, ~150 KB salvata): una richiesta ciascuna.

### Regole di record e statistiche
Le gare composte si dividono in **prove**; record, andamento e medie si calcolano per prova.
Nello storico la gara resta una sola, con totale e posizione.
- **Indoor** (stessa ranking): 18 m e 25 m con record separati. **25+18** → prova 25 m (record 25 m) + prova 18 m (record 18 m).
- **Outdoor**: 70 m (60 m o 50 m secondo classe/divisione). **Doppio 70 m** → prova 1 + prova 2, ognuna come un 70 m singolo.
- **Campagna** (su Fitarco si chiama Hunter & Field): **12+12** e **24+24** con record separati; il 24+24 **non** si divide.
- **3D**: un record.
- Record divisi anche per **divisione** (ricurvo, compound, nudo, istintivo, longbow).
- **Un arciere può cambiare arco** nella carriera (detto da Mattia l'8/11/2026): può avere record e ranking su più
  divisioni e perfino tirare **nella stessa gara due sessioni con due archi diversi**. In quel caso ha due righe
  nello storico (una per divisione) e due nella classifica del PDF; la sentinella confronta atleta + divisione.
  Le ranking da chiedere usano solo gli archi delle ultime stagioni.
- Il numero di 10 / X / 9 nei PDF c'è solo sul totale della gara, non per prova.

### Segnapunti (simulazioni di gara, nel tab Allenamento, privato)
- Tutti i tipi: 18/25 m (bersaglio singolo e trispot), 70/60/50 m (122 cm e 80 cm ridotto), 12+12 e 24+24, 3D,
  anche le gare composte divise in prove.
- Inserimento con tocco sul bersaglio (posizione della freccia, lente d'ingrandimento) + tastierino veloce;
  per il 3D solo tastierino.
- Timer della volée con segnale acustico, note per volée, confronto media allenamento / gara.
- Le regole di punteggio di 3D e Hunter & Field vanno **confermate con Mattia** prima di scriverle.

### Rapporto con il sito Fitarco
- Si leggono solo **dati pubblici**, poco e di rado, con cache. Niente area riservata Fitarco.
- **Mai travestirsi da browser** né aggirare filtri anti-bot. Mattia ha deciso di **non scrivere a Fitarco**.
- Test del 7/11/2026 dal PC: con curl standard le richieste passano; con un User-Agent personalizzato
  ("AppArco…") il sito risponde subito "Service unavailable" (filtro sul nome). Non provare altri User-Agent per
  trovare quello che passa.
- Il server usa il suo client HTTP standard (`fetch` di Deno, User-Agent non modificato).
  **Test di lettura dal cloud dell'8/11/2026: superato.** Da una funzione Supabase (Francoforte) il calendario
  Umbria risponde 200 in meno di un secondo (51 gare). Il codice della prova resta in
  `supabase/functions/prova-fitarco/` per rifarla se un giorno il sito bloccasse (vedi `supabase/README.md`).
  Se succede: prova onesta da Cloudflare Workers (stessa regola: niente travestimenti), poi piano B: lettura
  dal browser vero di Mattia sul sito Fitarco (pulsante/bookmarklet) che invia i dati al server.
- **Condizioni d'uso** (controllate l'8/11/2026): il sito non ha una pagina di condizioni d'uso, solo privacy e
  cookie (che non parlano di letture automatiche). `robots.txt` di fitarco.it vieta solo cartelle tecniche;
  quello di fitarco-italia.org (PDF) solo `/cartefederali/giustizia/`.
- I risultati contengono nomi di atleti: **non pubblicarli** (repo privata, nessun dump pubblico).

### Riferimento tecnico Fitarco (verificato il 7/11/2026)
Tutte le richieste dati sono POST con campi form `call`, `render`, `params` (JSON), senza captcha né chiavi.
La risposta è `{"status":"OK","content":"<html…>"}`.
- **Elenchi** → `https://www.fitarco.it/index.php?option=com_tesseramentofiv&view=risultati&format=json`
  - Ranking: `call=ranking_gare`, `render=lista_ranking_gare_results` (oppure `lista_ranking_gare_excel`: righe JSON
    pronte). Params: `idRankingTipo` (I indoor, T targa, C campagna, 3 3D), `idDivisione` (OL, CO, AN, AI, LB),
    `idClasse` (M, S, J, A, R), `idGenere` (M, F), `idTipoSquadra` (0, 1), `idComitato` (11 Umbria; **vuoto = tutta Italia**: "00" non
    dà risultati, verificato il 10/11/2026). La posizione restituita è quella nazionale anche filtrando per regione.
    Con comitato vuoto ogni riga ha la sua società e le due gare con i punti (Ricurvo Senior M indoor: 421 atleti).
    Nessun risultato = `<div class="no-results">`.
  - Calendario: `call=calendario`, `render=lista_calendario_results`, params `idPeriodo` (anno), `idComitato`,
    `mese`, `idClasseEvento`, `idsTipoGare`, `idMatchRound`. Esiste già il "Calendario provvisorio 2027".
  - Tesserati: `call=tesserati`, `render=lista_tesserati_results`, params `tesserato_nome`, `tesserato_cognome`,
    `tesserato_matricola`, `nome_societa`.
- **Dettagli** → `…&view=dettaglio&format=json`
  - Scheda atleta: `call=scheda_tesserato`, `render=scheda_tesserato_result`, `{"matricola": …}` → anagrafica,
    classe di ranking, posizione, storico completo (codice, data, località, tipologia, divisione, posizione, totale).
  - Scheda gara: `call=calendario`, `render=scheda_gara_result`, `{"codice": …}` → stato e link ai PDF.
  - Invito: `call=invito`, `render=scheda_invito_result`, `{"codiceGara": …}` → testo libero (date iscrizioni lì dentro).
  - Società: `call=societa`, `render=scheda_societa_result`, `{"codiceAffiliazione": …}`.
- **Valori dei filtri** (letti dinamicamente, non scriverli a mano): GET
  `…&view=filtri&format=json&call=filtri/<kind>&kind=<kind>&classe=<classe>` con `ranking_gare`/`ranking` oppure
  `calendario`/`ricerca_gare`.
- **PDF risultati**: prendere i link dalla scheda gara (le gare annullate non li hanno), di solito
  `https://www.fitarco-italia.org/upload_<anno>/<codice>.pdf` e `_team.pdf`; con scontri diretti anche `_abs`, `_grid`, `_rank`.
  - Sono PDF di testo (`pdftotext -raw`). Per categoria c'è una riga d'intestazione che dichiara le colonne
    (`18m-1 18m-2 Totale 10 9`, `70m-1 70m-2 Totale 10+X X`, `H&F Totale 6 5`, `Hunter Field Totale 6 5`, `Perc. Totale 11 10`).
  - Riga atleta: posizione, turno-piazzola, COGNOME Nome (a volte con una parola in più, es. "Junior"),
    categoria (2 cifre), codice società (5 cifre), società, parziali `punti/ posizione`, totale, due conteggi.
  - Gare doppie e 25+18: **più righe per atleta** (una riga per prova + riga finale con totale tipo `1.107`,
    punto delle migliaia).
  - Nei PDF vecchi il ricurvo si chiama "Arco Olimpico".

## Test (obbligatori, decisi il 7/11/2026)

Obiettivo: nessuna regressione quando si modifica l'app, e accorgersi subito se Fitarco cambia formato.

**Regole**
1. Ogni funzione nuova arriva con i suoi test **nella stessa pull request**. Niente test, niente unione.
2. Ogni bug corretto riceve **prima** un test che lo riproduce (deve fallire), poi la correzione.
3. Su GitHub il workflow `.github/workflows/ci.yml` esegue `npm run check` e la build a ogni PR:
   se è rosso, la PR non si unisce. (Le GitHub Actions servono solo ai test, **mai** a leggere Fitarco.)
4. Prima di ogni commit eseguire in locale `npm run check`.

**Livelli**
| Livello | Cosa | Strumento | Soglia |
|---|---|---|---|
| Logica | regole in `packages/shared` (tipologie, prove, record, classifica, date, sincronizzazione) | Vitest | copertura **≥ 90%** (controllata in automatico) |
| Lettori Fitarco | risposte JSON, schede, calendario, PDF dei risultati | Vitest + esempi salvati | almeno un esempio reale per ogni formato + casi strani noti |
| Componenti | pezzi dell'interfaccia e loro stati | Vitest + Testing Library | ogni componente con i suoi stati |
| Database | permessi (row-level security) | test di Supabase | un test per ogni regola (es. un atleta non legge l'allenamento di un altro) |
| App completa | percorsi veri nel browser, schermo da telefono, offline e sincronizzazione | Playwright | un test per ogni percorso importante |
| Accessibilità | contrasti e leggibilità nei 3 temi | axe dentro Playwright | zero errori |
| Sentinella | in produzione: letture Fitarco con risultati anomali | controllo giornaliero | avvisa invece di salvare dati sbagliati |

**Privacy degli esempi**: i PDF e le risposte Fitarco contengono nomi di atleti. Prima di salvarli nella repo
come esempi di test vanno **anonimizzati** (nomi finti, formato e punteggi veri).

**Quando arrivano**: logica e controllo su GitHub dal passo 1; componenti, Playwright, offline e accessibilità dal
passo 3 della Base; permessi con Supabase; esempi Fitarco e sentinella dalla fase del lettore Fitarco.

**Comandi**: `npm run check` (tutto tranne il browser) e `npm run test:e2e` (Playwright, schermo da telefono:
percorsi, offline, accessibilità axe nei 3 temi, 320 px e testo al 200%). Su GitHub girano entrambi, più
`npm run test:db` (permessi pgTAP su un Supabase di prova; in locale serve Docker, che sul PC di Mattia non c'è).
Nei test nel browser Supabase è simulato (`apps/web/e2e/supabase-finto.ts`): mai il progetto vero.

## Ordine di lavoro (provvisorio, il piano dettagliato va approvato da Mattia)

1. **Base**, a passi, una PR per passo:
   1. monorepo e test automatici ✅;
   2. design system UI Top: token, temi, componenti ✅;
   3. scheletro PWA: pagine, Impostazioni, installabile, offline, test nel browser ✅;
   4. pubblicazione su **Cloudflare Pages** (anteprima per ogni PR; serve per installarla sul telefono) ✅;
   5. **Supabase** e accesso con link personale (+ test dei permessi) ✅. Progetto vero `flsdchsfdqurwjzpfmtr`
      (Francoforte, piano gratuito), messo in funzione il 7/11/2026 (`supabase/README.md`); Mattia è amministratore.
      Variabili `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` su Cloudflare (Production e Preview).
      Attenzione: in `config.toml` `[auth.email] enable_signup` deve restare `true` (con `false` nessuno entra);
      le iscrizioni libere le vieta `[auth] enable_signup = false`. Lo controlla `supabase/config.test.ts`.
      Eliminare un atleta per ora si fa a mano (Revoca accesso + SQL); in futuro un "Disattiva atleta".
2. **Lettore Fitarco**, una PR per passo (piano approvato l'8/11/2026):
   1. condizioni d'uso e prova di lettura dal cloud ✅;
   2. lettori delle risposte Fitarco (calendario, scheda gara, invito, scheda atleta, tesserati, classifica),
      client "educato" (una richiesta alla volta, 2 s di pausa, cache 10 min, nessun nuovo tentativo
      automatico), esempi anonimizzati ✅. Note:
      - il codice sta in `supabase/functions/_shared/fitarco/` (lo usano le funzioni Deno) e `packages/shared`
        lo riesporta; esempi e test in `packages/shared/src/fitarco/` (esempi esclusi da Prettier: vanno
        tenuti esattamente come li manda Fitarco, spazi "non separabili" compresi);
      - HTML letto con `node-html-parser`: ogni funzione Deno che usa il lettore deve dichiararlo nel suo
        `deno.json` (`"node-html-parser": "npm:node-html-parser@<stessa versione>"`);
      - se il formato non è quello atteso i lettori lanciano `ErroreFormatoFitarco` (base della sentinella);
        stati del calendario nuovi diventano `sconosciuto`;
      - la versione "excel" della ranking non è JSON valido: si usa quella HTML;
      - nello storico atleta la posizione 999 compare in alcuni Campionati Regionali (da capire con i PDF);
      - dalla scheda atleta non si prendono data di nascita né tecnico (non servono);
   3. lettore dei PDF dei risultati ✅ (`pdf-testo.ts` dal PDF alle righe, `risultati.ts` dalle righe alla
      classifica). Note:
      - libreria `unpdf` (pdf.js): i pezzi di una riga hanno altezze leggermente diverse, si uniscono entro
        3 punti. Per le gare semplici il testo è identico a `pdftotext -raw`; provato anche sul server
        Supabase (stessi risultati). Nel `deno.json` delle funzioni: `"unpdf": "npm:unpdf@<stessa versione>"`;
      - gare composte (25+18, doppio 70 m): la riga atleta ha solo totale e conteggi, le due prove stanno
        nella riga **sopra** (prima prova) e **sotto** (seconda), abbinate per vicinanza (~6 punti);
      - casi veri gestiti: "DNF" (ritirato, parziale senza posizione), colonna "Cat." a volte vuota,
        classe dell'atleta dopo il nome ("Rita MF", "Brando GM"), "… Continua" nella pagina dopo,
        "Arco Olimpico", gare annullate senza PDF (il link dà una pagina 404: errore "non è un PDF"),
        atleti di club esteri (paese al posto del codice società, es. "04 ESTONIA Club…": codice
        `CODICE_SOCIETA_ESTERA` = "00000", il paese resta nel nome della società; scelta di Mattia,
        8/11/2026, così il database non cambia);
      - sentinella: la somma dei parziali deve fare il totale (e le due prove il totale); una divisione
        sconosciuta o una riga atleta che non torna fermano la lettura con `ErroreFormatoFitarco`;
      - esempi: le righe di testo di 7 PDF veri (18 m, 70 m, 12+12, 3D, doppio 70 m, 24+24 del 2022,
        25+18), con atleti e giudici rinominati; i PDF veri restano fuori dalla repo;
   4. database e salvataggio, in due PR (piano approvato l'8/11/2026):
      - **2.4a** ✅ migrazione `20261108120000_dati_fitarco.sql`: tabelle `gare`, `inviti`, `partecipazioni`
        (storico), `classifiche` (complete, dai PDF, con `atleta_id` per gli Eugubini e `provvisoria`),
        `ranking` (solo i nostri atleti), `letture` (diario/sentinella, solo admin), `coda_letture` (solo
        server); colonne `classe`, `genere`, `classi_ranking`, `scheda_letta_il` in `atleti`. I membri
        leggono, scrive solo il server (anche l'admin non può modificare). Salvataggi "tutto insieme":
        `salva_classifica`, `salva_storico`, `salva_ranking` (solo service_role). Ogni riga ha
        `aggiornato_il`; le classifiche si sostituiscono intere (i telefoni le riscaricano quando cambia
        `gare.risultati_aggiornati_il`). I record non hanno tabella: si calcolano dalle prove (Fase 4).
        Regole pure in `supabase/functions/_shared/aggiornamento/`: riconoscere gli Eugubini nei PDF
        (cognome + nome + società 11003, senza accenti; omonimi → nessun collegamento), righe per il
        database, combinazioni di ranking, `pianificaLetture` (calendario anno in corso ogni 7 giorni, il
        prossimo da ottobre, mai gli anni passati; inviti delle gare future
        dell'Umbria ogni 7 giorni; scheda gara ogni giorno per un mese dopo la gara, poi ogni settimana,
        finché c'è il PDF; risultati provvisori ogni 3 giorni e subito quando la gara è omologata o compie
        60 giorni; schede
        atleta subito per i nuovi, poi ogni 7 giorni), sentinella (calendario vuoto/dimezzato, storico più
        corto, Eugubini attesi non trovati nel PDF o con totale diverso). Le "ultime letture" vengono dal
        diario `letture`. Posizione 999 dello storico → nessuna posizione;
      - **2.4b** ✅ funzione `aggiorna-fitarco` (motore in `_shared/aggiornamento/motore.ts`, provato con
        database e Fitarco finti in `packages/shared/src/aggiornamento/`). Ogni chiamata (header
        `x-aggiorna-chiave` = segreto `AGGIORNA_CHIAVE`): pianifica, accoda, fa al massimo 6 letture di cui
        1 "pesante" (PDF o calendario) in 40 s, salva solo le novità, scrive il diario; si ferma se Fitarco
        non risponde; letture fallite riprovate dopo 2, 4, 8… ore (max 1 giorno). `{"azione":"ranking"}`
        accoda le classifiche dei nostri atleti. Stato dal database con `stato_aggiornamento()`.
        Scoperte dal primo caricamento (8/11/2026):
        - il calendario con comitato "00" NON è tutta Italia: sono solo le gare nazionali/internazionali
          (46 nel 2026). Lo stato delle gare fuori Umbria non si conosce, e quello delle gare di fine anno si
          perde a gennaio (si legge solo il calendario dell'anno in corso): **ogni** gara si considera
          definitiva quando è omologata o 60 giorni dopo la fine; PDF cercato al massimo per 90 giorni
          dopo la gara (`risultatiProvvisori`). A ogni giro `pota_gare` toglie le gare degli anni passati
          che nessun nostro atleta ha fatto (con classifiche e inviti);
        - il calendario provvisorio del prossimo anno ha quasi tutte le gare con codice temporaneo
          (`tmp11564`): si salvano solo i codici definitivi, le altre arrivano quando hanno il codice vero;
        - un aggiornamento parziale di una gara va fatto con `update` (`aggiornaGara`), non con "inserisci o
          aggiorna" (Postgres vuole comunque i campi obbligatori);
        - pdf.js consuma il file che riceve: `estraiRighe` gli passa una copia;
        - il database finto dei test (`archivio-finto.ts`) imita i vincoli di quello vero (colonne del
          diario, campi obbligatori delle gare): se si aggiunge un vincolo, aggiungerlo anche lì;
        - nei PDF ci sono categorie paralimpiche: "Compound W1" → divisione `W1`, "Visually Impaired 1" →
          `V1` (codice divisione `^[A-Z][A-Z0-9]$`). Altre categorie nuove fermano la lettura: aggiungerle
          a `DIVISIONI_PDF` dopo aver visto il PDF;
        - un PDF senza atleti è un'anomalia (non si salva, si riprova ogni 3 giorni);
        - **dopo circa 100 richieste in mezz'ora (giri lanciati uno dopo l'altro) Fitarco ha risposto 503.**
          Da allora: se Fitarco non risponde, TUTTE le letture si fermano per 6 ore (`PAUSA_DOPO_BLOCCO_MS`,
          diario con prefisso `PREFISSO_BLOCCO`). Non lanciare giri a raffica: il controllo automatico li
          distanzia (Fase 2.5);
   5. controllo automatico ✅ (9/11/2026): Worker Cloudflare `arcieri-eugubini-controllo` in
      `workers/controllo/` (logica in `src/controllo.ts`, con test). Cron `0,15,30,45 5-22 * * *` (UTC) e
      controllo dell'ora italiana nel codice: **ogni 15 minuti dalle 7:00 alle 22:45** (scelta di Mattia).
      Ogni chiamata = un giro di `aggiorna-fitarco` (al massimo 6 letture, 1 pesante; zero richieste se non
      c'è niente da fare); tiene anche sveglio Supabase. La chiave è il segreto `AGGIORNA_CHIAVE` del
      Worker (uguale a quello della funzione). Pubblicazione dalla cartella del Worker:
      `npx wrangler@4.152.0 deploy` (serve `npx wrangler@4.152.0 login` di Mattia, già fatto); log in
      Cloudflare → Workers → arcieri-eugubini-controllo → Logs. Wrangler non è una dipendenza della repo
      (scarica parecchio): si usa con `npx` alla versione indicata. La classifica (ranking) resta solo su
      richiesta (`{"azione":"ranking"}`, poi pulsante "Aggiorna" nel tab Classifica).
3. **Tab Gare**, una PR per passo (piano approvato il 9/11/2026):
   1. sincronizzazione offline ✅ (`apps/web/src/sync/`): database sul telefono con Dexie (`ArcoDb`: atleti,
      gare, inviti, partecipazioni, classifiche, ranking + `meta` con i cursori). Si scaricano solo le righe
      cambiate (`aggiornato_il`, margine di 2 minuti, pagine da 1000, ordine stabile data + chiave); le
      eliminazioni arrivano dal registro `eliminazioni` (migrazione `20261109130000`, trigger su ogni tabella,
      tracce tenute 60 giorni, ripulite da `pota_classifiche`); primo giro = tutto; telefono fermo da più di
      45 giorni = riparte da zero. Solo dal server al telefono (dati condivisi). Parte all'apertura, al
      ritorno della rete, quando l'app torna in primo piano e ogni 5 minuti; senza rete non fa niente.
      `Sincronizzazione` (provider nei soli membri) espone `useSincronizzazione()` con `db`, stato e `aggiorna`;
      Impostazioni → "Dati" mostra l'ultimo aggiornamento e il pulsante "Aggiorna ora". All'uscita
      (`servizio.esci` e SIGNED_OUT) la copia si svuota. `remoto` è parte di `ServizioAccesso`
      (finto nei test: `test/remotoFinto.ts`). Attenzione: non lanciare `prettier --write` sull'intera
      `apps/web/src` (riformatta `tokens.css`, che è generato);
   2. tab Gare ✅: calendario e scheda gara (invito, "Aggiungi al calendario"), con le gare fuori regione dei
      nostri atleti nella parte "Passate". Elenco (`pagine/Gare.tsx`): "Prossime" (la più vicina per prima) e
      "Passate" (la più recente per prima), riga = tipologia · luogo, date, e sotto stato / "Fuori regione" /
      "Hai partecipato". Scheda (`pagine/DettaglioGara.tsx`, `/gare/:codice`): dettagli, "Aggiungi al
      calendario" solo per le gare future non annullate (file `.ics` per iPhone e Android con avviso alle 9:00
      del giorno prima + link Google Calendar), contatti e testo completo dell'invito (a capo rispettati),
      link al PDF dei risultati. Logica pura in `packages/shared/src/gare.ts` (date italiane, stato,
      `creaIcs` con righe piegate a 75 byte, `linkGoogleCalendar`). Dati dal telefono con `useLiveQuery`
      (`gare/dati.ts`), quindi anche offline. `ListRow` ha ora `description` (seconda riga) ed `esterno`
      (link fuori dall'app). Nei test del browser le date delle gare sono relative a oggi e le pagine lunghe
      si controllano con viewport alto (la barra dei tab coprirebbe un pezzo e axe lo segnala);
   3. risultati nella scheda gara ✅ (`pagine/Risultati.tsx`, `/gare/:codice/risultati`): la scheda gara ha
      la riga "Classifica" (atleti, nostri, provvisori) accanto al PDF. La pagina mostra prima "I nostri
      atleti" (di tutte le categorie: atleti riconosciuti o della società 11003, anche non ancora nell'app),
      poi le "Categorie" (conteggio atleti e nostri); aprendo una categoria (`?categoria=`) si vede la sua
      classifica: posizione o DNF, nome ("Rossi Mario": il PDF scrive il cognome in maiuscolo), totale, società,
      punteggi per parziale o per prova ("272 (25 m) + 378 (18 m)") e conteggi con i nomi delle colonne della
      gara ("10: 21 · 9: 26", "10+X: 13 · X: 3"). Gli atleti della compagnia sono evidenziati con bordo e
      grassetto e con "Della compagnia:" per i lettori di schermo (non solo il colore). Avviso "Risultati
      provvisori" finché la gara non è omologata. Logica pura in `packages/shared/src/risultati.ts`;
   4. notifiche push "nuovo invito" ✅ (migrazione `20261110120000_notifiche_push.sql`). Note:
      - tabelle `iscrizioni_push` (un telefono per riga, chiave = `endpoint`) e `notifiche` (coda, una per
        gara); nessun permesso diretto a chi usa l'app: il telefono si registra o si toglie con le funzioni
        `registra_push` e `rimuovi_push` (se sul telefono entra un'altra persona la registrazione passa a
        lei; all'uscita dall'app il telefono viene tolto);
      - il motore (`invito()`) accoda la notifica con `vaNotificato`; l'invio (`inviaNotifiche`, in
        `_shared/aggiornamento/notifiche.ts`) parte alla fine di ogni giro di `aggiorna-fitarco`: nessun cron
        nuovo, il Worker dei 15 minuti basta. Nessun telefono registrato → la notifica si chiude; consegna
        fallita per tutti → riprova (per 2 giorni); telefono scaduto (404/410) → registrazione cancellata;
      - invio con `web-push` (`aggiorna-fitarco/push.ts`): segreti `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` su
        Supabase, `VITE_VAPID_PUBLIC_KEY` su Cloudflare Pages (vedi `supabase/README.md`). Senza chiavi le
        notifiche restano in coda e l'interruttore dice "non può ricevere";
      - app: `apps/web/src/notifiche/` (regole in `servizio.ts`, browser vero in `browser.ts`), interruttore
        in Impostazioni; il service worker carica `apps/web/public/push.js` (`importScripts`), che mostra la
        notifica e apre la gara al tocco. Il test dei permessi (pgTAP) gira solo su GitHub (serve Docker).
4. **Tab Atleti**, due PR (piano approvato il 10/11/2026):
   1. elenco, scheda con record e storico ✅. Note:
      - elenco (`pagine/Atleti.tsx`): gli atleti **attivi con l'accesso** (link generato, anche se non sono ancora
        entrati: Mattia 10/11/2026), tu in cima con "Tu", poi per cognome; sotto il nome "Ricurvo · ultima gara
        31 ott". Il telefono sa chi ha il link grazie a `atleti.ha_accesso` (colonna calcolata da `utente_id`,
        migrazione `20261110130000`; `utente_id` non esce dal server);
      - scheda (`pagine/SchedaAtleta.tsx`, `/atleti/:id`): "Record personali" e "Storico gare"; logica pura in
        `packages/shared/src/atleti.ts`;
      - **record per prova, arco e distanza vera**: dai PDF (colonne "70m-1", "60m-1"…) con le gare composte
        divise in prove; per le gare vecchie senza PDF solo il totale e solo se la gara è a prova unica, con la
        distanza outdoor ricavata da divisione e classe (`distanzaOutdoor`: OL S/J 70, M/A 60, R 40, G 25; CO
        e AN/AI/LB S/J/M 50…; le combinazioni mai viste restano senza distanza e non contano). I DNF non
        contano; i **provvisori contano** con la scritta "provvisorio" (Mattia, 10/11/2026). Record a parità:
        il primo ottenuto. Indoor 25 m e outdoor 25 m (Giovanissimi) sono prove diverse (`indoor:25m` e
        `outdoor:25m`);
   2. andamento ✅ (`pagine/Andamento.tsx`, grafico in `componenti/GraficoAndamento.tsx`, logica in
      `packages/shared/src/andamento.ts`): nella scheda atleta, tra record e storico. Una **serie = una prova
      con un arco** (mai due prove o due archi nello stesso grafico: un solo asse, UI Top); si sceglie con i
      pulsanti "Prova e arco" (compaiono solo con più serie); serve almeno **due punteggi**, altrimenti la
      sezione non c'è. Tutta la carriera. Il punto si sceglie con tocco o tastiera e la sua descrizione
      compare sotto il grafico (di base l'ultimo); i **provvisori** hanno il punto vuoto e la scritta;
      "Mostra come tabella" dà gli stessi dati per chi non vede il grafico. "Media per anno" = anno
      solare, un decimale. Colori: `chart-1` per la linea, `chart-grid` per la griglia, testo sempre nei
      colori del testo (mai nel colore della serie).
5. **Tab Classifica**, due PR (piano approvato il 10/11/2026):
   1. server ✅: tabella `classifiche_ranking` (una riga per classifica, con tutte le righe in `righe`, `letta_il` e
      `aggiornato_il`; i membri leggono, scrive solo `salva_classifica_ranking`), migrazione `20261110140000`.
      Lettura nazionale (`richiestaRanking` senza comitato); `ranking` è ora una lettura **pesante** (una per
      giro, cioè ogni 15 minuti: il lunedì le classifiche partono una alla volta); pianificazione in
      `_shared/aggiornamento/classifica.ts` (nostre mancanti subito, lunedì dalle 10 anche quelle già scaricate);
      sentinella `controllaRanking` (i conti devono tornare con "Numero totale", niente classifica vuota o
      dimezzata); funzione `aggiorna-classifica` per il pulsante (solo membri, **6 ore** per la stessa classifica,
      tetto di 10 letture all'ora per tutti, pausa se Fitarco non risponde; risposte 200/400/403/429/502/503
      con `riprovaDopo`). Una combinazione senza atleti si salva vuota. Pubblicazione:
      `npx supabase functions deploy aggiorna-classifica --use-api` e `… aggiorna-fitarco …`.
      **La tabella `ranking` e `salva_ranking` restano** (vuote, inutilizzate): i telefoni con la versione vecchia
      dell'app le chiedono ancora; si tolgono in una migrazione successiva, insieme alla sincronizzazione
      di `ranking` nell'app;
   2. app: da fare (scheda "La tua posizione", filtri, classifica completa, offline).
6. **Tab Allenamento**: settimana, diario, poi segnapunti.
7. **In futuro**: smartwatch (servirebbe un'app nativa: valutare Capacitor sulla stessa web app).

## Design system

L'interfaccia segue il design system **"UI Top"**, salvato come artefatto nell'account di Mattia:
https://claude.ai/artifact/BEUsaG1jRRShkG7r6DdHXN (all'interno si chiama "UI Constitution": è la stessa cosa).

Se non riesci ad aprirlo, chiedi a Mattia di esportarne token e linee guida (sezione *Files*) nella repo
sotto `design-system/`. Punti chiave da rispettare:
- Una schermata = un compito; mostrare solo l'informazione che serve ora, il resto nel dettaglio.
- Ordine di priorità: comprensione, accessibilità, efficienza, gerarchia, continuità degli stati, identità, rifinitura, decorazione.
- Temi: **chiaro, scuro e alto contrasto** (utile al sole sul campo), scelta manuale nelle impostazioni.
  Usare i **ruoli dei token**, mai colori fissi. I colori del bersaglio diventano token del progetto (`target-*`).
- Testo con contrasto 4.5:1 (3:1 testo grande, bordi e icone); target touch comodi (`control-touch`, 48 px).
- Inserimento ripetitivo pensato per la velocità: vedi il componente `RapidEntry` (→ segnapunti).
- Grafici: mai due assi di valori; serie `chart-1`…`chart-5` etichettate direttamente.

## Come lavorare

- Prima di modifiche grandi, proponi un piano breve e aspetta l'ok. Niente codice senza il via di Mattia.
- Commit piccoli, messaggi in italiano. Non pushare segreti o dati personali (niente matricole o risultati nella repo).
- Ambiente di Mattia: Windows, app desktop Claude (scheda Code), Git e Node.js LTS installati; prova l'app sul
  telefono aprendo un link (stessa rete Wi-Fi del PC durante lo sviluppo).
