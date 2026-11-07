# Design system del progetto

L'interfaccia segue il design system **"UI Top"** (all'interno si chiama "UI Constitution"):
https://claude.ai/artifact/BEUsaG1jRRShkG7r6DdHXN

## File

| File | Cosa contiene | Si modifica? |
|---|---|---|
| `tokens.json` | copia dei token di UI Top (ruoli e valori predefiniti) | **no**: si sostituisce con una copia nuova quando UI Top cambia |
| `progetto.json` | i valori nostri: blu società, colori del bersaglio | sì |
| `glossario.md` | una parola per ogni concetto, da usare in tutta l'app | sì |

Il file usato dall'app è `apps/web/src/styles/tokens.css`: è **generato**, non si modifica a mano.
Dopo ogni modifica a `tokens.json` o `progetto.json`:

```bash
npm run tokens
```

Il controllo su GitHub fallisce se `tokens.css` non è aggiornato, se un colore di testo non ha abbastanza
contrasto in uno dei tre temi, o se nel codice compare un colore scritto a mano fuori dai token.

## Identità del prodotto

```text
Product character: strumento della compagnia per seguire gare, risultati e allenamento; sobrio, preciso, leggibile all'aperto
Density: balanced (elenchi di gare e risultati; i punteggi hanno spazio)
Geometry: precise
Accent behavior: functional (il blu società solo per azione principale, selezione, focus e stato "iscrizioni aperte")
Motion character: precise
Primary domain pattern: elenco cronologico di gare e risultati; inserimento rapido dei punteggi (RapidEntry)
Distinctive visual behavior: punteggi in cifre tabellari grandi; il bersaglio è l'unico elemento grafico di dominio
```

Colori della società: blu, rosso e bianco. Il **blu** è il colore principale (`accent-*`); il **rosso** non è
usato come colore dell'interfaccia perché nel design system significa "errore"; il **bianco** è lo sfondo del
tema chiaro.

## Icone del progetto

Famiglia Lucide, contorno, come da tabella "un concetto = un'icona" di UI Top. Concetti propri del progetto:

| Concetto | Icona |
|---|---|
| Gare (calendario) | `calendar` |
| Atleti | `users` |
| Classifica | `trophy` |
| Allenamento | `target` |
| Impostazioni | `settings` |
| Offline (riga di stato) | `wifi-off` |
| Nuova versione pronta | `refresh-cw` |
