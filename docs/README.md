# Documentazione TaskFlow

Questa cartella traduce la traccia dell'esame e le indicazioni integrative condivise in requisiti verificabili e in un piano di sviluppo. Le decisioni non presenti nella traccia sono indicate come **da decidere**: non sono vincoli già approvati.

## Documenti

- [Requisiti, tecnologie e specifiche](requisiti-e-specifiche.md): ambito, ruoli, funzionalità, dati, dipendenze, ambiente e incognite.
- [Piano di sviluppo](piano-sviluppo.md): sequenza proposta delle feature e risultati attesi per fase.
- [Casi di test iniziali](../tests/README.md): copertura prevista per backend e frontend, organizzata per area.

## Fonte e stato

Le fonti sono `ProgettoFinale2026.pdf` (pagine 2-3) e le indicazioni integrative dell'esercizio condivise in chat. La consegna è entro l'8 novembre 2026 e la prova copre l'intero percorso. Il README del repository al momento contiene solo il nome del progetto. Le specifiche qui raccolte sono quindi una prima analisi della traccia, non una descrizione di funzionalità già implementate.

Stack scelto: React e TypeScript per il frontend; Express e TypeScript per il backend; MySQL 8.4.11 LTS con Sequelize 6; Bun per la toolchain di sviluppo; Socket.IO per gli aggiornamenti live.

Per le versioni si adotta l'ultima release stabile compatibile, evitando prerelease. Gli aggiornamenti live usano eventi nominati Socket.IO con payload JSON; restano da dettagliare nomi e campi.

Legenda:

- **Richiesto**: esplicitamente presente nella traccia.
- **Proposta**: dettaglio operativo suggerito per rendere il requisito implementabile.
- **Da decidere**: informazione assente o ambigua nella traccia.
