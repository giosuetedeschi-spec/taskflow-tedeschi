# Requisiti e specifiche iniziali

## 1. Obiettivo

TaskFlow è una piattaforma collaborativa per gestire progetti di gruppo. Un utente può organizzare il lavoro in task, collaborare con i membri del progetto e comunicare nella chat. I progetti pubblici possono essere esplorati da un catalogo; gli amministratori moderano contenuti, utenti e segnalazioni.

## 2. Prova e criteri di valutazione

- **Consegna entro:** 8 novembre 2026.
- **Durata:** intero percorso.
- **Obiettivo didattico:** dimostrare competenze nello sviluppo di applicazioni Node.js, nella struttura del progetto, nell'uso di npm e delle dipendenze, nella realizzazione di API REST o funzionalità server-side, nell'eventuale integrazione con database, nelle buone pratiche e nella documentazione e spiegazione delle scelte.
- **Consegna tecnica:** applicazione Node.js con `package.json`, dipendenze gestite, endpoint REST per le risorse, database per memorizzare e recuperare i dati e gestione degli errori con codici HTTP appropriati.

La valutazione considera correttezza funzionale, qualità e organizzazione del codice, gestione di risorse/dipendenze/ambiente, gestione degli errori e stabilità, e capacità di presentare e discutere architettura e scelte tecniche.

## 3. Tecnologie e dipendenze

### Indicate dalla traccia

| Area | Indicazione | Stato |
| --- | --- | --- |
| Runtime | Node.js | Richiesto dalla traccia didattica |
| Backend | Express | Scelto |
| Frontend | React | Scelto |
| Toolchain e package manager | Bun | Scelto per lo sviluppo |
| Linguaggio | TypeScript | Scelto per lo sviluppo |
| Interfaccia API | API REST | Richiesta |
| Autenticazione | JWT | Richiesta |
| Database | MySQL | Scelto |
| ORM/accesso dati | Sequelize | Scelto per la comunicazione con MySQL |
| Aggiornamenti live | Socket.IO, con trasporto WebSocket | Scelto; il protocollo applicativo Socket.IO è distinto dal WebSocket standard |
| Email | Inviti e recupero password | Richiesti dalla scelta di progetto |
| Test manuale API | Collection Postman | Richiesta per la consegna |
| Pacchettizzazione | `package.json` e npm | `package.json` resta previsto; npm è ignorato per ora e si usa Bun |
| Persistenza | MySQL tramite Sequelize | Richiesta nella descrizione della consegna; tecnologie scelte |
| Errori HTTP | Gestione errori e codici di risposta appropriati | Richiesta nella descrizione della consegna |

### Scelte ancora da fare

- Schema relazionale, strategia di migrazione e configurazione Sequelize.
- Nomi degli eventi e schema preciso dei payload JSON Socket.IO.
- Gestione delle immagini di copertina e servizio di archiviazione.
- Servizio email per inviare inviti e procedure di recupero password.
- Librerie per validazione e logging.
- Sistema operativo e procedura di avvio locale.

Queste scelte influenzano dipendenze, comandi e requisiti esatti dell'ambiente. Non sono fissate qui senza una decisione di progetto.

### Versioni stabili

La regola scelta è usare l'ultima versione stabile compatibile disponibile quando si inizializza il progetto, evitando release alpha, beta, release candidate e nightly. Per rendere l'ambiente riproducibile, Bun dovrà salvare le versioni risolte nel lockfile; gli aggiornamenti successivi si applicano in modo esplicito e si ricontrolla la compatibilità.

Rilevazione del **8 ottobre 2026** per i componenti principali:

