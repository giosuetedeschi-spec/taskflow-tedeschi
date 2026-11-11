# Backend — eventi in tempo reale

- Gli eventi nominati usano i payload JSON con campi comuni `eventId`, `projectId`, `occurredAt` e `data`.
- `eventId` è una stringa UUID generata dal backend.
- Gli ID di utenti, progetti e task sono interi autoincrementali MySQL e vengono serializzati come numeri JSON; `projectId` identifica il progetto dell'evento.
- `occurredAt` è un numero di millisecondi Unix generato dal backend al momento dell'emissione, dopo il commit riuscito su MySQL; il frontend lo formatta per `it-IT` e `Europe/Rome`.
- `data` contiene i campi necessari per aggiornare subito l'interfaccia; non serve un fetch REST aggiuntivo finché l'evento è stato ricevuto.
- Gli eventi vengono emessi solo dopo il commit della modifica persistente e solo ai membri o agli admin autorizzati.
- `member.joined` è inviato ai membri già presenti; il nuovo membro è escluso perché riceve la conferma REST.
- `member.left` viene inviato ai membri rimasti sia per uscita volontaria sia per rimozione; include ID, nome visualizzato e causa, senza email.
- Dopo il commit del trasferimento, `project.owner.transferred` viene inviato ai membri attivi autorizzati e include ID e nome visualizzato del proprietario precedente e di quello nuovo, senza email.
- `chat.message.created` è inviato agli altri membri del progetto; l'autore è escluso perché riceve la risposta REST.
- Un socket non membro non può unirsi alla stanza del progetto né riceverne gli eventi.
- Rimuovere un membro o la sua uscita volontaria revoca subito il socket dalla stanza del progetto, impedendo ogni ulteriore evento.
- I socket non ricevono eventi relativi a progetti archiviati; alla riattivazione il frontend rilegge lo stato via REST prima che i socket già connessi riprendano la ricezione autorizzata.
