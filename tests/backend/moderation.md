# Backend — segnalazioni e moderazione

- Solo un membro del progetto può segnalarlo; un utente esterno riceve un rifiuto.
- Sono accettate le categorie previste: spam, contenuto inappropriato o illegale, violazione di proprietà intellettuale, informazioni ingannevoli, altro.
- Una nuova segnalazione parte da In attesa; un admin può chiuderla come Accolta o Respinta.
- L'azione admin può nascondere un progetto o bloccare un utente; gli endpoint admin rifiutano utenti non admin.
- La nuova segnalazione emette `report.created` agli admin; l'avviso non diventa una notifica persistente.
- Il payload `report.created` contiene ID segnalazione, categoria e ID e nome visualizzato del segnalante.
- Per ogni membro può esistere al massimo una segnalazione aperta per progetto; dopo la chiusura può essere inviata una nuova segnalazione.
- Accogliere una segnalazione non nasconde automaticamente il progetto; l'admin sceglie l'azione separatamente.
- Nascondere un progetto lo rimuove dal catalogo e blocca gli accessi dei non membri; i membri lo vedono in sola lettura fino al ripristino.
- Bloccare un utente revoca accessi, refresh e socket; il suo account e i dati restano e l'admin può sbloccarlo.
