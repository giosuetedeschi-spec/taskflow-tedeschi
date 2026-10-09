# Requisiti e specifiche iniziali

> **Scelte MVP aggiornate:** si usa Bun in modo definitivo e il requisito npm è intenzionalmente trascurato. Per l’MVP la persistenza è SQLite integrata in Bun (`bun:sqlite`); MySQL e Sequelize descritti nelle note iniziali sono sostituiti per rendere l’app avviabile senza servizi aggiuntivi. La Definition of Done in `dod/` è la specifica operativa corrente.

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
| Database MVP | SQLite (`bun:sqlite`) | Scelto per l’avvio locale senza server separato |
| ORM/accesso dati | SQL parametrizzato con Bun SQLite | Nessun ORM nel MVP |
| Aggiornamenti live | Socket.IO, con trasporto WebSocket | Scelto; il protocollo applicativo Socket.IO è distinto dal WebSocket standard |
| Email | Inviti e recupero password | Richiesti; in sviluppo un mock integrato stampa nel terminale destinatario, oggetto e link, senza SMTP né invio esterno |
| Test manuale API | Collection Postman | Richiesta per la consegna |
| Pacchettizzazione | `package.json` e npm | `package.json` resta previsto; per scelta progettuale si usa Bun e si trascura il requisito relativo a npm |
| Persistenza | SQLite locale tramite Bun | Database per memorizzare e recuperare i dati; sostituisce la scelta MySQL iniziale |
| Errori HTTP | Gestione errori e codici di risposta appropriati | Richiesta nella descrizione della consegna |

### Decisioni e dettagli di implementazione

Le decisioni architetturali residue sono raccolte con domanda e risposta in [Decisioni e domande](decisioni-e-domande.md). Restano da realizzare lo schema fisico e le migrazioni, gli endpoint, i payload TypeScript, i comandi di avvio e la configurazione locale. Le versioni esatte vanno ricontrollate all'avvio dello sviluppo e fissate nel lockfile.

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

Per TaskFlow Socket.IO copre chat, aggiornamenti della bacheca e notifiche. I dati restano persistenti in SQLite; il canale live trasporta gli eventi, non sostituisce il database. Il server deve autenticare la connessione e verificare l'appartenenza al progetto prima di far entrare il socket nella stanza `project:<id>`.

**Formato eventi scelto:** eventi nominati con payload JSON e nomi nel formato `risorsa.azione`. Eventi iniziali approvati: `task.created`, `task.updated`, `task.moved`, `task.assigned`, `member.joined`, `member.left`, `project.owner.transferred`, `chat.message.created` e `report.created`. Ogni payload ha i campi comuni `eventId`, `projectId`, `occurredAt` e `data`; `eventId` è una stringa UUID generata dal backend, gli ID di utenti, progetti e task sono interi autoincrementali MySQL serializzati come numeri JSON, e `occurredAt` è un timestamp Unix numerico in millisecondi generato dal backend al momento dell'emissione, dopo il commit riuscito su MySQL. Il frontend lo mostra con `Intl.DateTimeFormat` usando locale `it-IT` e fuso `Europe/Rome`. Per gli eventi `task.*`, `data` contiene la rappresentazione completa aggiornata del task, con i campi visibili ai membri del progetto. `task.created` e `task.moved` sono inviati agli altri membri del progetto, escludendo chi ha compiuto l'azione e riceve già la risposta REST; `task.assigned` è inviato soltanto al nuovo assegnatario; `task.updated` aggiorna gli altri membri. `chat.message.created` contiene messaggio, autore e metadati degli allegati (ID, nome originale, tipo MIME rilevato e dimensione), mai i byte dei file, ed è inviato agli altri membri del progetto, escludendo l'autore che riceve già la risposta REST. Gli allegati sono salvati localmente con un nome interno casuale; il nome originale è conservato solo come metadato. Il download avviene tramite endpoint REST autenticato e accessibile ai membri del progetto. `member.joined` contiene ID e nome visualizzato del nuovo membro, senza email, ed è inviato soltanto ai membri già presenti, escludendo il nuovo membro che riceve la conferma REST. `member.left` contiene ID, nome visualizzato e causa (`left` o `removed`), senza email, ed è inviato ai membri rimasti. `project.owner.transferred` contiene ID e nome visualizzato del proprietario precedente e di quello nuovo, senza email, ed è inviato ai membri attivi dopo il commit. `report.created` contiene ID della segnalazione, categoria, ID e nome visualizzato del segnalante; è inviato agli admin. REST resta il percorso per creare/modificare risorse: dopo il commit su MySQL, il server emette l'evento ai membri o agli admin autorizzati. La consegna degli eventi persi durante una disconnessione non è garantita automaticamente; alla riconnessione il client rilegge lo stato via REST.

