# Frontend — progetti e membership

- Il catalogo mostra progetti pubblici e non mostra progetti privati o nascosti.
- Un visitatore può vedere i dettagli pubblici ma non task, chat o allegati; un utente registrato può unirsi al progetto.
- Il form copertina accetta `.png` e `.jpg` fino a 5 MB e mostra l'errore se il file supera il limite.
- Un proprietario vede i comandi di gestione; un membro o un visitatore non proprietario non vede azioni riservate.
- Il proprietario può riattivare un progetto archiviato.
- I progetti archiviati non appaiono nel catalogo; i membri vedono i dati in sola lettura finché il proprietario non li riattiva.
- L'archiviazione invalida gli inviti pendenti e nasconde l'auto-iscrizione ai progetti pubblici; dopo la riattivazione occorre un nuovo invito o link.
- In archivio, il proprietario può cambiare descrizione e copertina, ma non titolo, categoria, tecnologie o task.
- Dopo la riattivazione, l'interfaccia ricarica lo stato del progetto via REST prima di riprendere gli aggiornamenti live.
- Il proprietario può proporre il trasferimento solo a un membro attivo; il destinatario deve accettare, quindi entrambi vedono i permessi aggiornati e i membri attivi ricevono l'evento live.
- Il destinatario può consultare e accettare un invito; dopo l'accettazione il progetto compare tra quelli di cui è membro.
- Un link attivo può essere usato da più persone; dopo la revoca del proprietario non consente nuovi ingressi.
- Per accettare l'invito l'utente deve accedere a un account registrato; chi è già membro vede l'indicazione appropriata e non viene aggiunto una seconda volta.
- Dopo la rimozione da parte del proprietario, l'utente perde l'accesso e non può rientrare autonomamente, anche se il progetto è pubblico.
- Un membro può lasciare il progetto; l'interfaccia rimuove il progetto dalla sua area membri e non gli consente il rientro autonomo.
- Errori di rete o di autorizzazione sono mostrati senza lasciare l'interfaccia in uno stato incoerente.
