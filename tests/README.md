# Test TaskFlow

I test sono organizzati per area e per lato applicativo:

- `backend/`: API, autorizzazioni, regole di dominio, persistenza e Socket.IO.
- `frontend/`: flussi visibili e reazioni dell'interfaccia.

Questi casi descrivono l’aspettativa di prodotto e guidano i test automatici del workspace. Le API usano `bun:test` con Supertest e SQLite temporanea; i componenti React usano Vitest e React Testing Library.

La copertura parte dai flussi richiesti e dai confini di autorizzazione, input e persistenza; non moltiplica casi equivalenti per ogni schermata o funzione interna.
