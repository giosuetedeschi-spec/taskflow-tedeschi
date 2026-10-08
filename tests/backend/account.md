# Backend — account e autenticazione

- Registrazione valida crea l'account; credenziali errate e email già registrata ricevono errori coerenti.
- Login valido rilascia un JWT utilizzabile sulle API protette; token assente, malformato o non valido viene rifiutato.
- Il recupero password emette un link monouso valido per un'ora; un token scaduto o già usato non cambia la password.
- Una password aggiornata permette il login e la password precedente non funziona più.
