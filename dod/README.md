# TaskFlow MVP — Definition of Done

## Prodotto

TaskFlow è un’app locale, in italiano, per organizzare il lavoro di gruppo. La vista principale è una board scura ispirata a GitHub Projects: tre colonne (`Da fare`, `In corso`, `Completato`), schede compatte, ricerca e filtri. L’interfaccia deve funzionare con mouse, tastiera e viewport desktop e mobile.

## Cosa deve offrire l’MVP

- Registrazione, accesso, uscita e recupero password con email simulata nel terminale.
- Creazione di progetti pubblici o privati, catalogo, modifica, copertina, archiviazione, riattivazione ed eliminazione.
- Inviti a membri tramite email o link condivisibile e revocabile; il mock email stampa destinatario e link nel terminale. L’accettazione è esplicita, i membri sono gestibili e il trasferimento della proprietà richiede l’accettazione del nuovo proprietario.
- Board con le tre colonne, task con descrizione, priorità, scadenza e assegnatario; creazione, modifica, spostamento e cancellazione secondo i permessi.
- Chat di progetto persistente, con allegati locali ammessi e download protetto.
- Segnalazione di progetti e area admin essenziale per esaminare segnalazioni, nascondere/ripristinare progetti e bloccare/sbloccare account.
- Aggiornamenti in tempo reale per task, chat, membership e nuove segnalazioni; dopo una riconnessione i dati si riallineano dal server.
- SQLite integrato come persistenza locale dell’MVP; nessun servizio esterno necessario. Il seed admin è esplicito e chiede credenziali.

## Come avviare

1. Installare Bun 1.4 o successivo.
2. Dalla radice del repository, eseguire `bun install`.
3. Eseguire `bun run seed:admin` per creare l’account amministratore iniziale.
4. Avviare l’app con `bun run dev`.
5. Aprire `http://localhost:5173`. Database e file vengono creati in `data/` e `uploads/`.

In sviluppo il mock email stampa link di invito e recupero password nel terminale API. Nessuna email viene spedita.

## Flusso dimostrativo completo

1. Creare un account utente e accedere.
2. Creare un progetto e aprirne la board.
3. Creare un task, assegnare priorità e scadenza, quindi spostarlo tra le tre colonne.
4. Invitare un secondo account con il link mostrato; accettarlo e vedere lo stesso progetto.
5. Inviare un messaggio e un allegato; verificare aggiornamenti live in due sessioni browser.
6. Segnalare il progetto, accedere come admin e gestire la segnalazione.
7. Archiviare e riattivare il progetto da proprietario; cancellarlo solo come ultimo passaggio della demo.

## Definition of Done tecnica

- Un clone pulito può essere installato e avviato seguendo i comandi sopra, senza MySQL, Docker, account o servizi cloud.
- API e interfaccia persistono i dati in SQLite; autorizzazione e validazione sono applicate dal backend.
- Le funzioni elencate sono raggiungibili dall’interfaccia e hanno almeno un test automatico nel relativo livello; i flussi critici hanno test API su database temporaneo.
- `bun run typecheck`, `bun run test` e `bun run build` terminano senza errori.
- Gli upload sono limitati per formato e dimensione, conservati con nomi generati e scaricabili solo da chi è autorizzato.
- Non sono committati segreti, database locali o file caricati.
- Le schermate principali includono stati vuoti, caricamento ed errore; il layout resta usabile su schermi stretti.

## Fuori dall’MVP

Hosting remoto, invio email reale, pagamenti, importazioni, workflow configurabili, audit log avanzato e applicazione mobile nativa.
