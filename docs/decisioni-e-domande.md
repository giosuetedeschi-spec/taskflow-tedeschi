# Decisioni residue: domande e risposte

> **Override MVP:** le risposte iniziali su MySQL, Sequelize, setup e test qui sotto sono state sostituite per l’MVP. L’MVP usa SQLite integrata in Bun (`bun:sqlite`), senza ORM o server DB. La definizione vincolante e aggiornata è in `dod/README.md`.

Questa pagina chiude i gruppi di decisioni rimasti aperti nell'analisi. Le risposte sono scelte operative adottate su richiesta dell'utente, usando tre criteri: separare le responsabilità, applicare controlli di sicurezza lato server e mostrare messaggi chiari all'utente. Le versioni delle librerie si ricontrollano e si fissano nel lockfile quando si crea l'applicazione.

## 1. Permessi sui task

**Domanda — Chi può creare, modificare e spostare un task?**  
**Risposta —** Qualunque membro attivo del progetto. L'API verifica sempre l'appartenenza; l'interfaccia non è un controllo di sicurezza.

**Domanda — Chi può eliminare un task?**  
**Risposta —** Chi lo ha creato oppure il proprietario del progetto. L'operazione è definitiva; non viene introdotto un audit log amministrativo dedicato.

**Domanda — Chi può essere assegnato?**  
**Risposta —** Solo un membro attivo dello stesso progetto. L'assegnatario è facoltativo.

## 2. Schema dati e migrazioni

**Domanda — Come si organizza il database?**  
**Risposta —** MySQL relazionale, con tabelle normalizzate per utenti, progetti, periodi di membership, inviti, task, messaggi, allegati, segnalazioni, sessioni di refresh e token di recupero password. I token di invito e recupero sono casuali e ad alta entropia; il database conserva solo l'hash dei token. Gli allegati binari restano sul filesystem; MySQL conserva metadati e chiave relativa al file. Gli ID di utenti, progetti e task sono interi autoincrementali.

**Domanda — Come si cambia lo schema nel tempo?**  
**Risposta —** Migrazioni Sequelize versionate e committate. L'avvio normale applica le migrazioni pendenti; `sync({ alter: true })` e `sync({ force: true })` non si usano per dati reali. Le modifiche multi-tabella usano transazioni; file e record si coordinano con pulizia compensativa in caso di errore.

**Domanda — Come si crea il primo amministratore?**  
**Risposta —** Comando locale esplicito che chiede credenziali e le salva con hash sicuro. Nessuna password predefinita, credenziale nel seed o account admin creato automaticamente in produzione.

## 3. Contratto REST

**Domanda — Come si organizzano le rotte?**  
**Risposta —** API versionata sotto `/api/v1`, raggruppata per risorsa: `/auth`, `/projects`, `/projects/:id/members`, `/projects/:id/tasks`, `/projects/:id/messages`, `/attachments`, `/reports` e `/admin`. La scrittura persistente passa da REST; Socket.IO comunica gli aggiornamenti successivi al commit.

**Domanda — Come sono formattate le risposte?**  
**Risposta —** JSON UTF-8. Le singole risorse restituiscono un oggetto coerente; le liste usano `{ items, nextCursor }`. La paginazione della chat usa 50 messaggi: la prima pagina contiene i più recenti, ordinati dal meno recente al più recente per la visualizzazione.

**Domanda — Qual è il formato degli errori?**  
**Risposta —** `{ "error": { "code": "...", "message": "...", "requestId": "...", "details": [] } }`. `message` spiega in italiano come correggere l'input quando possibile; `code` è stabile per il client. Non si inviano stack trace, query SQL o dettagli interni.

**Domanda — Quali codici si usano?**  
**Risposta —** `400` richiesta malformata; `401` autenticazione mancante o non valida; `403` permesso negato; `404` risorsa assente o non visibile; `409` conflitto di stato o duplicato; `413` file oltre il limite; `422` input valido come JSON ma non conforme ai requisiti; `429` limite richieste; `500` errore inatteso con messaggio generico e `requestId`.

## 4. Payload Socket.IO

**Domanda — Quali campi condividono gli eventi?**  
**Risposta —** `{ eventId, projectId, occurredAt, data }`. `eventId` è UUID v4 generato dal backend; gli ID interni sono numeri JSON; `occurredAt` è millisecondi Unix generati dopo il commit. Ogni evento usa uno schema TypeScript discriminato dal nome dell'evento.

**Domanda — Che cosa contiene `data`?**  
**Risposta —** `task.created`, `task.updated`, `task.moved` e `task.assigned` contengono lo snapshot completo e aggiornato del task, limitato ai campi visibili ai membri; `task.moved` aggiunge `previousStatus`. `member.joined` contiene `{ member: { id, displayName } }`; `member.left` contiene gli stessi dati e `reason: "left" | "removed"`. `project.owner.transferred` contiene `{ previousOwner: { id, displayName }, owner: { id, displayName } }`. `chat.message.created` contiene messaggio, autore e metadati allegati (`id`, nome originale, MIME rilevato, dimensione in byte), mai i byte. `report.created` contiene ID, categoria e segnalante (`id`, nome visualizzato), senza email.

**Domanda — Chi riceve gli eventi?**  
**Risposta —** Si applicano le regole dei requisiti: l'attore riceve la risposta REST; gli altri membri ricevono l'aggiornamento; `task.assigned` va soltanto al nuovo assegnatario; `member.joined`, `member.left` e `project.owner.transferred` vanno ai membri attivi autorizzati; `report.created` va agli admin. Socket non membro, rimosso, disconnesso per blocco o collegato a progetto archiviato non riceve eventi. Dopo disconnessione o riattivazione, il client recupera lo stato con REST.

