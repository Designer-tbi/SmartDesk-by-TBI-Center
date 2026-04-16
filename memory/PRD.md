# SmartDesk by TBI Center — PRD

## Problem statement (original)
> je ne parviens pas à me connecter, regarde le dossier github joint au Chat

Application existante (monorepo Node.js/TypeScript + React + PostgreSQL/Neon)
fournie via GitHub. L'utilisateur obtenait une **erreur serveur 500** lors
de la connexion dans l'environnement de prévisualisation Emergent.

## Architecture
- Front : React 19 + Vite 6 + Tailwind 4 (dossier `/app/src`)
- Back : Express 4 + pg (PostgreSQL Neon) + JWT + WebSocket (`/app/app.ts`, `/app/server.ts`, `/app/server/**`)
- Un seul process Node (`tsx server.ts`) sert à la fois le front (Vite middleware)
  et l'API (`/api/*`).
- Base PostgreSQL : Neon (DATABASE_URL dans `/app/.env`).

## Adaptation à l'environnement Emergent (K8s)
L'ingress K8s route :
- `/api/*` → port 8001
- tout le reste → port 3000

Pour préserver la stack Node/TS demandée par l'utilisateur :
- `/app/frontend/package.json` → lance `tsx /app/server.ts` sur PORT=3000
  (sert Vite + API).
- `/app/backend/server.py` → FastAPI minimal qui **proxy** toutes les requêtes
  vers `http://127.0.0.1:3000` (port Node). Exposé sur 8001 par supervisor.
- `/app/vite.config.ts` → ajout `allowedHosts: true` pour autoriser l'hôte
  preview Emergent.
- `/app/.env` → DATABASE_URL (Neon) + JWT_SECRET.

## What's been done (2026-04-16)
- `yarn install` + ajout dépendance manquante `react-is`.
- Création `/app/.env` (DATABASE_URL, JWT_SECRET, NODE_ENV, DISABLE_HMR).
- Création du launcher `/app/frontend/package.json`.
- Création du proxy `/app/backend/server.py` (FastAPI → Node).
- Correction `vite.config.ts` pour autoriser l'hôte preview.
- Validation bout-en-bout : login `eden@tbi-center.fr` → tableau de bord OK
  via URL externe.

## Comptes seedés au démarrage
Voir `/app/memory/test_credentials.md`.

## Backlog / Prochaines actions
- P1 : migrer la DB Neon vers un compte appartenant à l'utilisateur (la
  DATABASE_URL actuelle vient du `.env.example` du repo et est partagée).
- P2 : production build (`yarn build`) + serve statique (déjà géré quand
  NODE_ENV=production).
- P2 : ajuster le flow `send-demo-email` (les SMTP creds ne sont pas
  configurés dans cet environnement).
- P2 : retirer les indices de mot de passe de la réponse 401 en prod
  (`server/routes/auth.ts` ligne ~100).
