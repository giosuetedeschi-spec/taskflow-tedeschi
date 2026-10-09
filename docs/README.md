# Documentazione TaskFlow

Questa cartella traduce la traccia dell'esame e le indicazioni integrative condivise in requisiti verificabili e in un piano di sviluppo. Le decisioni non presenti nella traccia sono indicate come **da decidere**: non sono vincoli già approvati.

## Documenti

- [Requisiti, tecnologie e specifiche](requisiti-e-specifiche.md): ambito, ruoli, funzionalità, dati, dipendenze, ambiente e incognite.
- [Decisioni e domande](decisioni-e-domande.md): risposte proposte per i gruppi di scelte ancora aperti, adottando separazione, sicurezza e comunicazione chiara.
- [Piano di sviluppo](piano-sviluppo.md): sequenza proposta delle feature e risultati attesi per fase.
- [Casi di test iniziali](../tests/README.md): copertura prevista per backend e frontend, organizzata per area.

## Fonte e stato

Le fonti iniziali sono `ProgettoFinale2026.pdf` (pagine 2-3) e le indicazioni integrative dell'esercizio condivise in chat. La consegna è entro l'8 novembre 2026 e la prova copre l'intero percorso. Le specifiche descrivono la base concordata; per l’MVP, [dod](../dod/README.md) è la fonte operativa aggiornata e prevale sulle scelte iniziali superate.

Stack MVP: React e TypeScript per il frontend; Express e TypeScript per il backend; SQLite integrato in Bun; Socket.IO per gli aggiornamenti live. Bun è il package manager definitivo; il requisito della traccia relativo a npm è intenzionalmente trascurato.

Per le versioni si adotta l'ultima release stabile compatibile, evitando prerelease. Gli aggiornamenti live usano eventi nominati Socket.IO con payload JSON; nomi, campi comuni e schemi specifici iniziali sono documentati nei requisiti e nelle decisioni.

Legenda:

- **Richiesto**: esplicitamente presente nella traccia.
- **Proposta**: dettaglio operativo suggerito per rendere il requisito implementabile.
- **Da decidere**: informazione assente o ambigua nella traccia.
