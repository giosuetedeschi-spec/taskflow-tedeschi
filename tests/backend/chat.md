# Backend — chat e allegati

- Solo i membri del progetto possono leggere lo storico o inviare messaggi; gli utenti esterni sono rifiutati.
- I messaggi salvati restano consultabili dopo la disconnessione e sono emessi in tempo reale ai membri connessi.
- Dopo l'invio, un messaggio non può essere modificato né cancellato.
- Sono accettati `.txt` fino a 1 MB e `.png`, `.jpg`, `.pdf` fino a 5 MB ciascuno.
- Un'estensione non ammessa viene rifiutata; un file oltre il limite restituisce HTTP 413 senza salvarlo.
