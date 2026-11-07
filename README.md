# App Arco — Arcieri Eugubini

Web app installabile (PWA) per la A.S.D. Compagnia Arcieri Eugubini: calendario gare dell'Umbria,
risultati, record e classifiche presi da Fitarco, e un'area allenamento personale.

**L'app: https://arcieri-eugubini.pages.dev** (pubblicata da Cloudflare Pages a ogni unione in `main`;
ogni pull request ha un suo indirizzo di anteprima).

Decisioni, piano di lavoro e design system sono in [CLAUDE.md](CLAUDE.md).

## Installarla sul telefono

- **Android (Chrome)**: apri l'indirizzo, menu ⋮ → **Installa app** (o "Aggiungi a schermata Home").
- **iPhone (Safari)**: apri l'indirizzo, tasto **Condividi** → **Aggiungi alla schermata Home**.

## Struttura

```
apps/web/          ← la web app (React + TypeScript + Vite)
packages/shared/   ← tipi e logica comune (tipologie di gara, prove, record)
packages/tokens/   ← genera i token del design system e ne controlla contrasti e uso
design-system/     ← token di UI Top, valori del progetto, glossario
supabase/          ← (in arrivo) database e funzioni del server
```

## Comandi

Serve Node.js 22.12 o più recente. Dalla cartella del progetto:

| Comando | Cosa fa |
|---|---|
| `npm install` | scarica le dipendenze (la prima volta e quando cambiano) |
| `npm run dev` | avvia l'app in sviluppo; l'indirizzo "Network" si apre anche dal telefono sullo stesso Wi-Fi |
| `npm test` | esegue i test automatici |
| `npm run test:coverage` | test + quanta parte del codice è coperta (soglia 90% sulla logica condivisa) |
| `npm run check` | tutti i controlli: formattazione, lint, tipi e test con copertura (gli stessi che GitHub esegue a ogni PR) |
| `npm run test:e2e` | test nel browser vero (Playwright): percorsi, offline, accessibilità |
| `npm run tokens` | rigenera i colori e le misure dell'app dopo una modifica in `design-system/` |
| `npm run format` | sistema la formattazione del codice |
| `npm run build` | prepara la versione da pubblicare |
