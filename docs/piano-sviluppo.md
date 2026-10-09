# Piano di sviluppo

Workspace e decisioni di prodotto sono avviati; procedere per vertical slice fino a soddisfare la [Definition of Done](../dod/README.md).

La consegna è prevista entro l'8 novembre 2026. La pianificazione dovrà riservare tempo anche a stabilità, documentazione e preparazione della presentazione, che fanno parte della valutazione.

## Fase 0 - Chiarire le decisioni bloccanti

- Ricontrollare le ultime versioni stabili dello stack documentate nei requisiti e fissarle nel lockfile Bun.
- Tradurre le [decisioni adottate](decisioni-e-domande.md) nello schema SQLite versionato e nel contratto delle API REST.
- Creare workspace Bun con frontend, backend e contratti condivisi.
- Definire `.env.example`, CORS locale, directory file e creazione iniziale dell'admin.
- Configurare `bun:test` e Supertest per le API, Vitest e React Testing Library per l’interfaccia.

**Uscita:** stack e regole principali fissati; ambiente locale avviabile.

## Fase 1 - Fondamenta applicative e account

- Creare struttura TypeScript per frontend React e backend Express, configurazione locale e accesso SQLite tramite `bun:sqlite`.
- Definire `package.json`, script Bun e convenzioni per aggiungere/aggiornare dipendenze TypeScript; Bun è la scelta definitiva e il requisito relativo a npm è intenzionalmente trascurato.
- Configurare gli strumenti di test scelti dopo aver definito la struttura effettiva di frontend e backend.
- Implementare validazione input, gestione errori e logging essenziali.
- Implementare registrazione, login, logout e protezione JWT.
- Introdurre ruoli e controlli di autorizzazione lato API.

**Dipendenza:** stack e schema iniziale definiti.

## Fase 2 - Progetti e membership

- Creare, leggere, modificare, archiviare e cancellare progetti secondo le regole concordate.
- Implementare visibilità pubblica/privata e controllo del proprietario.
- Implementare inviti, accettazione e rimozione membri.
- Salvare categoria, tecnologie e percorso locale del file copertina.

**Dipendenza:** account e autorizzazioni.

## Fase 3 - Task, bacheca e dashboard

- Implementare creazione e modifica task con priorità, stato, scadenza e assegnatario.
- Impedire assegnazioni a non membri e applicare i permessi sul progetto.
- Implementare spostamento tra i tre stati della bacheca.
- Costruire la dashboard con progetti e task assegnati ordinati per scadenza.

**Dipendenza:** progetti e membership.

## Fase 4 - Catalogo pubblico

- Esporre solo progetti pubblici e non nascosti.
- Implementare filtri per categoria, tecnologia e data di creazione.
- Definire paginazione e ordinamento come dettagli di prodotto.

**Dipendenza:** progetti e metadati.

## Fase 5 - Chat e aggiornamenti live

- Implementare chat di progetto con storico e controllo accessi.
- Aggiungere eventi Socket.IO per creazione, modifica e spostamento task.
- Aggiungere notifiche per assegnazioni e ingresso di nuovi membri.
- Implementare schema e destinatari degli eventi secondo le decisioni e i casi in `tests/`.

**Dipendenza:** membership, task e protocollo live scelto.

## Fase 6 - Segnalazioni e strumenti admin

- Implementare invio e consultazione delle segnalazioni.
- Implementare moderazione dei progetti e blocco utenti.
- Inviare notifiche live agli admin sulle nuove segnalazioni.
- Verificare i permessi admin e registrare revisore, esito e date nel flusso di segnalazione; non è previsto un audit log separato.

**Dipendenza:** account, progetti e flusso segnalazioni definito.

## Fase 7 - Consegna e funzionalità opzionali

- Preparare collection Postman con variabili, esempi e flussi completi.
- Documentare avvio, configurazione, API e account/ruoli necessari.
- Preparare una breve spiegazione di architettura, struttura del codice, dipendenze e scelte implementative.
- Controllare i codici HTTP e i messaggi restituiti nei principali casi di errore.
- Implementare i casi iniziali di test per backend e frontend documentati in `tests/`, scegliendo un framework compatibile con l'architettura effettiva.
- Verificare i criteri di accettazione concordati e i casi senza permesso.
- Implementare recupero password via email.
- Documentare e verificare l'avvio locale di frontend, backend e servizi necessari.

## Priorità suggerita

| Priorità | Feature | Motivo |
| --- | --- | --- |
| 1 | Stack, schema dati e ambiente | Riduce decisioni che potrebbero causare rifacimenti |
| 2 | Account, JWT e autorizzazioni | Base per tutte le funzioni protette |
| 3 | Progetti e membership | Contesto necessario per task, chat e permessi |
| 4 | Task, bacheca e dashboard | Flusso centrale di gestione del lavoro |
| 5 | Catalogo pubblico e filtri | Riusa i progetti e i loro metadati |
| 6 | Chat, eventi live e notifiche | Richiede membership e flussi dati già solidi |
| 7 | Segnalazioni e pannello admin | Dipende da utenti, progetti e moderazione definita |
| 8 | Recupero password e configurazione locale | Recupero password richiesto; consegna eseguita in locale |

## Prima milestone verificabile

Un utente si registra e accede, crea un progetto privato, invita un membro, crea un task e lo assegna a quel membro. Le API rifiutano accessi da utenti esterni al progetto. Questa milestone esercita le dipendenze principali prima di aggiungere catalogo, chat e aggiornamenti live.