**Progetti archiviati e live:** l'archiviazione interrompe la ricezione di eventi live relativi al progetto; alla riattivazione il frontend rilegge prima lo stato via REST, poi i socket già connessi riprendono automaticamente a ricevere gli eventi autorizzati.

`member.left` viene inviato ai membri rimasti dopo un'uscita volontaria o una rimozione. Il payload include ID e nome visualizzato del membro, senza email, e indica la causa (`left` o `removed`); la persona uscita o rimossa è esclusa dai destinatari.

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

- **R5 - Creazione progetto (Richiesto):** titolo, descrizione, categoria, tecnologie, visibilità pubblica/privata e immagine di copertina `.png` o `.jpg`, massimo 5 MiB (5.242.880 byte), salvata nel filesystem locale; MySQL conserva il percorso del file. Il backend verifica che formato reale, estensione e MIME dichiarato corrispondano e rifiuta formati ambigui; file troppo grandi vengono rifiutati con HTTP 413. La copertina segue la visibilità del progetto: è accessibile a tutti per progetti pubblici e solo ai membri per quelli privati. Quando la copertina viene sostituita, il vecchio file è eliminato dopo il salvataggio riuscito del nuovo.
- **R6 - Manutenzione progetto (Richiesto):** il creatore può modificare, archiviare, riattivare o cancellare definitivamente il progetto, anche se archiviato. Un progetto archiviato resta consultabile dai membri in sola lettura, con download degli allegati esistenti; il proprietario può aggiornare solo descrizione e copertina, mentre titolo, categoria, tecnologie e task restano bloccati. Non compare nel catalogo pubblico, non consente auto-iscrizioni né creazione o accettazione di inviti, e non invia aggiornamenti live ai membri. L'archiviazione revoca definitivamente gli inviti esistenti. Alla riattivazione, il frontend rilegge lo stato via REST prima che i socket già connessi riprendano a ricevere gli eventi autorizzati. La cancellazione elimina i dati collegati e i relativi file dal filesystem, inclusi copertina e allegati, ma non gli account degli utenti.
- **R7 - Membri (Richiesto):** il proprietario può invitare via email o tramite link; gli inviti non scadono finché non vengono accettati o revocati. Il link è riutilizzabile da più persone, il proprietario può revocarlo e generarne uno nuovo. Per accettare, l'invitato deve avere un account registrato e confermare esplicitamente l'ingresso. L'invito email può essere accettato solo dall'account con l'indirizzo destinatario; se l'utente è già membro non viene creata una membership duplicata. L'accettazione di un link chiude gli inviti email pendenti dello stesso utente per quel progetto. Un utente registrato può unirsi autonomamente a un progetto pubblico attivo, ma chi è stato rimosso o ha lasciato il progetto non può rientrare in autonomia. Il proprietario può invitare di nuovo un membro rimosso; ogni nuovo ingresso apre un nuovo periodo di membership. Il proprietario può rimuovere membri e i membri possono lasciare il progetto; entrambe le azioni revocano subito accesso e connessione Socket.IO, ma conservano messaggi e allegati per gli altri membri.
- **R8 - Catalogo pubblico (Richiesto):** elenco dei progetti pubblici attivi, filtrabile per categoria, tecnologia e data di creazione. I progetti archiviati non compaiono nel catalogo. I non membri possono consultare i dettagli pubblici e la copertina, ma task, chat e allegati restano accessibili solo ai membri.
- **R9 - Segnalazioni e moderazione (Richiesto):** solo i membri del progetto possono segnalarlo. Le categorie e gli stati sono definiti nel modello dati; gli admin possono accogliere o respingere, nascondere o ripristinare progetti, e bloccare o sbloccare account. Accogliere una segnalazione non applica automaticamente un'azione di moderazione.

### 4.3 Task e dashboard

- **R10 - Task (Richiesto):** ogni task ha titolo, descrizione, priorità (bassa, media o alta) e stato; scadenza e assegnatario sono facoltativi. Ogni membro attivo può creare e modificare task; può eliminarli l'autore o il proprietario del progetto.
- **R11 - Bacheca (Richiesto):** gli stati previsti sono Da fare, In corso e Completato; i task si possono spostare tra le colonne e riassegnare ai membri attivi. In archivio le modifiche ai task sono bloccate.
- **R12 - Dashboard personale (Richiesto):** mostra progetti creati, progetti di cui l'utente è membro e task assegnati ordinati per scadenza.

