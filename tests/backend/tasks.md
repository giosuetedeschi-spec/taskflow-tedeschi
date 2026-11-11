# Backend — task e bacheca

- Sono accettate solo le priorità bassa, media e alta e gli stati Da fare, In corso e Completato.
- Assegnatario e scadenza possono mancare; se presente, l'assegnatario deve appartenere al progetto.
- Un utente esterno al progetto non può leggere o modificare i suoi task.
- Ogni membro attivo può creare, modificare, spostare e assegnare task; l'assegnatario deve essere un membro attivo dello stesso progetto.
- Può eliminare il task l'autore oppure il proprietario del progetto; gli altri membri ricevono un rifiuto di autorizzazione.
- In un progetto archiviato nessuno può creare, modificare, spostare, assegnare o eliminare task.
- La creazione, modifica, spostamento e assegnazione emettono rispettivamente `task.created`, `task.updated`, `task.moved` e `task.assigned` ai destinatari autorizzati; `task.assigned` raggiunge soltanto il nuovo assegnatario.
- `task.created` e `task.moved` raggiungono gli altri membri del progetto, escludendo chi ha eseguito l'azione e ha già ricevuto la risposta REST.
- Per gli eventi `task.*`, `data` contiene il task completo aggiornato, con i campi visibili ai membri.
