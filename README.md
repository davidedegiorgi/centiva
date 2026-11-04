# Centiva

Applicazione web fintech con frontend React separato da API REST Laravel e database PostgreSQL.

## Funzionalità disponibili

- registrazione, accesso, uscita e profilo;
- dashboard con saldo, entrate, uscite, andamento giornaliero e categorie;
- gestione completa delle transazioni con ricerca e filtri;
- importazione CSV e OCR di screenshot, scontrini e appunti, con revisione prima del salvataggio;
- Centiva Insights ed Expense Detective per variazioni, duplicati e spese anomale;
- FutureBalance e Subscription Hunter;
- INcentiva con obiettivi, challenge, progressi e accantonamenti.

Le analisi sono prodotte soltanto quando esistono transazioni dell’utente. L’OCR viene eseguito nel browser; al primo utilizzo Tesseract.js scarica il modello linguistico italiano.

## Struttura

```text
centiva/
├── frontend/                 React, TypeScript, Vite, Tailwind, shadcn/ui
├── backend/                  Laravel API REST
├── compose.yaml              PostgreSQL per sviluppo locale
└── compose.production.yaml   stack completo containerizzato
```

## Sviluppo locale

Requisiti: Node.js 22+, npm 10+, PHP 8.3+, Composer 2 e PostgreSQL 18 (nativo o Docker).

### Database

```bash
cp .env.example .env
docker compose up -d postgres
```

Impostare in `.env` una password robusta e riportare gli stessi valori PostgreSQL in `backend/.env`.

### Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
```

API: `http://localhost:8000`. Health check: `http://localhost:8000/up`.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Applicazione: `http://localhost:5173`.

## Verifica

```bash
cd backend
vendor/bin/pint --test
php artisan test --compact

cd ../frontend
npm run lint
npm run build
```

I test Laravel usano un database SQLite effimero; l’applicazione usa PostgreSQL.

## Deployment con Docker

La configurazione inclusa espone soltanto il frontend su porta `8080`; Nginx inoltra le richieste API al container Laravel e PostgreSQL rimane nella rete privata Docker.

```bash
cp .env.production.example .env.production
cd backend
php artisan key:generate --show
cd ..
```

Copiare la chiave mostrata in `APP_KEY` dentro `.env.production`, impostare una password PostgreSQL unica e poi avviare:

```bash
docker compose --env-file .env.production -f compose.production.yaml up -d --build
docker compose --env-file .env.production -f compose.production.yaml ps
```

Centiva sarà disponibile su `http://localhost:8080`. Le migrazioni vengono applicate automaticamente all’avvio del backend.

Per un dominio pubblico impostare `APP_URL`, `SANCTUM_STATEFUL_DOMAINS`, `SESSION_DOMAIN` e `SESSION_SECURE_COOKIE=true`, quindi terminare TLS davanti a Nginx. Conservare database e backup su volumi cifrati gestiti dall’infrastruttura.

Aggiornamento:

```bash
docker compose --env-file .env.production -f compose.production.yaml up -d --build
```

Backup PostgreSQL:

```bash
docker compose --env-file .env.production -f compose.production.yaml exec -T postgres pg_dump -U centiva centiva > centiva-backup.sql
```