### 4.4 Chat, aggiornamenti e notifiche

- **R13 - Chat progetto (Richiesto):** ogni progetto ha una chat interna accessibile ai membri, con cronologia salvata e consultabile a pagine da 50 messaggi. Un membro può leggere solo i messaggi inviati dalla sua data di ingresso più recente nel progetto e scaricare gli allegati di tali messaggi; i messaggi e gli allegati precedenti non sono visibili ai nuovi membri o a chi è rientrato. Se un membro viene rimosso o lascia il progetto, perde subito l'accesso; i suoi messaggi e allegati restano disponibili agli altri membri. L'interfaccia ordina i messaggi dal meno recente al più recente, con il più recente accanto al box di scrittura. Ogni messaggio richiede testo non vuoto dopo `trim()`, lungo al massimo 5.000 caratteri, e può includere fino a 5 allegati `.txt` (massimo 1 MiB, 1.048.576 byte), `.png`, `.jpg` e `.pdf` (massimo 5 MiB, 5.242.880 byte ciascuno). Il backend verifica che formato reale, estensione e MIME dichiarato corrispondano e rifiuta file ambigui. Se anche un solo allegato non supera la validazione, viene rifiutato l'intero invio senza salvare il messaggio o gli altri file. I file vengono salvati localmente con nome interno casuale, mentre il nome originale resta nei metadati. I file oltre il limite vengono rifiutati con errore HTTP 413. Dopo l'invio, i messaggi non possono essere modificati né cancellati.
- **R14 - Bacheca live (Richiesto):** i membri ricevono `task.created`, `task.moved` e `task.updated` quando un task viene creato, spostato o modificato.
- **R15 - Notifiche live (Richiesto):** `task.assigned` avvisa soltanto il nuovo assegnatario; `task.updated` aggiorna gli altri membri. `member.joined` e `member.left` informano i membri rimasti sugli ingressi e sulle uscite; `project.owner.transferred` comunica il cambio di proprietà ai membri attivi; `report.created` avvisa gli admin quando un progetto viene segnalato.

### 4.5 API e consegna

- **R16 - API REST (Richiesto):** le funzionalità devono essere accessibili tramite API.
- **R17 - Autorizzazione (Richiesto):** gli endpoint applicano i permessi previsti da ruolo, proprietà e appartenenza al progetto.
- **R18 - Collection Postman (Richiesto):** consegnare una collection pronta a provare le funzionalità.

## 5. Specifiche operative adottate

Le regole seguenti sono state adottate per rendere i requisiti verificabili; le risposte e le motivazioni sono riepilogate in [Decisioni e domande](decisioni-e-domande.md).

- Un progetto privato non compare nel catalogo pubblico e non è leggibile da utenti esterni al progetto e dagli admin autorizzati.
- Solo i membri del progetto possono leggere la chat e la bacheca; solo il proprietario può gestire i membri e le impostazioni del progetto.
- Un task può essere senza assegnatario; se assegnato, l'utente deve essere un membro del progetto.
- La priorità di un task è bassa, media o alta.
- Gli inviti possono essere inviati via email o condivisi tramite link; non hanno scadenza, restano attivi finché accettati o revocati, e l'invitato registrato deve accettare esplicitamente prima di diventare membro. Un invito email è vincolato all'account con l'indirizzo destinatario. Il link è riutilizzabile da più persone, revocabile e rigenerabile dal proprietario; l'accettazione da parte di un membro esistente non crea duplicati. L'archiviazione revoca definitivamente gli inviti esistenti e impedisce inviti e auto-iscrizioni fino alla riattivazione. Accettare un link chiude gli inviti email pendenti dello stesso utente per il progetto. Un utente registrato può unirsi autonomamente a un progetto pubblico attivo.
- Solo i membri di un progetto possono inviarne una segnalazione.
- La scadenza di un task è facoltativa. La dashboard ordina i task assegnati per scadenza crescente; quelli senza scadenza vengono mostrati dopo quelli con scadenza.
- L'archiviazione conserva il progetto e i relativi file, revoca definitivamente gli inviti esistenti e lo rende consultabile in sola lettura ai membri. La cancellazione è definitiva ed elimina membership, task, messaggi e file collegati; gli account degli utenti restano.
- Le notifiche sono solo live e non vengono salvate né rese consultabili dopo la disconnessione.
- Le operazioni di moderazione e i cambi di stato devono essere verificati anche lato server, non solo nascosti nell'interfaccia.
- Non è previsto un audit log dedicato alle azioni amministrative; la segnalazione conserva comunque il revisore e le date necessarie al proprio flusso.

