# App Arco — istruzioni per Claude

App per il tiro con l'arco, per Android e iOS. Proprietario: Mattia (repo `mattiafili94/App_Arco`).
Lingua di lavoro: **italiano** (testi dell'app, commenti, messaggi di commit).

## Obiettivo

Un'app sul telefono che:
1. aiuta l'**allenamento quotidiano** (segnapunti, statistiche, materiale, diario);
2. mostra il **calendario gare Fitarco** e avvisa delle gare di interesse;
3. più avanti, mostra **risultati, profilo atleta e ranking** presi dalle pagine pubbliche Fitarco.

## Decisioni prese (brainstorming del 7/11/2026)

- **Tecnologia:** Expo (React Native) + **TypeScript**. Un solo codice per Android e iOS.
  - Sviluppo con **Expo Go** sul telefono (QR code, stessa rete Wi-Fi del PC).
  - Build con **EAS Build** (cloud, non serve un Mac). Correzioni JS con **EAS Update** (OTA).
  - Dati salvati **sul telefono** (es. SQLite), l'app deve funzionare **offline** (al campo spesso non c'è rete).
- **Struttura repo (monorepo):**
  ```
  apps/mobile/        ← app Expo
  packages/shared/    ← tipi e logica comune (punteggi, round, statistiche)
  services/fitarco/   ← (solo se servirà) lettore delle pagine Fitarco
  ```
- **Dati Fitarco:** non esiste un'API pubblica. Si leggono le **pagine pubbliche** (calendario, risultati, ranking).
  - All'inizio la lettura avviene **dentro l'app**, su richiesta dell'utente, con copia locale. Se il sito cambia, si corregge con un aggiornamento OTA.
  - **Niente GitHub Actions** per leggere il sito (condizioni GitHub in zona grigia, workflow programmati disattivati dopo 60 giorni di inattività nelle repo pubbliche).
  - Un server vero (funzioni programmate tipo Cloudflare Workers / Supabase) **solo se** servono più utenti, notifiche automatiche, o se le pagine richiedono un browser automatico (Playwright).
  - Regole: leggere poco e di rado, con cache; prima verificare condizioni d'uso del sito e `robots.txt`; prendere solo i dati necessari; i risultati contengono nomi di atleti → **non pubblicarli** (repo privata, nessun dump pubblico).
  - Il calendario definitivo esce anche come circolare PDF annuale: possibile fonte alternativa.
- **Accesso all'area riservata Fitarco (credenziali tesserato): escluso.**

## Ordine di lavoro

1. **Fase 1 — Allenamento offline** (nessuna dipendenza da Fitarco):
   - segnapunti per volée toccando il bersaglio (punteggio + posizione della freccia);
   - round predefiniti (18 m indoor, 70 m olimpico, 50 m compound, campagna) e sessioni libere;
   - statistiche: media per freccia, X/10, raggruppamento, andamento, confronto allenamento/gara;
   - timer della volée; scheda materiale con tacche del mirino per distanza; diario.
2. **Fase 2 — Esplorazione tecnica del sito Fitarco**: capire da dove arrivano i dati del calendario
   (`https://www.fitarco.it/gare-e-risultati/calendario.html` si carica in modo dinamico), se c'è una
   richiesta JSON interna o serve un browser automatico. Definire il formato JSON di una gara.
3. **Fase 3 — Calendario gare** in sola lettura: filtri (regione, tipo, divisione), preferite,
   aggiunta al calendario del telefono, promemoria.
4. **Fase 4 — Risultati, profilo atleta, ranking.**

## Design system

L'interfaccia segue il design system **UI Constitution** ("UI Top"), salvato come artefatto nell'account
di Mattia: https://claude.ai/artifact/BEUsaG1jRRShkG7r6DdHXN

Se non riesci ad aprirlo, chiedi a Mattia di esportarne token e linee guida (sezione *Files*) nella repo
sotto `design-system/`. Punti chiave da rispettare:
- Una schermata = un compito; mostrare solo l'informazione che serve ora, il resto nel dettaglio.
- Ordine di priorità: comprensione, accessibilità, efficienza, gerarchia, continuità degli stati, identità, rifinitura, decorazione.
- Temi: **chiaro, scuro e alto contrasto** (utile al sole sul campo). Usare i **ruoli dei token**, mai colori fissi.
- Testo con contrasto 4.5:1 (3:1 testo grande, bordi e icone); target touch comodi (`control-touch`).
- Inserimento ripetitivo pensato per la velocità: vedi il componente `RapidEntry` (→ segnapunti).
- Grafici: mai due assi di valori; serie `chart-1`…`chart-5` etichettate direttamente.
- Esistono layout per smartwatch (`WatchLayouts`), da valutare più avanti.

## Come lavorare

- Prima di modifiche grandi, proponi un piano breve e aspetta l'ok.
- Commit piccoli, messaggi in italiano. Non pushare segreti o dati personali.
- Ambiente di Mattia: Windows, app desktop Claude (scheda Code), telefono con Expo Go.
