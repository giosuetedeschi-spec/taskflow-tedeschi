# Test TaskFlow

I test sono organizzati per area e per lato applicativo:

- `backend/`: API, autorizzazioni, regole di dominio, persistenza e Socket.IO.
- `frontend/`: flussi visibili e reazioni dell'interfaccia.

Questa prima versione registra casi di accettazione verificabili. Il repository non contiene ancora codice applicativo, `package.json` o API/componenti su cui eseguire test: quando le interfacce esisteranno, questi casi diventeranno test automatici eseguibili. Il framework si sceglierà in quel momento, mantenendo gli stessi casi.

La copertura parte dai flussi richiesti e dai confini di autorizzazione, input e persistenza; non moltiplica casi equivalenti per ogni schermata o funzione interna.
