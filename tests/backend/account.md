# Backend — account e autenticazione

- Registrazione valida crea l'account; credenziali errate e email già registrata ricevono errori coerenti.
- Login valido rilascia un JWT utilizzabile sulle API protette; token assente, malformato o non valido viene rifiutato.
- Il JWT di accesso scade dopo 15 minuti; il refresh opaco dura 7 giorni, viene ruotato a ogni uso e sul database è conservato solo il suo hash.
- Logout, cambio password e blocco account revocano i refresh token; token riutilizzati dopo la rotazione invalidano la sessione.
- Il refresh token è in cookie HttpOnly e SameSite=Lax, Secure su HTTPS; gli endpoint basati su cookie verificano origine e protezione CSRF.
- Token e credenziali non sono salvati in localStorage e non compaiono nei log.
- Il recupero password emette un link monouso valido per un'ora; un token scaduto o già usato non cambia la password.
- In sviluppo, il mock stampa destinatario, oggetto e link di recupero nel terminale senza invio SMTP.
- Una password aggiornata permette il login e la password precedente non funziona più.
