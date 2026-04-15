# Prosjektoversikt

Samlet oversikt over hva som ligger i repoet: arkitektur, hovedfunksjoner, ruter og konfigurasjon.

## Hva prosjektet er

En fullstack jobb-/nettverks-/magasin-app:

| Del | Teknologi / formål |
|-----|---------------------|
| **Frontend** | React 18 + Vite, React Router, Firebase SDK (auth + Firestore) |
| **Backend** | Node.js + Express + Firebase Admin (verifisering av ID-token, Firestore fra server) |
| **AI (bedrift)** | Node proxyer til **Python (FastAPI)** med lokale embeddings (`sentence-transformers`), RAG-bygging i `server/rag.js` |
| **Database / auth** | Firebase (Firestore, regler i `firestore.rules`, indekser i `firestore.indexes.json`, storage i `storage.rules`) |
| **Deploy (frontend)** | Netlify (`netlify.toml`) — bygger `client/`, SPA-redirects |

Rot-`package.json` beskriver prosjektet som «React + Vite + Node.js + Firebase» med script for `dev` (client), `dev:server`, og Firebase-deploy av Firestore-regler.

## Brukertyper og hovedflyt

- **Jobbsøker** (`jobseeker`): eget bruker-dashboard, offentlig profil og CV-side, søk, meldinger, referanser m.m.
- **Bedrift** (`company`): bedrifts-dashboard, redigering av bedriftsprofil, offentlig bedriftsside, **bedrifts-AI** (krever konfigurasjon og kvote — se server).
- **Utblikk (magasin)**: roller `journalist` / `editor` i Firestore (`newspaperRole`) gir tilgang til redaksjons-dashboard og artikkelredigering; alle kan lese forsiden og enkeltartikler.
- **Admin**: egne ruter `/admin` og `/admin/dashboard` (utenom vanlig «beskyttet brukertype»-mønster i `App.jsx`).

## Viktigste ruter (`client/src/App.jsx`)

- **Offentlig**: `/` (landing eller redirect til dashboard), `/login`, `/register`, `/jobs`, `/sok`, `/priser`
- **Profiler**: `/bedrift/:companyId`, `/profil/:userId`, `/profil/:userId/cv`, `/profil/me`, `/profil/me/cv`
- **Innlogget**: `/meldinger`, `/meldinger/:conversationId`
- **Utblikk**: `/utblikk`, `/utblikk/sak/:slug`, `/utblikk/redaksjon`, `/utblikk/rediger/:articleId` (sistnevnte krever journalist/redaktør)
- **Dashboards**: `/dashboard/company`, `/dashboard/company/profil`, `/dashboard/user`
- **Admin**: `/admin`, `/admin/dashboard`
- **Alias**: `/jobbposten` → `/utblikk`

`ChatDock` ligger globalt i layout (meldinger tilgjengelig som dock).

## Backend (Express)

- **Firebase Admin** ved oppstart hvis service account er satt (`server/loadServiceAccount.js`).
- **Middleware**: `requireUser` (Bearer ID-token), `requireCompanyForAi` (kun bedrift for AI).
- **API**:
  - `GET /api/ai/status` — kvote/status for bedrifts-AI
  - `POST /api/ai` — handlinger `jobPosting` og `rankApplicants` (videre til Python via `PYTHON_AI_URL`, med valgfri RAG-kontekst)
  - `GET /api/health`
  - Eksempel-CRUD på `items` (mal/legacy)

## Python `ai-service`

- FastAPI-app med **lokale embeddings** (standard modell via `EMBED_MODEL`), **ingen sky-LLM** i denne tjenesten ifølge kommentarer i `ai-service/main.py`.
- Brukes av Node for rangering av søkere og stillingsannonse-generering (strukturert).
- **Modellkilde og attribusjon** (Hugging Face, lisens, sitat): se [`docs/MODEL_ATTRIBUTION.md`](MODEL_ATTRIBUTION.md).

## Frontend — hovedmapper

- **Sider**: `client/src/pages/` (landing, dashboards, magasin, chat, søk, priser, admin, offentlige profiler).
- **Komponenter**: `client/src/components/` (navbar, søk, chat-dock, modaler, referanser, jobb-bibliotek, cover letters, varsler, osv.).
- **Tjenester**: `client/src/services/` (Firestore-abstraksjoner: chat, sosialt, magasin, AI-API mot backend, bedrift, referanser, osv.).
- **Styling**: per-side/per-komponent CSS under `client/src/styles/`, pluss `theme.js`, `theme-dark.css`, `index.css`.

## Konfigurasjon

- `client/.env` — Firebase web-config (se `client/.env.example`).
- `server/.env` — service account, `PYTHON_AI_URL`, ev. `PYTHON_AI_SECRET`, embeddings-nøkkel for RAG der det er relevant (se `server/.env.example` og `server/rag.js`).
- `firebase.json`, `.firebaserc` — Firebase-prosjekt og regler/hosting etter behov.

## Eksisterende README

`README.md` i rot dekker **grunnoppsett** (Firebase, `.env`, kjøre client/server) og en enkel mappestruktur. Denne filen (`docs/PROSJEKTOVERSIKT.md`) supplerer med funksjons- og arkitekturoversikt.
