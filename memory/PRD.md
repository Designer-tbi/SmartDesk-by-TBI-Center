# SmartDesk by TBI Center — PRD

## Problème initial
> je ne parviens pas à me connecter, regarde le dossier github joint au Chat

Dans un 2ᵉ temps :
> Créer les tables multi entreprise dans la base de donnée et séparer et isolé
> les donnée de chaque entreprise démo, et en production

## Architecture
- Front : React 19 + Vite 6 + Tailwind 4 (`/app/src`)
- Back : Express 4 + pg (PostgreSQL Neon) + JWT + WebSocket
  (`/app/app.ts`, `/app/server.ts`, `/app/server/**`)
- Un seul process Node (`tsx server.ts`) sert à la fois le front (Vite
  middleware) et l'API (`/api/*`).
- Base PostgreSQL : Neon.

## Adaptation à l'environnement Emergent (K8s)
- `/app/frontend/package.json` → lance `tsx /app/server.ts` sur PORT=3000.
- `/app/backend/server.py` → FastAPI qui proxy vers `127.0.0.1:3000` (port
  Node). Exposé sur 8001 par supervisor. Supprime `accept-encoding` du header
  amont pour éviter les doubles décodages gzip.
- `/app/vite.config.ts` → `allowedHosts: true` pour autoriser l'hôte preview.
- `/app/.env` → DATABASE_URL (Neon) + JWT_SECRET.

## Isolation multi-entreprise (2026-04-16)

### Couche base de données
- `/app/server/tenancy.ts` : module qui active `ENABLE/FORCE ROW LEVEL
  SECURITY` sur **20 tables tenant** (contacts, products, invoices,
  invoice_items, projects, employees, employee_tasks, transactions,
  journal_entries, journal_items, quote_templates, quote_template_items,
  leave_requests, payslips, contracts, contract_templates, roles,
  activity_log, events, schedules).
- Policy unique `tenant_isolation` (USING + WITH CHECK) :
  ```sql
  "companyId" = current_setting('app.current_company_id', true)
  OR current_setting('app.is_super_admin', true) = 'true'
  ```
- Variables de session posées au début de chaque requête HTTP par
  `dbMiddleware` via `set_config('app.current_company_id', …, false)`.
- Le contexte est **réinitialisé** au `release` du client (empêche toute fuite
  entre deux requêtes pooled).

### Couche applicative
- `dbMiddleware` décode le JWT **avant** l'auth pour détecter le `companyId`
  et le rôle super_admin (override via header `x-company-id` ou query
  `?companyId=`).
- Fix de fuite : `server/routes/events.ts` n'ajoutait plus `companyId` ni ne
  filtrait par tenant → corrigé sur GET/POST/PUT/DELETE.
- Route `/api/auth/send-demo-email` et `/api/admin/companies` : setting de
  `app.current_company_id` avant `seedDefaultRoles` (sinon les INSERTs dans
  `roles` sont rejetés par WITH CHECK).
- `seedDatabase` utilise un client dédié avec `app.is_super_admin = 'true'`
  pour bypasser RLS pendant l'initialisation.

### Données démo isolées
- `seedDemoCompanyData(companyId, label)` : crée 2 contacts, 2 produits et 1
  facture **par** société démo (demo-1 TechCorp, demo-2 GreenEnergy).
- Chaque société démo a son propre utilisateur admin :
  - `admin@smartdesk.cg` → demo-1
  - `admin@greenenergy.demo` → demo-2

### Endpoints admin
- `GET /api/admin/stats` retourne désormais `realCompanies`, `demoCompanies`,
  `totalUsers`, `realUsers`, `demoUsers`.
- `GET /api/admin/companies/by-type` retourne `{ real: [...], demo: [...] }`
  pour un affichage séparé démo / production.

### Tests d'isolation validés
- ✅ Demo-1 liste UNIQUEMENT ses contacts (même ID de contact `cnt_1_demo-1`
  distinct de `cnt_1_demo-2`).
- ✅ UPDATE/DELETE cross-tenant = 0 lignes affectées.
- ✅ Spoofing `companyId=demo-2` dans le body : la route force
  `req.user.companyId` → enregistré côté demo-1 uniquement.
- ✅ Super admin voit toutes les sociétés via `/api/admin/companies`.

## Comptes
Voir `/app/memory/test_credentials.md`.

## Backlog / Prochaines actions
- P1 : migrer la DB Neon vers un compte propriétaire (la DATABASE_URL
  actuelle vient de `.env.example` — partagée).
- P2 : build de prod (`yarn build`) + serve statique.
- P2 : ajouter un toggle dans l'UI super-admin pour "impersonate" une société
  (utilise déjà `x-company-id`).
- P2 : audit périodique des permissions RLS (script qui vérifie qu'aucune
  nouvelle table sensible n'oublie d'activer RLS).
- P2 : retirer les indices de mot de passe des erreurs 401 en production
  (`server/routes/auth.ts` ligne ~100).