## 5. Autenticazione e sicurezza

**Domanda — Come funzionano accesso, rinnovo e logout?**  
**Risposta —** JWT di accesso valido 15 minuti, tenuto in memoria dal frontend e inviato nell'header `Authorization`. Il rinnovo usa un token opaco casuale valido 7 giorni, ruotato a ogni uso, conservato come hash in MySQL e trasmesso in cookie `HttpOnly`, `SameSite=Lax` e `Secure` quando si usa HTTPS. Logout e cambio password revocano le sessioni di rinnovo; l'eventuale JWT già emesso resta valido solo fino alla scadenza breve. I token non vanno in `localStorage`, URL o log.

**Domanda — Come si gestiscono CSRF, blocchi e socket?**  
**Risposta —** Endpoint che usano cookie verificano origine e protezione CSRF; CORS ammette solo origini locali configurate. Bloccare un account o revocare una membership invalida il rinnovo e chiude subito i socket correlati. Le connessioni live verificano autenticazione e appartenenza al progetto sia alla connessione sia prima di unirsi a una stanza.

**Domanda — Come si proteggono password e recupero?**  
**Risposta —** Password con Argon2id e parametri aggiornabili. Il recupero usa il link monouso già scelto, valido un'ora; la risposta non rivela se l'email esiste e il token viene invalidato dopo uso o cambio password. Login, recupero, inviti e upload hanno rate limit.

## 6. Moderazione

**Domanda — Come si chiude una segnalazione?**  
**Risposta —** Un solo report aperto per coppia membro/progetto; dopo la chiusura se ne può creare un altro. L'admin registra revisore, data e stato `Accolta` o `Respinta`. Accogliere una segnalazione non nasconde automaticamente il progetto: l'admin sceglie e registra esplicitamente l'azione di moderazione.

**Domanda — Che cosa comportano nascondere un progetto e bloccare un utente?**  
**Risposta —** Nascondere un progetto lo rimuove dal catalogo e blocca visite e auto-iscrizioni dei non membri; i membri esistenti lo consultano in sola lettura finché l'admin lo ripristina. Bloccare un account impedisce accesso e rinnovo, revoca i socket e conserva i dati; l'admin può sbloccarlo. Non si crea un audit log separato; i report conservano comunque revisore, stato e date.

## 7. Validazione, log e test

**Domanda — Come si valida l'input?**  
**Risposta —** Schemi Zod condivisi tra frontend e backend per i contratti riusabili; il backend ripete e applica sempre la validazione autorevole. Le regole di accesso restano nel backend e non si incorporano negli schemi del form.

**Domanda — Come si registrano gli errori?**  
**Risposta —** Pino con log JSON e `requestId` propagato tra REST e operazioni correlate. Si redigono password, token, cookie, link di invito/recupero, contenuto dei messaggi e byte dei file; i log contengono codici evento e metadati strettamente necessari.

**Domanda — Quali strumenti si usano per testare?**  
**Risposta —** Vitest per test unitari e componenti, Supertest per API Express, React Testing Library e `user-event` per i flussi UI. I test d'integrazione usano un database MySQL dedicato, migrazioni reali e fixture isolate; non si usa il database personale. Gli acceptance test già presenti in `tests/` restano la fonte dei comportamenti attesi.

Riferimenti ufficiali: [Zod](https://zod.dev/), [Pino](https://github.com/pinojs/pino), [Vitest](https://vitest.dev/guide/), [Supertest](https://github.com/forwardemail/supertest), [OWASP — Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) e [OWASP — JWT](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet.html).

## 8. Struttura e avvio locale

**Domanda — Come si separano le parti?**  
**Risposta —** Un solo repository Bun workspace: `apps/web` per React, `apps/api` per Express e `packages/contracts` per tipi e schemi condivisi. Un solo backend modulare; niente microservizi. Dentro l'API si separano route/controller, servizi di dominio, accesso dati, validazione e infrastruttura.

**Domanda — Come si sviluppa su Windows senza servizi aggiuntivi non necessari?**  
**Risposta —** Per l’MVP si usa SQLite integrata e non serve Docker o MySQL. Email di sviluppo nel mock terminale scelto. Porte di sviluppo: React/Vite `5173`, API/Socket.IO `3001`.

**Domanda — Dove si salvano configurazione e file?**  
**Risposta —** `.env.example` documenta variabili e valori non segreti; `.env` resta ignorato da Git. Gli upload hanno una directory configurabile fuori da `apps/web/public`, con chiavi relative casuali e estensione validata; MySQL non espone percorsi assoluti. I download passano sempre da REST e controllo accessi.

**Domanda — Qual è il flusso di avvio previsto?**  
**Risposta —** Avviare MySQL, creare `.env` da `.env.example`, eseguire `bun install`, migrazioni e seed admin interattivo, quindi lo script Bun di sviluppo che avvia frontend e backend. I comandi definitivi si aggiungono al `package.json` quando si crea lo scaffold. Versioni e compatibilità si ricontrollano allora; lo snapshot Node/Bun/MySQL resta in `requisiti-e-specifiche.md`.

## 9. Proprietà e uscita del proprietario

**Domanda — Il proprietario può lasciare il progetto?**  
**Risposta —** Non senza passare prima la proprietà: ogni progetto mantiene sempre un solo proprietario. Il proprietario può proporre il trasferimento a un membro attivo; il destinatario deve accettare via REST. In una transazione il destinatario diventa proprietario e il precedente proprietario diventa membro ordinario; dopo il commit, `project.owner.transferred` informa gli altri membri attivi. Il precedente proprietario può poi lasciare. Se il trasferimento non avviene, deve restare proprietario oppure cancellare il progetto. Il trasferimento è disponibile solo per progetti attivi.
