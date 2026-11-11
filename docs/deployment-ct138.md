# Deployment web su CT138

Questa guida prepara il progetto per il deploy. Non crea CT138, record DNS, tunnel Cloudflare, firewall, utenti o volumi: questi passaggi restano in IaC/Ansible e nella configurazione Cloudflare.

## Applicazione

- Bun compila il backend e la SPA statica; l'API serve entrambi sullo stesso origin.
- `PUBLIC_ORIGIN` deve essere esattamente `https://taskflow.gabrielateleaga.com`, senza slash o percorso finale. Link invito e trasferimento puntano a questo origin.
- API REST e Socket.IO usano percorsi relativi (`/api/v1` e `/socket.io`), quindi browser, cookie e socket restano same-origin. In sviluppo Vite continua a fare proxy verso `127.0.0.1:3001`.
- Il servizio ascolta `127.0.0.1:3001`: il connector del tunnel sul CT può inoltrare a `http://127.0.0.1:3001` senza esporre la porta direttamente.
- Impostare `NODE_ENV=production` e un `JWT_SECRET` casuale persistente di almeno 32 caratteri. Se il segreto cambia o viene rigenerato, i JWT emessi prima non saranno verificabili. Non inserirlo in Git o nei log.
- Impostare `DATABASE_PATH` e `UPLOADS_DIR` su un volume persistente e con accesso in scrittura per l'utente del servizio. Database SQLite e allegati devono essere inclusi nelle stesse procedure di backup; preservare anche i file `-wal`/`-shm` durante backup a caldo (preferire l'API di backup SQLite o fermare il servizio).
- Inviti via email e recupero password rispondono con `503 EMAIL_UNAVAILABLE` in produzione: al momento non esiste un provider SMTP/API. I link condivisibili di invito e trasferimento restano disponibili. In sviluppo il mock console resta attivo.

## Bundle offline Linux

Il bundle di rilascio è destinato a Debian 13 x86_64 e usa Bun 1.4.2 baseline (senza requisito AVX2). Contiene `runtime/bun`, backend compilato, frontend statico, migrazioni SQLite, unità systemd, esempio di environment file, inventario dipendenze, informazioni di build e `SHA256SUMS`. Il server API è un singolo file Bun con le dipendenze JavaScript incluse; gli asset web sono compilati. Il CT non deve avere `node_modules`, Bun installato o accesso a registry npm/Bun.

Il bundle generato ha questa forma:

```text
taskflow/
├── runtime/bun
├── apps/api/dist/server.js
├── apps/api/migrations/*.sql
├── apps/web/dist/index.html
├── apps/web/dist/assets/*
├── systemd/taskflow.service
├── deployment/taskflow.env.example
├── deployment/README.md
├── BUILD-INFO.json
├── DEPENDENCIES.json
└── SHA256SUMS
```

Eseguire sul computer di build con Bun 1.4.2 e le dipendenze già installate. L'unico download dello script è il runtime Linux ufficiale, verificato contro il digest SHA256 pubblicato da GitHub; non avviene sul CT:

```powershell
bun run typecheck
bun run test
bun run build
powershell -NoProfile -File scripts/package-linux-offline.ps1 -BuildId 20261028T140000Z
```

Il risultato è `dist/taskflow-ct138-linux-x64-baseline-<BuildId>.tar.gz`, il sidecar `.sha256` e il manifest interno. Il generatore rifiuta di sovrascrivere output esistenti. Conservare i file locali `dist/offline-cache/` e `dist/offline-package-<BuildId>/` se servono per audit/debug; `dist/` è esclusa da Git.

## Build e avvio

Eseguire in una checkout pulita con Bun 1.4.2 o successivo:

Il deploy sul CT usa l'artefatto verificato: **non** eseguire `bun install`, `bun run build`, `npm install` o chiamate a registry sul CT. Il servizio systemd incluso usa `/opt/taskflow/current`, `/var/lib/taskflow`, `127.0.0.1` e la porta `3001`.

Il build del web crea `apps/web/dist`; quello API crea `apps/api/dist`. `start` richiede il frontend compilato e si arresta con errore se manca. Vite è solo per lo sviluppo e i test.

## IaC e Ansible

La configurazione del deploy deve:

1. predisporre directory persistenti per database/allegati e directory di rilascio per il codice; assegnare proprietà e permessi minimi all'utente dedicato;
2. trasferire al CT solo il `.tar.gz` e il sidecar `.sha256`; verificarli con `sha256sum --check`, poi estrarre la release. Verificare tutti i file con `sha256sum --check SHA256SUMS` prima di attivarla;
3. creare utente/gruppo `taskflow`, `/var/lib/taskflow/data` e `/var/lib/taskflow/uploads` con proprietario `taskflow` e permessi minimi; creare `/opt/taskflow/releases/<BuildId>` e aggiornare `/opt/taskflow/current` alla nuova directory `taskflow/` solo dopo la verifica hash;
4. creare `/etc/taskflow/taskflow.env` fuori dal bundle, permessi `0640` e segreto fornito da Ansible Vault. Servono `PUBLIC_ORIGIN`, `JWT_SECRET`, `DATABASE_PATH` e `UPLOADS_DIR`; l'unità imposta `NODE_ENV=production` e `PORT=3001`;
5. impostare `runtime/bun` a modo `0755` (un archivio creato su Windows può non conservare l'executable bit POSIX), installare `systemd/taskflow.service`, ricaricare systemd e abilitare/avviare il servizio. L'unità esegue il Bun incluso e non invoca npm, Bun install o registry;
6. configurare il tunnel `taskflow.gabrielateleaga.com` verso `http://127.0.0.1:3001`; non aggiungere un servizio statico separato né route CORS cross-origin;
7. verificare dopo il deploy `https://taskflow.gabrielateleaga.com/`, una route SPA diretta come `/invite/prova`, `GET /api/v1/...` e la connessione `/socket.io/`; provare inoltre persistenza dopo restart e accesso agli allegati esistenti.

Comandi equivalenti sul target per audit ed estrazione, da eseguire da root (Ansible può implementare gli stessi passaggi):

```sh
cd /var/cache/taskflow
sha256sum --check taskflow-ct138-linux-x64-baseline-<BuildId>.tar.gz.sha256
tar -xzf taskflow-ct138-linux-x64-baseline-<BuildId>.tar.gz -C /opt/taskflow/releases/<BuildId>
cd /opt/taskflow/releases/<BuildId>/taskflow
sha256sum --check SHA256SUMS
chmod 0755 runtime/bun
install -o root -g root -m 0644 systemd/taskflow.service /etc/systemd/system/taskflow.service
```

Scrivere `/etc/taskflow/taskflow.env` con Ansible e il segreto proveniente da Ansible Vault; non copiarlo dal template sostituendo il placeholder e non sovrascrivere un environment file già gestito. Abilitare la release solo dopo aver sostituito il symlink `current` in modo atomico.

Non eseguire i seed demo in produzione. Creare l'eventuale amministratore solo tramite il comando documentato e credenziali gestite fuori dal repository. Pianificare un rollback al precedente artefatto senza ripristinare un database più vecchio sopra dati nuovi.
