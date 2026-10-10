# TaskFlow API — Postman

## Avvio locale

1. Dalla radice esegui `bun install`, `bun run seed:demo` e `bun run dev`.
2. Importa `TaskFlow.postman_collection.json` e `TaskFlow.postman_environment.json` in Postman e seleziona l'ambiente **TaskFlow local demo**.
3. In `01 — Accesso`, esegui `Login Ada demo`; poi `Login Luca demo` e `Login admin demo` per salvare i token degli altri ruoli.
4. Esegui `Dashboard e progetti`: salva automaticamente l'ID del progetto demo privato e del progetto pubblico nel catalogo.
5. Usa le cartelle successive per board, filtri, inviti, chat e moderazione. Le richieste usano i token e gli ID salvati nell'ambiente.

Base URL iniziale: `http://localhost:3001/api/v1`. Puoi cambiarlo nell'ambiente se la porta API è diversa.

La collection contiene anche richieste mutative o distruttive (rimozione membri, trasferimento proprietà, archiviazione ed eliminazione). Esegui solo la richiesta che vuoi provare: la sequenza completa non è pensata per il Runner perché alcune operazioni cambiano i permessi e cancellano risorse.

## File allegati di esempio

Nella richiesta `Invia messaggio con più allegati`, seleziona per entrambi i campi `files` i file `samples/nota-demo.txt` e `samples/piano-demo.txt`. Se Postman non risolve i percorsi importati, usa il selettore file indicando questi percorsi dentro la cartella `postman/`.

Nella richiesta `Carica copertina`, seleziona `samples/copertina-demo.png`.

Per provare i limiti, invia più di cinque allegati: l'API risponde `422`. Un `.txt` maggiore di 1 MiB o qualsiasi file maggiore di 5 MiB risponde `413`. In tutti questi casi il messaggio e gli allegati vengono rifiutati senza lasciare file orfani.

## Credenziali demo locali

`bun run seed:demo` crea account esclusivamente fittizi con dominio riservato `.test`:

| Ruolo | Email | Password |
| --- | --- | --- |
| Proprietaria | `ada.demo@example.test` | `TaskflowDemo-Ada-2026` |
| Membro | `luca.demo@example.test` | `TaskflowDemo-Luca-2026` |
| Amministratrice | `admin.demo@example.test` | `TaskflowDemo-Admin-2026` |

Il seed è per database locali di sviluppo. Non usare questi account in ambienti condivisi o di produzione.

Il recupero password e le email d'invito restano simulate: i link si leggono nel terminale API.
