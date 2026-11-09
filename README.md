# Centiva

Centiva è una Progressive Web App fintech per monitorare **entrate, uscite e risultato mensile**. Non richiede di inserire il patrimonio complessivo, gli investimenti o il saldo totale del conto: lavora esclusivamente sui movimenti che l’utente decide di registrare.

L’applicazione è composta da un frontend React separato da un’API REST Laravel e da un database PostgreSQL.

## Applicazione online

- Frontend: [centiva.vercel.app](https://centiva.vercel.app/)
- Backend: Render (`centiva-api`)
- Database: PostgreSQL

## Funzionalità attuali

### Account

- registrazione con email e password;
- verifica dell’email tramite codice monouso di 6 cifre;
- accesso tradizionale o con Google OAuth;
- recupero e reimpostazione della password;
- modifica del profilo, logout ed eliminazione dell’account;
- email di verifica, benvenuto, recupero password e conferma eliminazione.

### Dashboard mensile

- risultato del mese, calcolato come entrate meno uscite registrate;
- totale delle entrate e delle uscite del mese;
- movimenti recenti;
- andamento giornaliero;
- distribuzione delle spese per categoria;
- confronto con i mesi precedenti;
- stati sintetici quando i dati non sono ancora sufficienti per un grafico utile.

Il risultato mensile non rappresenta il saldo del conto bancario.

### Movimenti

- creazione e modifica manuale;
- ricerca, filtri e ordinamento;
- selezione ed eliminazione multipla;
- tipo, importo, valuta, data e categoria;
- registrazione tramite comando vocale.

### Importazione intelligente

- fotografie di scontrini e ricevute;
- screenshot di transazioni;
- immagini e appunti leggibili;
- file CSV con intestazioni italiane o inglesi;
- revisione dei dati prima del salvataggio;
- riconoscimento di importo, data, valuta, tipo e categoria.

L’OCR viene eseguito direttamente nel browser con Tesseract.js. Il parser distingue gli importi da orari, codici, IVA, imponibile, resto e prezzi unitari. Gestisce inoltre alcuni scontrini da bilancia, ricostruendo il totale quando peso e prezzo al chilogrammo sono leggibili.

### Insights

- riepilogo delle spese del periodo;
- confronto con lo stesso intervallo del mese precedente;
- distribuzione e copertura delle categorie;
- osservazioni basate sui movimenti reali;
- rilevamento di possibili duplicati;
- individuazione di importi anomali rispetto allo storico disponibile;
- distinzione tra dati insufficienti, nessuna anomalia e risultati rilevati.

### Pianificazione

- FutureBalance per la previsione del risultato a fine mese;
- budget mensili per categoria;
- confronto tra limite impostato e uscite realmente registrate.

### PWA

Centiva può essere installata da browser su smartphone o desktop. Il service worker conserva la shell e le risorse statiche dell’app per rendere più rapido l’avvio. Le operazioni sui dati finanziari continuano a richiedere il collegamento al backend.

## Stack tecnologico

### Frontend

- React 19, TypeScript e Vite;
- Tailwind CSS e componenti shadcn/ui;
- Lucide Icons e Recharts;
- Tesseract.js e Papa Parse;
- GSAP e Lenis.

### Backend

- PHP 8.3 o superiore;
- Laravel 13;
- Laravel Sanctum e Socialite;
- API REST JSON;
- sessioni e cache su database.

### Database e infrastruttura

- PostgreSQL 18 per lo sviluppo Docker;
- Vercel per il frontend;
- Render per il backend;
- Brevo API per le email transazionali;
- Google OAuth per l’accesso con Google.

## Architettura

```text
Browser / PWA
      │
      │ HTTPS + JSON
      ▼
Frontend React su Vercel
      │
      │ /backend/*
      ▼
API Laravel su Render
      │
      │ Eloquent / PDO PostgreSQL
      ▼
Database PostgreSQL
```

Il frontend non accede mai direttamente al database. Tutte le operazioni passano attraverso Laravel, che applica autenticazione, validazione, autorizzazione e regole applicative.

## Struttura del repository

```text
centiva/
├── frontend/
│   ├── public/                  icone, manifest e service worker PWA
│   ├── src/
│   │   ├── components/          pagine e componenti React
│   │   ├── lib/                 API client, OCR, parser e comando vocale
│   │   ├── types/               tipi TypeScript
│   │   ├── App.tsx              autenticazione e navigazione principale
│   │   ├── client.tsx           avvio dell’applicazione
│   │   └── index.css            tema e stili globali
│   ├── vercel.json              proxy dal frontend al backend Render
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── Http/Controllers/    controller REST
│   │   ├── Http/Requests/       validazione delle richieste
│   │   ├── Http/Resources/      trasformazione dei model in JSON
│   │   ├── Models/              model Eloquent
│   │   ├── Notifications/       email transazionali
│   │   └── Services/            verifica email e notifiche account
│   ├── database/
│   │   ├── migrations/          struttura versionata del database
│   │   ├── factories/           dati usati esclusivamente nei test
│   │   └── seeders/
│   ├── routes/                  rotte API e OAuth
│   ├── tests/                   test Laravel
│   ├── Dockerfile               immagine di produzione
│   └── composer.json
├── compose.yaml                 PostgreSQL per lo sviluppo locale
├── compose.production.yaml      stack Docker completo opzionale
└── README.md
```

## Flussi principali

### Salvataggio di un movimento

```text
Componente React
  → frontend/src/lib/api.ts
  → POST /api/v1/transactions
  → Form Request Laravel
  → TransactionController
  → Transaction model
  → PostgreSQL
  → TransactionResource
  → risposta JSON
```

### Scansione di un documento

```text
Fotocamera o file
  → ottimizzazione dell’immagine
  → Tesseract.js
  → testo OCR
  → import-parser.ts
  → revisione dell’utente
  → importazione REST multipla
  → PostgreSQL
```

L’immagine viene analizzata nel browser; al backend vengono inviati soltanto i dati confermati del movimento.

## Requisiti per lo sviluppo

- Node.js 22 o superiore;
- npm 10 o superiore;
- PHP 8.3 o superiore;
- Composer 2;
- PostgreSQL 18 oppure Docker Desktop.

## Configurazione locale

### 1. Database PostgreSQL

Dalla cartella principale:

```bash
cp .env.example .env
```

Impostare una password locale robusta in `.env`, quindi avviare PostgreSQL:

```bash
docker compose up -d postgres
docker compose ps
```

La porta predefinita è disponibile soltanto su `127.0.0.1:5432`.

### 2. Backend Laravel

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Configurare in `backend/.env` gli stessi valori PostgreSQL utilizzati nel file `.env` principale:

```dotenv
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=centiva
DB_USERNAME=centiva
DB_PASSWORD=PASSWORD_LOCALE
```

Creare le tabelle e avviare l’API:

```bash
php artisan migrate
php artisan serve
```

Backend locale: `http://localhost:8000`

Health check: `http://localhost:8000/up`

### 3. Frontend React

In un secondo terminale:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Configurazione locale del frontend:

```dotenv
VITE_BACKEND_URL=http://localhost:8000
```

Frontend locale: `http://localhost:5173`

## Database

Le migration Laravel sono la fonte ufficiale della struttura del database. Non è necessario creare manualmente le tabelle tramite pgAdmin.

```bash
cd backend
php artisan migrate
```

Le tabelle principali utilizzate dall’interfaccia attuale sono:

- `users`;
- `sessions`;
- `password_reset_tokens`;
- `email_verification_codes`;
- `transactions`;
- `category_budgets`.

Le relazioni con l’utente usano chiavi esterne e cancellazione a cascata dove previsto. L’eliminazione dell’account rimuove i dati finanziari associati.

## Sicurezza

- autenticazione stateful tramite Laravel Sanctum;
- cookie di sessione HttpOnly;
- protezione CSRF sulle richieste che modificano dati;
- rigenerazione della sessione dopo il login;
- password cifrate da Laravel;
- limitazione dei tentativi sulle operazioni sensibili;
- validazione server-side tramite Form Request;
- query limitate all’utente autenticato;
- credenziali e chiavi conservate nelle variabili d’ambiente;
- `APP_DEBUG=false` in produzione.

Non inserire mai file `.env`, password, chiavi Google o chiavi Brevo nel repository Git.

## Verifica email e Brevo

Le notifiche transazionali utilizzano direttamente l’API HTTPS di Brevo.

Variabili necessarie sul backend:

```dotenv
BREVO_API_KEY=xkeysib-...
BREVO_API_URL=https://api.brevo.com
MAIL_FROM_ADDRESS=mittente-verificato@example.com
MAIL_FROM_NAME=Centiva
```

Requisiti Brevo:

- la chiave deve avere accesso alle email transazionali;
- il mittente deve essere verificato;
- se è attiva la protezione IP, gli indirizzi usati da Render devono essere autorizzati oppure il blocco deve essere disattivato per le chiavi API;
- dopo la modifica delle variabili su Render è necessario eseguire un nuovo deploy.

Il codice di verifica email:

- contiene 6 cifre;
- scade dopo 10 minuti;
- è monouso;
- viene salvato soltanto sotto forma di hash;
- viene invalidato dopo il numero massimo di tentativi previsto.

## Accesso con Google

Variabili necessarie sul backend:

```dotenv
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://centiva-api.onrender.com/auth/google/callback
FRONTEND_URL=https://centiva.vercel.app
```

Lo stesso URI di callback deve essere registrato nella configurazione del client OAuth sulla Google Cloud Console.

## Test e qualità

### Frontend

```bash
cd frontend
npm run lint
npm test -- --run
npm run build
```

I test frontend coprono parser OCR, riconoscimento importi, comando vocale e vista iniziale.

### Backend

```bash
cd backend
vendor/bin/pint --test
php artisan test
```

I test Laravel utilizzano un database SQLite temporaneo e non modificano PostgreSQL locale o di produzione.

## Deployment corrente

### Frontend su Vercel

Configurare il progetto con:

- Root Directory: `frontend`;
- Build Command: `npm run build`;
- Output Directory: `dist`;
- variabile `VITE_BACKEND_URL=/backend`.

Il file `frontend/vercel.json` inoltra `/backend/*` verso il servizio Laravel su Render.

### Backend su Render

Il servizio backend usa `backend/Dockerfile`. Lo script di avvio:

1. crea la cache di configurazione;
2. crea la cache delle rotte;
3. applica le migration con `php artisan migrate --force`;
4. avvia Laravel sulla porta assegnata da Render.

Variabili essenziali:

```dotenv
APP_NAME=Centiva
APP_ENV=production
APP_DEBUG=false
APP_KEY=base64:...
APP_URL=https://centiva-api.onrender.com
APP_TIMEZONE=Europe/Rome
FRONTEND_URL=https://centiva.vercel.app
FRONTEND_URLS=https://centiva.vercel.app
SANCTUM_STATEFUL_DOMAINS=centiva.vercel.app
SESSION_SECURE_COOKIE=true
DB_CONNECTION=pgsql
DB_HOST=...
DB_PORT=5432
DB_DATABASE=...
DB_USERNAME=...
DB_PASSWORD=...
```

Aggiungere inoltre le variabili Google e Brevo descritte nelle sezioni precedenti.

## Deployment Docker alternativo

Per eseguire l’intero stack su un unico server:

```bash
cp .env.production.example .env.production
docker compose --env-file .env.production -f compose.production.yaml up -d --build
```

L’applicazione viene esposta sulla porta `8080` per impostazione predefinita. PostgreSQL rimane nella rete Docker privata.

Aggiornamento:

```bash
docker compose --env-file .env.production -f compose.production.yaml up -d --build
```

Backup PostgreSQL:

```bash
docker compose --env-file .env.production -f compose.production.yaml exec -T postgres \
  pg_dump -U centiva centiva > centiva-backup.sql
```

Conservare i backup in uno spazio protetto e cifrato.

## Note sul codice legacy

Il repository contiene ancora model, migration e test relativi ai precedenti obiettivi di risparmio. Queste funzioni non sono attualmente esposte nella navigazione dell’app e non fanno parte dell’esperienza utente corrente.
