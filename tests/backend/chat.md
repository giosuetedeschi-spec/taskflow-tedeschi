# Backend — chat e allegati

- Solo i membri del progetto possono leggere lo storico o inviare messaggi; gli utenti esterni sono rifiutati.
- Un membro può leggere solo i messaggi inviati dalla sua data di ingresso; la cronologia precedente non è accessibile ai nuovi membri.
- Dopo una nuova accettazione di invito, un ex membro vede solo i messaggi dal nuovo ingresso più recente.
- Rimuovere un membro ne blocca lettura e download; gli altri membri continuano a vedere i suoi messaggi e scaricare i relativi allegati.
- Gli allegati dei messaggi precedenti alla data di ingresso sono ugualmente inaccessibili al nuovo membro.
- La cronologia viene restituita in pagine da 50 messaggi, partendo dai più recenti disponibili per quel membro.
- I messaggi salvati restano consultabili dopo la disconnessione e vengono emessi come `chat.message.created` ai membri connessi.
- Il payload `chat.message.created` contiene messaggio, autore e per ogni allegato ID, nome originale, tipo MIME e dimensione, non il contenuto binario dei file.
- Ogni messaggio contiene da 1 a 5.000 caratteri dopo `trim()` e può avere da 0 a 5 allegati; testo vuoto o composto solo da spazi/a capo e invii composti solo da allegati sono rifiutati.
- Se un allegato non supera la validazione, l'intero messaggio viene rifiutato e non vengono salvati né il messaggio né gli altri file allegati.
- Il download avviene tramite endpoint REST autenticato; solo i membri del progetto possono scaricare gli allegati.
- Il nome usato sul filesystem è casuale e distinto dal nome originale conservato nei metadati.
- Dopo l'invio, un messaggio non può essere modificato né cancellato.
- Sono accettati `.txt` fino a 1 MiB (1.048.576 byte) e `.png`, `.jpg`, `.pdf` fino a 5 MiB (5.242.880 byte) ciascuno.
- Formato reale, estensione e MIME dichiarato devono corrispondere; file ambigui o con valori incoerenti vengono rifiutati.
- Un'estensione non ammessa viene rifiutata; un file oltre il limite restituisce HTTP 413 senza salvarlo.
