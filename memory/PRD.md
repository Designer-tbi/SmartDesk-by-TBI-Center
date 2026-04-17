# SmartDesk by TBI Center — PRD

## Problème initial
> je ne parviens pas à me connecter, regarde le dossier github joint au Chat

Puis trois itérations successives :
1. Créer les tables multi entreprise + séparer et isoler les données démo / prod
2. Ajouter des sections repliables dans le menu de navigation
3. Ajouter une section « Mes déclarations » (DGID, CNSS, INS, Greffe)
4. Supprimer le stockage local et utiliser uniquement la base Neon

## Architecture
- Front : React 19 + Vite 6 + Tailwind 4 (`/app/src`)
- Back : Express 4 + pg (PostgreSQL Neon) + JWT + cookieParser + WebSocket
  (`/app/app.ts`, `/app/server.ts`, `/app/server/**`)
- Un seul process Node (`tsx server.ts`) sert à la fois le front (Vite
  middleware) et l'API (`/api/*`).
- Base PostgreSQL : Neon.

## Adaptation à l'environnement Emergent (K8s)
- `/app/frontend/package.json` → lance `tsx /app/server.ts` sur PORT=3000.
- `/app/backend/server.py` → FastAPI qui proxy vers `127.0.0.1:3000`. **Un
  client httpx frais par requête** pour éviter toute fuite de cookie entre
  utilisateurs (fix de sécurité critique appliqué iteration 2).
- `/app/vite.config.ts` → `allowedHosts: true` pour l'hôte preview.
- `/app/.env` → DATABASE_URL (Neon) + JWT_SECRET.

## Isolation multi-entreprise (2026-04-16)

### Couche base de données
- `/app/server/tenancy.ts` : active RLS sur **20 tables tenant**.
- Policy `tenant_isolation` (USING + WITH CHECK) :
  `"companyId" = current_setting('app.current_company_id') OR current_setting('app.is_super_admin') = 'true'`.
- Variables de session posées au début de chaque requête par `dbMiddleware`.
- Contexte **réinitialisé** au release du client pool.

### Couche applicative
- Fix de fuite `server/routes/events.ts` (companyId manquant).
- Fast-path schema (`_app_meta.schema_version`) pour skip les DDL sur cold start.
- `seedDemoCompanyData(companyId, label)` crée contacts/produits/factures
  pour demo-1 (TechCorp) et demo-2 (GreenEnergy) séparément.

## Menu de navigation (2026-04-16)
- Sections repliables (chevron ↓/→), animations (max-height + opacity).
- Nouvelle section `MES DÉCLARATIONS` avec 6 sous-items :
  Tableau de bord, Calendrier, DGID, CNSS, INS, Greffe.
- Module placeholder `/app/src/modules/Declarations.tsx` avec sous-routes.

## Migration localStorage → DB + cookie HttpOnly (2026-04-17)

### Auth : cookie HttpOnly au lieu de localStorage
- `/api/auth/login` pose `smartdesk_session` (HttpOnly, SameSite=Lax, 24h).
- Nouveau `/api/auth/logout` (POST) efface cookie + session en DB.
- `requireAuth` lit d'abord le cookie, puis fallback `Authorization: Bearer`
  pour les clients non-navigateur (curl, tests).
- `cookie-parser` ajouté comme middleware Express.

### Préférences utilisateur en DB
- Colonne `users.preferences JSONB` (schema_version `2026-04-17-prefs`).
- Nouvelle route `PUT /api/auth/preferences` (shallow merge via `jsonb ||`).
- `/api/auth/me` retourne désormais aussi `preferences`.

### Frontend (suppression 100% du localStorage)
- `/app/src/lib/api.ts` — `apiFetch` utilise `credentials: 'include'` et une
  session in-memory (`setApiSession`/`clearApiSession`).
- `/app/src/App.tsx` — `logout` appelle `POST /api/auth/logout`.
- `/app/src/modules/Login.tsx` — `fetch` avec `credentials:'include'`,
  plus jamais de token stocké côté client.
- `/app/src/lib/i18n.tsx` — `setLanguage` persiste via `PUT /api/auth/preferences`.
- `/app/src/components/layout/Header.tsx` — `selectedCompanyId` (super-admin)
  lu/écrit depuis `user.preferences`.
- `/app/src/components/layout/Sidebar.tsx` — `collapsedSections` lu/écrit
  depuis `user.preferences.sidebarCollapsedSections`.
- `/app/src/modules/Settings.tsx` + `ErrorBoundary.tsx` — logout via API.
- `grep -rn 'localStorage' /app/src` → **0 occurrence**.

### Fix de sécurité critique (2026-04-17 — iteration 2)
- `/app/backend/server.py` — remplacement du client httpx partagé par un
  `async with httpx.AsyncClient(...)` par requête. Évite qu'un cookie
  `Set-Cookie` de l'utilisateur A ne soit envoyé avec la prochaine requête
  de l'utilisateur B (cookie jar partagé).

## Comptes
Voir `/app/memory/test_credentials.md`.

## Tests automatisés
- `/app/backend/tests/test_smartdesk_api.py` — auth, RLS, cross-tenant, admin.
- `/app/backend/tests/test_cookie_auth_migration.py` — cookie flow + prefs.
- 15/15 tests backend + tous les flux frontend validés (iteration 2).

## Backlog / Prochaines actions
- P1 : migrer la DB Neon vers un compte propriétaire (DATABASE_URL vient de
  `.env.example` — partagée avec la preview).
- P1 : déployer sur Vercel (user doit push via « Save to Github »).
- P2 : build de prod (`yarn build`) + serve statique.
- P2 : UI super-admin "Impersonate" société (utilise déjà `x-company-id` +
  `selectedCompanyId` dans user.preferences).
- P2 : rate-limit sur `/api/auth/login` (brute force).
- P2 : retirer les indices de mot de passe des erreurs 401 en production.
