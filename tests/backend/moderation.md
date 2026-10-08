# Backend — segnalazioni e moderazione

- Solo un membro del progetto può segnalarlo; un utente esterno riceve un rifiuto.
- Sono accettate le categorie previste: spam, contenuto inappropriato o illegale, violazione di proprietà intellettuale, informazioni ingannevoli, altro.
- Una nuova segnalazione parte da In attesa; un admin può chiuderla come Accolta o Respinta.
- L'azione admin può nascondere un progetto o bloccare un utente; gli endpoint admin rifiutano utenti non admin.
- La nuova segnalazione genera un avviso live agli admin; l'avviso non diventa una notifica persistente.
