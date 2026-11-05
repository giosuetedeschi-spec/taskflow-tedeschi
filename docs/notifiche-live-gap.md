# Notifiche live: lacuna rispetto al PDR

**Stato al 5 novembre 2026:** analisi e soluzione proposta. Nessuna modifica alle notifiche è stata applicata.

## Requisito

La sezione «C. Chat e notifiche in tempo reale» di `ProgettoFinale2026.pdf` richiede l'aggiornamento live della bacheca quando un task viene creato, spostato o modificato, una notifica quando un task viene assegnato o un membro entra nel progetto, e una notifica agli amministratori quando arriva una segnalazione.

## Problema osservato nel codice

- Il client in `apps/web/src/App.tsx` apre Socket.IO solo mentre è visualizzato un progetto. Chi si trova nella dashboard o nell'area amministrativa non riceve gli eventi destinati al proprio utente o agli admin.
- `task.assigned` aggiorna i task caricati, ma non mostra una notifica. `member.joined` ricarica la lista membri, ma non segnala visibilmente l'ingresso. Il client non ascolta `report.created`.
- Il server in `apps/api/src/app.ts` non emette `task.assigned` quando un task nasce già assegnato. Se una PATCH cambia insieme stato e assegnatario, emette `task.moved` ma non `task.assigned`. Se cambia solo l'assegnatario, emette `task.assigned` ma non `task.updated` agli altri membri: la loro bacheca può restare indietro.
- Alla riconnessione il client rientra nella stanza del progetto, senza rileggere dashboard, task, membri e chat via REST. Eventi persi durante la disconnessione possono lasciare la UI non aggiornata.

Il backend dispone già delle stanze Socket.IO per utente e admin e degli eventi `task.*`, `member.joined` e `report.created`. La lacuna riguarda il momento e i destinatari dell'emissione, la connessione del client e la presentazione delle notifiche.

## Soluzione proposta

1. Mantenere una connessione Socket.IO autenticata per tutta la sessione, anche nella dashboard e nell'area admin. Il client si iscrive alle stanze dei progetti attivi di cui è membro; il server conserva i controlli di appartenenza e le stanze per utente/admin.
2. Mostrare un avviso visibile per assegnazioni e ingressi; mostrare agli admin una nuova segnalazione e aggiornare la coda di moderazione. Aggiornare la dashboard personale quando cambia un task assegnato.
3. Emettere `task.assigned` alla creazione con assegnatario e a ogni nuova assegnazione, anche se la stessa richiesta cambia lo stato. Emettere sempre `task.created`, `task.moved` o `task.updated` alla stanza del progetto per mantenere la bacheca coerente.
4. Dopo una riconnessione, rileggere via REST i dati correnti prima di considerare riallineata la UI. Evitare duplicati usando ID di task e messaggi.
5. Verificare con due sessioni browser e una sessione admin: creazione e riassegnazione task, spostamento, ingresso membro, segnalazione, riconnessione e revoca dell'accesso. Controllare sia l'evento sia l'avviso visibile, sulla board e fuori dalla board.

Questa lacuna impedisce di dichiarare completa la parte «notifiche live» del PDR. Il resto dei flussi principali è stato provato separatamente con il browser headless.