## 6. Entità dati iniziali

Modello concettuale pensato per essere tradotto in tabelle relazionali MySQL tramite Sequelize:

- **Utente:** ID intero autoincrementale MySQL, email, credenziale protetta, profilo, stato (attivo/bloccato), ruolo amministrativo.
- **Progetto:** ID intero autoincrementale MySQL, proprietario, titolo, descrizione, categoria, tecnologie, visibilità, percorso locale della copertina, stato (attivo/archiviato/nascosto), date. I progetti pubblici mostrano i dettagli ai non membri ma riservano task, chat e allegati ai membri.
- **Membership/Invito:** progetto, account invitato o membro, stato (invito in attesa, membership attiva, lasciata, rimossa o invito revocato), date di ingresso e uscita. Un account può avere più periodi di membership per lo stesso progetto dopo un nuovo invito; la cronologia chat visibile parte dall'ingresso più recente. Inviti email e link restano attivi senza scadenza fino ad accettazione o revoca; il link è riutilizzabile. L'invito diventa membership attiva solo dopo accettazione esplicita da parte di un account registrato; l'invito email è vincolato all'indirizzo destinatario e non si duplica una membership esistente. Ogni progetto ha un solo proprietario; il trasferimento segue le regole in [Decisioni e domande](decisioni-e-domande.md).
- **Task:** ID intero autoincrementale MySQL, progetto, titolo, descrizione, scadenza facoltativa, priorità, stato, assegnatario facoltativo, autore, date.
- **Messaggio:** progetto, autore, testo obbligatorio, fino a 5 riferimenti agli allegati ammessi (`.txt`, `.png`, `.jpg`, `.pdf`), data; la cronologia è persistente e consultabile, e i messaggi sono immutabili dopo l'invio.
- **Segnalazione:** progetto, segnalante membro del progetto, categoria di motivazione (spam, contenuto inappropriato o illegale, violazione di proprietà intellettuale, informazioni ingannevoli, altro), stato di revisione (in attesa, accolta o respinta), admin revisore e date.

La struttura è una base di analisi; attributi e vincoli precisi si traducono in migrazioni durante lo sviluppo.

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
- Bun è il package manager definitivo per installare dipendenze ed eseguire gli script di sviluppo. Il requisito della traccia relativo a npm è intenzionalmente trascurato.
- TypeScript 7.0.2, React 19.3.0 ed Express 5.2.1 per il codice applicativo, secondo lo snapshot delle versioni stabili sopra.
- React per l'interfaccia, Express per le API e Sequelize per l'accesso a MySQL.
- Sequelize 6.37.8 con MySQL 8.4.11 LTS.
- Git per versionamento.
- File `.env` locale per configurazione e segreti, senza committarlo.
- Postman per importare e provare la collection di consegna.
- È prevista una suite di test automatizzati per backend e frontend; i casi iniziali sono in `tests/`. La scelta corrente è Vitest, con Supertest per Express e React Testing Library per i componenti.

### Configurazione da completare durante l'implementazione

- Sistema operativo e comandi standard di installazione/avvio per Node.js, Bun, MySQL e dipendenze applicative.
- Eseguire migrazioni e seed iniziale dell'admin tramite comando locale sicuro.
- Impostare origini frontend consentite e configurazione CORS nell'ambiente.
- Generare e fornire segreti per JWT/sessioni senza committarli.
- Il mock email in sviluppo mostra nel terminale destinatario, oggetto e link; non richiede servizio SMTP o installazioni aggiuntive.
- Procedura locale per avviare frontend, backend e MySQL. Non è richiesto hosting remoto.

## 9. Stato delle decisioni

Non restano decisioni architetturali bloccanti per iniziare lo scaffold: le scelte e le relative risposte sono documentate in [Decisioni e domande](decisioni-e-domande.md). Restano dettagli da codificare, versioni da ricontrollare e configurazione locale da completare.

## 10. Criterio di completamento iniziale

La prima versione è considerata completa quando le funzionalità richieste sono utilizzabili tramite API protette, le regole di accesso sono verificate, gli aggiornamenti live previsti funzionano, e la collection Postman documenta i flussi principali con esempi di configurazione. I criteri di accettazione dettagliati andranno aggiunti per ogni feature durante lo sviluppo.

Per la consegna, il progetto dovrà inoltre avere istruzioni per installare le dipendenze e avviare l'applicazione, persistenza database funzionante, risposte HTTP coerenti nei casi di successo ed errore e documentazione sufficiente a presentare architettura e scelte implementative.
