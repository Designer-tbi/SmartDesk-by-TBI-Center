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

## Réactivité des libellés régionaux (2026-04-17 — iteration 3)

Bug : après changement du pays dans Paramètres, le formulaire CRM « Nouveau
contact » continuait à afficher les anciens libellés (NIU au lieu de TVA,
etc.) jusqu'à un F5.

### Fixes appliqués
1. Backend `/api/auth/me` (`/app/server/routes/auth.ts`) : charge à nouveau
   `country` et `state` depuis la société à chaque appel (plus seulement
   `language`/`currency`). Les infos régionales ne sont donc plus figées
   par le JWT.
2. Frontend `Settings.tsx` `handleCompanySubmit` : propagation de
   `country` dans `setGlobalUser` (pas seulement `currency`/`language`).
3. Frontend `CRM.tsx` : `resolveLocale` utilise en priorité
   `selectedCompany.country` (source de vérité rafraîchie à chaque
   navigation) avec repli sur `user.country`.
4. Frontend `lib/locale.ts` : ajout des clés régionales grossières
   utilisées par le sélecteur UI (`EUROPE`, `AFRIQUE`, `USA`,
   `CONTINENT`) pour qu'elles aient des placeholders TVA / NIF / EIN
   corrects au lieu du fallback générique « ID fiscal ».

Validé end-to-end via Playwright (login → Settings EUROPE → CRM shows
TVA + `+33` ; login → Settings CONGO → CRM shows NIU + `+242`).

## Détection automatique du pays via IP (2026-04-17 — iteration 4)

### Backend
- Nouvelle route publique `GET /api/auth/geolocate` (`/app/server/routes/auth.ts`).
  Résolution :
  1. Entêtes edge `x-vercel-ip-country` / `cf-ipcountry` (zéro latence).
  2. Repli `ip-api.com` (gratuit, sans clé) pour les déploiements hors
     Vercel/Cloudflare.
  3. Défaut `FR`.

### Frontend
- Nouveau helper `/app/src/lib/geo.ts` :
  - `fetchDetectedCountry()` → ISO-2 côté client.
  - `mapIsoToRegion()` → bucket `CONGO / AFRIQUE / EUROPE / USA / CONTINENT`
    pour alimenter le sélecteur Paramètres.
- `/app/src/modules/Login.tsx` : lors de l'ouverture du formulaire de
  demande d'accès démo, le pays est pré-rempli depuis l'IP (sans écraser
  un choix explicite de l'utilisateur).
- `/app/src/modules/Settings.tsx` : bouton « Auto-détecter (IP) » à côté
  du champ Continent / Région. Applique également des valeurs par
  défaut cohérentes de devise + standard comptable (OHADA/XAF pour
  l'Afrique, Europe/EUR/FRANCE, USA/USD/US_GAAP).
- Feedback visuel : `IP détectée : US → USA` (vert, auto-hide 4 s).

## Auto-configuration étendue : langue + comptabilité (2026-04-17 — iteration 5)

### Backend (`/app/server/routes/auth.ts`)
- Nouveau helper `regionalDefaultsFromCountry(iso)` qui dérive :
  - `currency` : XAF (CEMAC), XOF (UEMOA), EUR, GBP, USD, CAD…
  - `accountingStandard` : OHADA, FRANCE, US_GAAP.
  - `language` : fr / en (pays francophones vs anglophones).
- `GET /api/auth/geolocate` renvoie désormais `{ country, language, currency, accountingStandard, source }`.
- `POST /api/auth/send-demo-email` (création compte démo) insère déjà
  la société avec les bons défauts (`language`, `currency`,
  `"accountingStandard"`) selon le pays — plus besoin de les configurer
  manuellement après inscription.

### Frontend
- `/app/src/lib/geo.ts` : nouveau `fetchDetectedLocale()` qui retourne
  tous les défauts régionaux. `fetchDetectedCountry()` conservé (compat).
- `/app/src/modules/Login.tsx` : auto-pré-sélection de la langue UI
  (fr/en) dès le chargement, basée sur l'IP.
- `/app/src/modules/Settings.tsx` :
  - Le bouton « Auto-détecter (IP) » applique en un clic **pays + devise
    + standard comptable + langue UI**.
  - Bug fix : `useEffect` de chargement initial ne dépend plus de `t` →
    ne réécrase plus les valeurs fraîchement auto-détectées lors du
    changement de langue.
  - Badge de confirmation enrichi : `IP détectée : US · → USA · USD · US_GAAP`.

### Validé
Playwright : clic « Auto-détecter » depuis une IP US → les 4 selects
passent à USA / US_GAAP / English / USD et tous les libellés UI se
mettent en anglais instantanément.

## NIU (Numéro d'Identification Unique) sur les sociétés (2026-04-17 — iteration 6)

### DB (`/app/db.ts`)
- Colonne `niu TEXT` ajoutée à `companies` (CREATE TABLE + ALTER
  idempotent).
- Schema version bumpée à `2026-04-17-company-niu` (fast-path de cold
  start mis à jour).

### Backend
- `/app/server/routes/company.ts` : `PUT /api/company` accepte et
  persiste `niu`. `GET` renvoie `niu` dans la réponse (SELECT *).

### Frontend
- `/app/src/types.ts` : `CompanyInfo.niu` ajouté.
- `/app/src/modules/Settings.tsx` : nouveaux champs **NIU** et **ID NAT**
  dans le formulaire entreprise (région CONGO/AFRIQUE), avec
  placeholders et data-testid.
- `/app/src/modules/Accounting.tsx` :
  - NIU affiché dans le bloc « Informations de l'entreprise » de la
    Liasse fiscale (uniquement pour les standards OHADA).
  - NIU inclus dans le PDF généré (ligne 185).
- `/app/src/modules/Sales.tsx` : NIU affiché sous ID NAT dans l'entête
  de la facture.
- `/app/src/lib/i18n.tsx` : clés `settings.niu` et `accounting.niu`
  (FR + EN).

### Validé
- `PUT /api/company { niu }` persiste ; `GET /api/company` renvoie
  correctement la valeur.
- Formulaire Settings affiche NIU + ID NAT, sauvegarde fonctionnelle.
- Accounting / Liasse fiscale affiche le NIU sous « Unique Taxpayer ID ».

## Backlog / Prochaines actions
- P1 : migrer la DB Neon vers un compte propriétaire (DATABASE_URL vient de
  `.env.example` — partagée avec la preview).
- P1 : déployer sur Vercel (user doit push via « Save to Github »).
- P2 : build de prod (`yarn build`) + serve statique.
- P2 : UI super-admin "Impersonate" société (utilise déjà `x-company-id` +
  `selectedCompanyId` dans user.preferences).
- P2 : rate-limit sur `/api/auth/login` (brute force).
- P2 : retirer les indices de mot de passe des erreurs 401 en production.