| Componente | Versione stabile rilevata | Nota |
| --- | --- | --- |
| Node.js | [24.21.0 LTS](https://nodejs.org/en/download/archive/v24.21.0) | Scelta per la consegna; 26.11.1 è la linea Current, più nuova ma non LTS |
| Bun | [1.4.2](https://bun.sh/blog/bun-v1.4.2) | Toolchain e package manager |
| React | [19.3.0](https://react.dev/versions) | Release stabile corrente |
| TypeScript | [7.0.2](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) | Release stabile corrente |
| Express | [5.2.1](https://github.com/expressjs/express/releases/tag/v5.2.1) | Release stabile corrente |
| Sequelize | [6.37.8](https://github.com/sequelize/sequelize/releases/tag/v6.37.8) | Ultima linea stabile; Sequelize 7 è ancora alpha |
| MySQL | [8.4.11 LTS](https://dev.mysql.com/doc/relnotes/mysql/8.4/en/news-8-4-11.html) | Scelto; rientra nella linea MySQL 8 supportata da Sequelize 6 |
| Socket.IO | [4.8.4](https://github.com/socketio/socket.io/releases) | Scelto per server Express e client React |

Qui “stabile” significa una release ufficiale non prerelease. Node.js e MySQL hanno anche linee con cicli diversi: per il progetto scegliamo le rispettive linee LTS, mentre per le librerie usiamo la release stabile più recente (per Sequelize, la 6.37.8 perché la 7 è alpha). Queste versioni sono uno snapshot, non numeri da aggiornare automaticamente: si ricontrollano all'avvio dell'implementazione e si fissano nel lockfile. Le dipendenze accessorie e i tipi TypeScript si scelgono allora tra release stabili compatibili con questo stack.

**Compatibilità MySQL/Sequelize:** abbiamo scelto MySQL 8.4.11 LTS con Sequelize 6.37.8. La matrice Sequelize 6 dichiara supporto per MySQL 5.7 e 8.x, ma non per 9.x; Sequelize 7 è ancora alpha. Questa combinazione privilegia una compatibilità dichiarata e release stabili. ([matrice Sequelize](https://sequelize.org/releases/))

**Nota TypeScript:** la 7.0.2 è stabile, ma al momento non espone ancora l'API del compilatore usata da alcuni strumenti e plugin; prima di fissarla vanno controllati gli strumenti frontend scelti. Se uno di questi richiede l'API, TypeScript 6 può essere necessario per quella parte. ([annuncio ufficiale TypeScript 7](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/))

## Protocollo per gli aggiornamenti live

È stato scelto Socket.IO 4.8.4 per il server Express e il client React. Socket.IO usa WebSocket come trasporto quando possibile, ma definisce un proprio protocollo con eventi, riconnessione e fallback: non è interoperabile direttamente con un client WebSocket standard. Le alternative sono riportate per motivare la scelta:

- **Socket.IO:** eventi nominati, stanze server-side, riconnessione automatica, acknowledgements e tipi TypeScript; riduce il codice infrastrutturale per chat e broadcast a gruppi. Aggiunge il protocollo Socket.IO e il relativo client `socket.io-client`.
- **`ws`:** implementa WebSocket standard ([RFC 6455](https://datatracker.ietf.org/doc/html/rfc6455)). Il browser usa la propria API WebSocket; sul server Express `ws` offre un livello più diretto, ma stanze, reconnessione, acknowledgements e routing applicativo sono responsabilità del progetto.
- **Server-Sent Events (SSE):** connessione persistente dal server al browser ([standard WHATWG](https://html.spec.whatwg.org/multipage/server-sent-events.html)), quindi adatta a notifiche e aggiornamenti della bacheca. Il browser invia messaggi o comandi separatamente tramite API REST. Semplifica il flusso unidirezionale, ma per la chat occorre combinare SSE e REST.
- **Polling:** il browser interroga periodicamente le API. È semplice da realizzare, ma gli aggiornamenti arrivano con ritardo e generano richieste ripetute; non è la prima scelta per una chat in tempo reale.

Per TaskFlow Socket.IO copre chat, aggiornamenti della bacheca e notifiche. I dati restano persistenti in MySQL; il canale live trasporta gli eventi, non sostituisce il database. Il server deve autenticare la connessione e verificare l'appartenenza al progetto prima di far entrare il socket nella stanza `project:<id>`.

**Formato eventi scelto:** eventi nominati con payload JSON; i nomi seguono la convenzione `risorsa.azione` (per esempio `task.created`). Come proposta per lo schema comune, ogni payload può includere `eventId`, `projectId`, `occurredAt` e `data`; elenco definitivo degli eventi e campi dei singoli payload restano da definire. REST resta il percorso per creare/modificare risorse: dopo il commit su MySQL, il server emette l'evento ai membri autorizzati. La consegna degli eventi persi durante una disconnessione non è garantita automaticamente; alla riconnessione il client rilegge lo stato via REST.

## 4. Requisiti funzionali

### 4.1 Account e autorizzazioni

- **R1 - Registrazione, accesso e uscita (Richiesto):** un utente può registrarsi, autenticarsi e terminare la sessione.
- **R2 - JWT (Richiesto):** le API che richiedono un'identità devono verificare il token.
- **R3 - Ruoli e permessi (Richiesto):**
  - Utente base: crea progetti, partecipa a progetti su invito, gestisce task e chat.
  - Proprietario: il creatore è l'unico proprietario del progetto; invita/rimuove membri, modifica e archivia il proprio progetto.
  - Amministratore: nasconde progetti segnalati e blocca utenti.
- **R4 - Recupero password (Richiesto):** invio via email di un link monouso valido per un'ora per impostare una nuova password.

### 4.2 Progetti e membri

- **R5 - Creazione progetto (Richiesto):** titolo, descrizione, categoria, tecnologie, visibilità pubblica/privata e immagine di copertina.
- **R6 - Manutenzione progetto (Richiesto):** il creatore può modificare, archiviare o cancellare definitivamente il progetto. La cancellazione elimina anche i dati collegati al progetto, ma non gli account degli utenti.
- **R7 - Membri (Richiesto):** il proprietario può invitare via email o tramite link; i link d'invito non scadono. Per diventare membro, l'invitato deve accettare esplicitamente l'invito.
- **R8 - Catalogo pubblico (Richiesto):** elenco dei progetti pubblici, filtrabile per categoria, tecnologia e data di creazione.
- **R9 - Segnalazioni e moderazione (Richiesto):** solo i membri del progetto possono segnalarlo. La traccia prevede strumenti admin per nascondere progetti segnalati e bloccare utenti; il flusso di revisione è da definire.

### 4.3 Task e dashboard

- **R10 - Task (Richiesto):** ogni task ha titolo, descrizione, priorità (bassa, media o alta) e stato; scadenza e assegnatario sono facoltativi.
- **R11 - Bacheca (Richiesto):** gli stati previsti sono Da fare, In corso e Completato; i task si possono spostare tra le colonne e riassegnare ai membri.
- **R12 - Dashboard personale (Richiesto):** mostra progetti creati, progetti di cui l'utente è membro e task assegnati ordinati per scadenza.

### 4.4 Chat, aggiornamenti e notifiche

- **R13 - Chat progetto (Richiesto):** ogni progetto ha una chat interna accessibile ai membri, con cronologia salvata e consultabile, messaggi testuali e allegati `.txt` (massimo 1 MB), `.png`, `.jpg` e `.pdf` (massimo 5 MB ciascuno). I file oltre il limite vengono rifiutati con errore HTTP 413. Dopo l'invio, i messaggi non possono essere modificati né cancellati.
- **R14 - Bacheca live (Richiesto):** i membri ricevono gli aggiornamenti quando un task viene creato, spostato o modificato.
- **R15 - Notifiche live (Richiesto):** avviso all'utente quando gli viene assegnato un task e quando un nuovo membro entra nel progetto; avviso agli admin quando un progetto viene segnalato.

### 4.5 API e consegna

- **R16 - API REST (Richiesto):** le funzionalità devono essere accessibili tramite API.
- **R17 - Autorizzazione (Richiesto):** gli endpoint applicano i permessi previsti da ruolo, proprietà e appartenenza al progetto.
- **R18 - Collection Postman (Richiesto):** consegnare una collection pronta a provare le funzionalità.

## 5. Specifiche operative proposte

Le seguenti regole rendono i requisiti più verificabili, ma vanno confermate prima di considerarle definitive:

- Un progetto privato non compare nel catalogo pubblico e non è leggibile da utenti esterni al progetto e dagli admin autorizzati.
- Solo i membri del progetto possono leggere la chat e la bacheca; solo il proprietario può gestire i membri e le impostazioni del progetto.
- Un task può essere senza assegnatario; se assegnato, l'utente deve essere un membro del progetto.
- La priorità di un task è bassa, media o alta.
- Gli inviti possono essere inviati via email o condivisi tramite link; i link non hanno scadenza e l'invitato deve accettare esplicitamente prima di diventare membro.
- Solo i membri di un progetto possono inviarne una segnalazione.
- La scadenza di un task è facoltativa. La dashboard ordina i task assegnati per scadenza crescente; quelli senza scadenza vengono mostrati dopo quelli con scadenza.
- L'archiviazione conserva il progetto senza mostrarlo come attivo. La cancellazione è definitiva ed elimina membership, task e messaggi collegati; gli account degli utenti restano.
- Le notifiche sono solo live e non vengono salvate né rese consultabili dopo la disconnessione.
- Le operazioni di moderazione e i cambi di stato devono essere verificati anche lato server, non solo nascosti nell'interfaccia.
- Non è previsto un audit log dedicato alle azioni amministrative; la segnalazione conserva comunque il revisore e le date necessarie al proprio flusso.

## 6. Entità dati iniziali

Modello concettuale pensato per essere tradotto in tabelle relazionali MySQL tramite Sequelize:

- **Utente:** identificativo, email, credenziale protetta, profilo, stato (attivo/bloccato), ruolo amministrativo.
- **Progetto:** identificativo, proprietario, titolo, descrizione, categoria, tecnologie, visibilità, copertina, stato (attivo/archiviato/nascosto), date.
- **Membership/Invito:** progetto, utente invitato o membro, stato (invito in attesa o membership attiva) e date. L'invito diventa membership attiva solo dopo accettazione esplicita. Ogni progetto ha un solo proprietario: il creatore.
- **Task:** progetto, titolo, descrizione, scadenza facoltativa, priorità, stato, assegnatario facoltativo, autore, date.
- **Messaggio:** progetto, autore, contenuto testuale e/o riferimenti agli allegati ammessi (`.txt`, `.png`, `.jpg`, `.pdf`), data; la cronologia è persistente e consultabile, e i messaggi sono immutabili dopo l'invio.
- **Segnalazione:** progetto, segnalante membro del progetto, categoria di motivazione (spam, contenuto inappropriato o illegale, violazione di proprietà intellettuale, informazioni ingannevoli, altro), stato di revisione (in attesa, accolta o respinta), admin revisore e date.

La struttura è una proposta di analisi; attributi e vincoli precisi dipendono dalle decisioni aperte.

## 7. Dipendenze tra componenti

1. Account e autorizzazioni sono prerequisiti per le operazioni protette.
2. Progetti e membership sono prerequisiti per task, chat, dashboard di progetto e autorizzazioni contestuali.
3. Task e assegnazioni sono prerequisiti per bacheca, dashboard task e notifiche di assegnazione.
4. Progetti pubblici e metadati sono prerequisiti per catalogo e filtri.
5. Progetti, utenti e segnalazioni sono prerequisiti per il pannello admin.
6. Le API costituiscono il contratto tra interfaccia, servizi live e persistenza; la collection Postman segue gli endpoint stabilizzati.

## 8. Requisiti d'ambiente

### Minimo per iniziare

- Sistema operativo locale: Windows.
- Node.js 24.21.0 LTS e Bun 1.4.2, rilevati l'8 ottobre 2026; ricontrollare all'avvio del progetto.
- Bun usato per installare dipendenze ed eseguire gli script di sviluppo; npm è ignorato per ora e si rivaluta solo se la consegna o il docente lo richiedono esplicitamente.
- TypeScript 7.0.2, React 19.3.0 ed Express 5.2.1 per il codice applicativo, secondo lo snapshot delle versioni stabili sopra.
- React per l'interfaccia, Express per le API e Sequelize per l'accesso a MySQL.
- Sequelize 6.37.8 con MySQL 8.4.11 LTS.
- Git per versionamento.
- File `.env` locale per configurazione e segreti, senza committarlo.
- Postman per importare e provare la collection di consegna.
- È prevista una suite di test automatizzati per backend e frontend; i casi iniziali sono in `tests/`. Il framework verrà scelto quando si imposta l'app e si conoscono le strutture effettive di frontend e backend.

### Da specificare prima dell'implementazione completa

- Sistema operativo e comandi standard di installazione/avvio per Node.js, Bun, MySQL e dipendenze applicative.
- Configurazione di migrazioni e dati iniziali, inclusa la creazione sicura dell'admin.
- Origini consentite per l'interfaccia, URL API e configurazione CORS.
- Segreti JWT, scadenze token e gestione del logout/refresh.
- Configurazione del servizio email e relative variabili per l'invio degli inviti e delle procedure di recupero password.
- Limiti e formato immagini, destinazione di archiviazione e dimensione massima.
- Procedura locale per avviare frontend, backend, MySQL e servizio email. Non è richiesto hosting remoto.

## 9. Incognite e domande aperte

Le versioni nello snapshot si ricontrollano all'inizio dell'implementazione e si fissano nel lockfile.

1. Definire i nomi degli eventi Socket.IO e lo schema dei payload JSON.

## 10. Criterio di completamento iniziale

La prima versione è considerata completa quando le funzionalità richieste sono utilizzabili tramite API protette, le regole di accesso sono verificate, gli aggiornamenti live previsti funzionano, e la collection Postman documenta i flussi principali con esempi di configurazione. I criteri di accettazione dettagliati andranno aggiunti per ogni feature durante lo sviluppo.

Per la consegna, il progetto dovrà inoltre avere istruzioni per installare le dipendenze e avviare l'applicazione, persistenza database funzionante, risposte HTTP coerenti nei casi di successo ed errore e documentazione sufficiente a presentare architettura e scelte implementative.
