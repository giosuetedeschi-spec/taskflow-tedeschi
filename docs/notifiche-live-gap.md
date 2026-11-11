# Notifiche live: lacuna rispetto al PDR

**Stato al 5 novembre 2026:** correzioni implementate nel workspace locale; non pushate né deployate. Typecheck e build API/web superati; prove runtime non eseguite.

## Requisito

La sezione «C. Chat e notifiche in tempo reale» di `ProgettoFinale2026.pdf` richiede l'aggiornamento live della bacheca quando un task viene creato, spostato o modificato, una notifica quando un task viene assegnato o un membro entra nel progetto, e una notifica agli amministratori quando arriva una segnalazione.

## Problema osservato nel codice

- Il client in `apps/web/src/App.tsx` apre Socket.IO solo mentre è visualizzato un progetto. Chi si trova nella dashboard o nell'area amministrativa non riceve gli eventi destinati al proprio utente o agli admin.
- `task.assigned` aggiorna i task caricati, ma non mostra una notifica. `member.joined` ricarica la lista membri, ma non segnala visibilmente l'ingresso. Il client non ascolta `report.created`.
- Il server in `apps/api/src/app.ts` non emette `task.assigned` quando un task nasce già assegnato. Se una PATCH cambia insieme stato e assegnatario, emette `task.moved` ma non `task.assigned`. Se cambia solo l'assegnatario, emette `task.assigned` ma non `task.updated` agli altri membri: la loro bacheca può restare indietro.
- Alla riconnessione il client rientra nella stanza del progetto, senza rileggere dashboard, task, membri e chat via REST. Eventi persi durante la disconnessione possono lasciare la UI non aggiornata.

Il backend dispone già delle stanze Socket.IO per utente e admin e degli eventi `task.*`, `member.joined` e `report.created`. La lacuna riguarda il momento e i destinatari dell'emissione, la connessione del client e la presentazione delle notifiche.

## Correzioni applicate localmente

1. Il client mantiene una connessione Socket.IO autenticata durante tutta la sessione e cambia stanza quando si apre o chiude un progetto.
2. Assegnazioni, ingressi e segnalazioni admin mostrano avvisi visibili anche fuori dalla board; gli eventi task aggiornano anche la dashboard personale degli assegnatari. Gli avvisi si possono chiudere e gli ID evento evitano duplicati.
3. Creazione, modifica e spostamento mantengono aggiornata la board; `task.assigned` parte anche alla creazione assegnata e a ogni nuova assegnazione, inclusa una PATCH che cambia anche lo stato.
4. Alla riconnessione il client rilegge dashboard, progetto, task, membri e, se aperta, cronologia chat via REST. Un evento `member.left` informa anche la persona rimossa e la riporta alla dashboard se aveva aperto quel progetto.
5. Restano da completare prove runtime con due sessioni browser e una sessione admin per creazione/riassegnazione task, ingresso membro, segnalazione, riconnessione e revoca dell'accesso.

Le correzioni sono locali e non sono ancora state provate end-to-end; finché non vengono eseguite le prove runtime non dichiaro verificata la conformità della parte «notifiche live» del PDR.
