# Test TaskFlow

I test sono organizzati per area e per lato applicativo:

- `backend/`: API, autorizzazioni, regole di dominio, persistenza e Socket.IO.
- `frontend/`: flussi visibili e reazioni dell'interfaccia.

Questi casi descrivono l’aspettativa di prodotto e guidano i test automatici del workspace. Le API usano `bun:test` con Supertest e SQLite temporanea; i componenti React usano Vitest e React Testing Library.

La copertura parte dai flussi richiesti e dai confini di autorizzazione, input e persistenza; non moltiplica casi equivalenti per ogni schermata o funzione interna.

Per un controllo reale dell'interfaccia nel browser headless, usare `python scripts/browser-smoke.py` dopo aver installato Python Playwright e Chromium. L'opzione `--base-url` seleziona l'ambiente; `--full` crea due account fittizi `@example.test`, un progetto privato, un task e messaggi sul server indicato. Senza `--full` il controllo è in sola lettura. Su Windows si può indicare un browser Chromium già installato con `--browser-executable`.
