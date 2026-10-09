# TaskFlow

TaskFlow è una piattaforma collaborativa per organizzare progetti di gruppo, attività e conversazioni. I progetti pubblici sono esplorabili da un catalogo; gli amministratori gestiscono segnalazioni e moderazione.

## Stato del progetto

È in corso la realizzazione dell’MVP: workspace Bun, API Express, interfaccia React, schema SQLite e primi test automatici sono presenti. Le funzioni elencate in [Definition of Done](dod/README.md) definiscono il rilascio completo.

## Stack scelto

- **Toolchain:** Bun come package manager; il requisito della traccia relativo a npm è intenzionalmente trascurato.
- **Runtime backend:** Bun.
- **Frontend:** React e TypeScript.
- **Backend e API:** Express e TypeScript, con API REST e autenticazione JWT.
- **Database MVP:** SQLite integrato in Bun (`bun:sqlite`); non richiede un server separato.
- **Aggiornamenti live:** Socket.IO con eventi nominati e payload JSON.
- **Email in sviluppo:** mock integrato che stampa nel terminale destinatario, oggetto e link, senza invio esterno.

Le versioni stabili sono uno snapshot da ricontrollare all'avvio dell'implementazione; le scelte e le note di compatibilità sono documentate nei requisiti.

## Funzionalità previste

- Account, accesso e recupero password.
- Progetti pubblici o privati, catalogo, inviti e gestione dei membri.
- Bacheca task con stati, priorità, scadenze e assegnatari.
- Chat di progetto con cronologia, allegati e aggiornamenti in tempo reale.
- Segnalazioni, moderazione e strumenti amministrativi.

L'applicazione è progettata per l'uso locale su Windows; non è previsto hosting remoto.

## Documentazione

- [Requisiti e specifiche](docs/requisiti-e-specifiche.md): decisioni, tecnologie, requisiti d'ambiente e aspetti ancora da definire.
- [Decisioni e domande](docs/decisioni-e-domande.md): domande residue e risposte operative adottate per architettura, sicurezza e flussi.
- [Piano di sviluppo](docs/piano-sviluppo.md): ordine proposto per realizzare le funzionalità.
- [Indice della documentazione](docs/README.md).
- [Casi di accettazione e test previsti](tests/README.md), separati per backend e frontend.
- [Definition of Done MVP](dod/README.md): funzionalità, avvio, flusso demo e criteri di completamento.

## Ambiente di sviluppo

Ambiente richiesto: Windows e Bun 1.4 o successivo. Database e allegati sono locali; non servono Docker, MySQL o servizi esterni.

```powershell
bun install
bun run seed:admin   # facoltativo: crea l’account amministratore
bun run dev
```

Aprire <http://localhost:5173>. Il mock email mostra nel terminale API i link di invito e recupero password.

## Consegna

**Scadenza: 8 novembre 2026.** La consegna richiede un'applicazione Node.js funzionante, API REST, persistenza su database, gestione appropriata degli errori e documentazione delle scelte implementative.
