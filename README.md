# React + Vite + Node.js + Firebase

Fullstack applikasjon med React frontend, Node.js backend og Firebase database.

## Prosjektstruktur

```
├── client/          # React Vite frontend
│   ├── src/
│   │   ├── App.jsx
│   │   ├── firebase.js
│   │   └── ...
│   └── package.json
├── server/          # Node.js Express backend
│   ├── index.js
│   └── package.json
└── README.md
```

## Oppsett

### 1. Firebase-konfigurasjon

1. Gå til [Firebase Console](https://console.firebase.google.com/)
2. Opprett et nytt prosjekt eller bruk et eksisterende
3. Aktiver Firestore Database
4. Gå til Project Settings > General og finn Firebase-konfigurasjonen

### 2. Frontend (.env)

Opprett `client/.env` basert på `client/.env.example`:

```env
VITE_FIREBASE_API_KEY=din_api_key
VITE_FIREBASE_AUTH_DOMAIN=ditt_prosjekt.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ditt_prosjekt_id
VITE_FIREBASE_STORAGE_BUCKET=ditt_prosjekt.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=din_sender_id
VITE_FIREBASE_APP_ID=din_app_id
```

### 3. Backend (valgfritt)

For backend med Firebase Admin SDK:
1. Gå til Project Settings > Service Accounts
2. Generer en ny privat nøkkel
3. Opprett `server/.env` med service account JSON

## Kjøre prosjektet

### Frontend
```bash
cd client
npm install
npm run dev
```

### Backend
```bash
cd server
npm install
npm run dev
```

## Teknologier

- **Frontend:** React 18, Vite, Firebase SDK
- **Backend:** Node.js, Express, Firebase Admin SDK
- **Database:** Firebase Firestore
