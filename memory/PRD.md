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

## Modèles de contrats RH dynamiques (2026-04-17 — iteration 7)

### Fichiers créés
- `/app/src/lib/contractTemplates.ts` : 4 modèles déclaratifs (CDD, CDI,
  Mission/Intérim, Prestation indépendant). Chaque modèle définit
  parties, articles avec variables typées (`text`/`textarea`/`date`/
  `number`) et option `extensible` pour ajouter du texte libre par
  article. Fonction `renderContract()` qui génère le markdown final.
- `/app/src/components/ContractBuilder.tsx` : composant réutilisable
  qui affiche :
  - Picker visuel des 4 modèles (cartes cliquables).
  - Formulaire dynamique généré depuis les variables du modèle choisi.
  - Auto-remplissage via un `autofillContext` (nom société, employé,
    salaire, date de début, ville…).
  - Textarea « Texte additionnel » pour chaque article extensible.
  - Aperçu en temps réel du contrat généré (toggle on/off).

### `/app/src/modules/HR.tsx`
- Modal « Nouveau Contrat » refondue :
  - Champs métadonnées (Employé / Date début / Salaire) conservés.
  - `ContractBuilder` remplace l'ancienne textarea mono-bloc.
  - `onChange` du builder synchronise `newContract.type` +
    `newContract.content` (markdown rendu).
- `companyInfo` chargé via `/api/company` pour alimenter l'autofill
  (nom entreprise, adresse…).
- Bouton "Créer brouillon" désactivé tant que `content` et `employeeId`
  manquent.

### Validé
- Picker affiche les 4 modèles. Clic CDI → formulaire dynamique avec 6
  articles. Remplissage du poste « Développeur Full-Stack » et salaire
  500 000 → aperçu contient :
  `**CONTRAT DE TRAVAIL À DURÉE INDÉTERMINÉE (CDI)**`
  `Entre : TechCorp Demo …Développeur Full-Stack… 500000 FCFA`.

## Certification DGID des factures (2026-04-17 — iteration 8)

Intégration (mode démo uniquement) d'une API de certification des
factures (DGID Congo / SIGICITT). La clé API par défaut est isolée par
entreprise via `companies.fiscalizationApiKey` — chaque société démo
reçoit automatiquement cette clé à sa création.

### DB (`/app/db.ts`)
- `companies.fiscalizationApiKey TEXT`.
- `invoices.certificationNumber TEXT`.
- `invoices.certifiedAt TIMESTAMPTZ`.
- `invoices.certificationStatus TEXT` (`certified` / `failed` / `pending`).
- `invoices.certificationPayload JSONB` (source + QR payload).
- Migration automatique : toute société `type='demo'` existante sans
  clé reçoit la clé par défaut. Nouvelle schema_version
  `2026-04-17-invoice-certif`.
- Clé par défaut injectable via `process.env.DGID_DEMO_API_KEY`
  (fallback hardcodé : `97ecc28…943c`).

### Backend
- `/app/server/services/fiscalization.ts` : appel HTTP vers
  `DGID_API_URL` avec bearer / `X-Api-Key`, timeout 4 s. En cas
  d'échec ou d'absence d'URL, fallback déterministe **signature
  locale** (HMAC-SHA256 de la clé + payload facture), certificat
  format `DGID-YYMMDD-HHMM-XXXXXXXXXX`.
- `/app/server/routes/invoices.ts` :
  - Auto-certification sur `POST /api/invoices` (type `Invoice`,
    société démo, clé présente). Échec non bloquant.
  - `POST /api/invoices/:id/certify` : certification manuelle /
    re-certification (demo-only, 403 sinon).
- `/app/server/routes/auth.ts` :
  - `POST /api/auth/send-demo-email` : seed de la clé à la création.
  - `/api/auth/me` et login renvoient `companyType` pour que la UI
    affiche (ou pas) le bloc de certification.
- `/app/server/routes/admin.ts` : lors de la création/édition d'une
  société depuis super-admin, la clé est ajoutée si type=demo, sinon
  effacée.

### Frontend
- Nouveau paquet `qrcode.react` installé.
- `/app/src/types.ts` : `Invoice.certificationNumber`, `certifiedAt`,
  `certificationStatus`, `certificationPayload`.
- `/app/src/modules/Sales.tsx` :
  - Bloc « Certification DGID » dans l'aperçu de facture, affichant
    QR code, numéro, horodatage, source (API réelle vs signature locale).
  - Bouton « Certifier maintenant » / « Re-certifier » (démo only).
  - `handleCertify()` appelle l'endpoint, met à jour liste + vue.

### Validé
- `POST /api/invoices` crée + certifie automatiquement une facture
  démo → renvoie `certificationNumber: DGID-…`.
- `POST /api/invoices/:id/certify` re-certifie avec un nouveau
  numéro.
- Aperçu affiche QR + N° de cert + badge « Document fiscalement
  authentifié » correctement (screenshot validé).

## SFEC API officielle + verrou + PDF + Auth Context (2026-04-29 — iteration 9)

### Intégration SFEC réelle (sandbox.akieni.tech)
Suite à l'analyse du *Guide d'intégration SFEC v1.2.1* :
- Endpoint : `POST {DGID_API_URL}/invoices/report/api`.
- Auth : header `X-API-Key`.
- `DGID_API_URL=https://sandbox-pgsfec.akieni.tech/api` ajouté dans `.env`.
- `regionalDefaultsFromCountry` non concerné — la clé est par
  entreprise.
- Payload reconstruit selon spec : `invoice_id`, `recipient_type` (mappé
  depuis `contactType` particulier→individual / professionnel→business),
  `is_recipient_taxable`, items normalisés (`type`, `designation`,
  `unit_price`, `quantity`, `subtotal`, `discount_*`, `net_amount`,
  `tax_rate`, `tax_amount`, `total_amount`), totaux globaux.
- Acceptation de HTTP 200/201 ; champs response tolérants
  (`certification_number` ou `sfec_certification_number`,
  `signature` ou `certification_signature`, etc.).
- 4xx (données invalides) : remontés à l'utilisateur (pas de retry).
- 5xx / timeout / pas d'URL : fallback signature locale HMAC-SHA256.

Le QR officiel renvoyé par SFEC (`qr_code: data:image/png;base64,…`)
est désormais persisté dans `certificationPayload.qrImage` et affiché
tel quel par le frontend. La signature longue/courte sont également
stockées.

### Verrouillage des factures certifiées
- Backend `PUT /api/invoices/:id` : si `certificationNumber` est défini,
  seul `status` peut évoluer (vers `Paid`, `Overdue`, `Sent`). Toute
  autre modification → 409 `Cette facture a été certifiée DGID...`.
- Backend `DELETE /api/invoices/:id` : 409 si certifiée.
- Frontend `Sales.tsx` : boutons « Modifier » et « Supprimer » désactivés
  visuellement (opacity 30 %) avec tooltip explicatif sur les factures
  certifiées, dans la liste ET dans la modale d'aperçu.

### Téléchargement PDF avec QR
- Nouvelle route `GET /api/invoices/:id/pdf` : génère le PDF complet
  via jsPDF + jspdf-autotable, embarque le QR officiel SFEC (ou le QR
  local de fallback) avec N°, horodatage, source.
- Bouton « PDF » ajouté dans la modale d'aperçu, déclenche un
  téléchargement Blob côté client.
- Package `qrcode` (Node) installé pour générer les data-URLs côté
  serveur quand l'API SFEC ne retourne pas de QR.

### Auth Context global
- `/app/src/lib/AuthContext.tsx` : `AuthProvider` + hook `useAuth()`
  exposant `{ user, setUser, company, refreshUser, refreshCompany }`.
- `/app/src/App.tsx` : `<AuthProvider>` wrap autour des routes.
- `/app/src/modules/Sales.tsx` : refacto pour consommer `useAuth()`
  comme source unique de `companyInfo`. Évite les fetchs `/api/company`
  redondants et garantit la cohérence avec Settings.

### Validé
- `POST /api/invoices` retourne `source: 'sfec'`, `qrImage` (5-6 KB
  base64) + `signature` 64 caractères → confirmation que l'API SFEC
  sandbox répond bien.
- PUT édition complète sur facture certifiée → 409.
- PUT statut `Paid` sur facture certifiée → 200.
- DELETE facture certifiée → 409.
- `GET /api/invoices/:id/pdf` → 210 KB téléchargés.
- Aperçu UI : QR officiel SFEC affiché (img tag), bouton Modifier
  désactivé, bouton PDF présent, label « API SFEC (DGID Congo) ».

## 4 types de contacts SFEC (2026-04-29 — iteration 10)

Extension du formulaire CRM pour couvrir les 4 types de bénéficiaires
définis par la spec SFEC : `individual` / `business` / `government` /
`foreign`.

### DB
- `contacts.foreignCountry TEXT` (pays d'origine pour les sociétés
  étrangères).
- `contacts.contactType` accepte désormais 4 valeurs.
- Migration idempotente (`schema_version=2026-04-29-contact-types`).

### Backend
- `/app/server/routes/contacts.ts` : refactor avec normalisation stricte
  des 4 types valides, persistance de `foreignCountry` (POST + PUT +
  GET).
- `/app/server/services/fiscalization.ts` : `recipientType` mappé
  correctement (particulier→individual, professionnel→business,
  gouvernement→government, etranger→foreign). `is_recipient_taxable`
  étendu aux entités gouvernementales. NIU/email/address/phone passés
  pour tous les types non-individuels.
- `/app/server/routes/invoices.ts` : SELECT ajouté `foreignCountry`
  dans les fetch buyer (création + re-certification).

### Frontend
- `/app/src/types.ts` : `Contact.contactType` étendu, `foreignCountry`
  ajouté.
- `/app/src/modules/CRM.tsx` :
  - Toggle 2 → 4 boutons (UserCircle / Building2 / Landmark / Plane).
  - Champ « Country of origin » conditionnel (etranger only).
  - Labels adaptés par type (Department/Division pour gouvernement,
    Ministry / Foreign company / etc.).
  - NIU obligatoire pour business + gouvernement (CEMAC), libellé
    « Foreign tax ID » pour étranger.
  - Liste : badges colorisés (4 couleurs) + icône avion pour les
    contacts étrangers, indication du pays.
- `/app/src/lib/i18n.tsx` : 7 nouvelles clés FR + EN.

### Validé
- POST `/api/contacts` accepte `etranger` + `foreignCountry=France`.
- POST `/api/contacts` accepte `gouvernement`.
- Auto-certification SFEC d'une facture vers un contact étranger :
  source=sfec, certNumber valide, qrImage présent.
- Idem pour gouvernement.
- Toggle UI affiche bien les 4 types et adapte les labels en direct.

## Onboarding wizard 1ère connexion + RDC + clé SFEC isolée (2026-04-29 — iter 11)

### Backend
- DB : nouvelles colonnes `companies.onboardingCompleted BOOLEAN DEFAULT TRUE`,
  `companies.city TEXT`. Schema_version `2026-04-29-onboarding`.
- `regionalDefaultsFromCountry` : ajout de la RDC (`CD/RDC` → CDF + OHADA + fr).
- `/api/auth/send-demo-email` : nouveaux comptes démo créés avec
  `onboardingCompleted=false` et **sans clé SFEC** (forçant le wizard
  au premier login).
- `/api/auth/login` et `/api/auth/me` exposent désormais
  `onboardingCompleted`, `hasFiscalizationKey`, `city` (SELECT élargis
  pour récupérer ces champs).
- Nouveau `POST /api/company/onboarding` : valide la clé (≥16 chars),
  persiste country/city/currency/standard/language/key et marque
  `onboardingCompleted=true`.
- `GET /api/company` ne renvoie plus la clé brute, juste un flag
  `hasFiscalizationKey` (sécurité).
- `PUT /api/company` : ajout du champ `city`.

### Frontend
- `/app/src/lib/locale.ts` : entrées spécifiques `FR`, `FRANCE`, `CD`,
  `RDC` (placeholders TVA / ID NAT, téléphones +33 / +243).
- `/app/src/components/OnboardingWizard.tsx` : modal 2 étapes — pays
  (3 cartes France / Congo / RDC) + bouton « Auto-détecter (IP) » +
  ville (datalist autocomplete) + clé API SFEC masquée + récap +
  bouton « Activer mon espace ».
- `/app/src/App.tsx` : monte le wizard (z-60) lorsque
  `user.onboardingCompleted === false`.
- `/app/src/modules/Settings.tsx` : ajout des 3 options pays
  spécifiques (🇫🇷 France / 🇨🇬 Congo / 🇨🇩 RDC) en haut du sélecteur,
  séparées des buckets régionaux historiques.

### Validé
- Connexion d'une démo `onboardingCompleted=false` → modal s'affiche.
- Sélection « République du Congo » → ville auto-suggérée Brazzaville.
- Saisie clé SFEC + clic « Activer » → persistance OK + modal disparaît.
- Création de facture après onboarding → `source: sfec`, certification
  réussie avec la clé fournie par l'utilisateur (testé via curl).
- `/api/auth/login` post-onboarding : `onboardingCompleted=true`,
  `hasFiscalizationKey=true`, `city=Brazzaville`, `country=CG`.

## Sidebar conditionnelle par pays (2026-04-29 — iter 12)

La section « Mes déclarations » et toutes ses sous-rubriques (Tableau
de bord, Calendrier, DGID, CNSS, INS, Greffe) sont des modules
spécifiques au Congo-Brazzaville. Ils sont désormais masqués pour les
utilisateurs France et RDC.

### Frontend
- `/app/src/components/layout/Sidebar.tsx` : la section
  `declarations` n'est ajoutée à `navSections` que lorsque
  `user.country === 'CG'` (ou la valeur historique `CONGO`).
- `/app/src/App.tsx` : la route `/declarations/*` n'est montée
  que pour les pays Congo. Les utilisateurs FR/RDC qui tenteraient
  d'y accéder par URL directe tombent sur le fallback 404 du Router.

### Validé
- Login démo en `country=CG` : section « Mes déclarations » visible
  avec les 6 sous-rubriques.
- Bascule en `country=FR` via Settings → la section disparaît
  immédiatement de la sidebar (DGID/CNSS/INS/Greffe absents).
- Restauration en `country=CG` : section réapparaît.

## Backlog / Prochaines actions
- P1 : migrer la DB Neon vers un compte propriétaire (DATABASE_URL vient de
  `.env.example` — partagée avec la preview).
- P1 : déployer sur Vercel (user doit push via « Save to Github »).
- P2 : build de prod (`yarn build`) + serve statique.
- P2 : UI super-admin "Impersonate" société (utilise déjà `x-company-id` +
  `selectedCompanyId` dans user.preferences).
- P2 : rate-limit sur `/api/auth/login` (brute force).
- P2 : retirer les indices de mot de passe des erreurs 401 en production.

## Bug fix : boutons « Nouvelle Demande » (congés) & « Générer les Bulletins » (paie) (2026-05-04 — iter 23)

Les deux boutons existaient visuellement dans l'interface RH mais
**n'avaient aucun `onClick`** — ce n'étaient que des placeholders
décoratifs. Implémentation complète de la chaîne.

### Congés (`LeaveRequest`)
- `openLeaveModal` + `handleSubmitLeave` + nouvelle modale
  `[data-testid="hr-leave-modal"]` avec :
  - Sélecteur employé (obligatoire).
  - Type : Congé annuel / maladie / maternité / sans solde /
    permission exceptionnelle.
  - Dates début/fin avec validation (fin ≥ début).
  - Motif libre.
- Appel POST `/api/employees/leaves` avec gestion d'erreur inline
  + fermeture modale + refetch après succès.

### Paie (`Payslip`)
- `handleGeneratePayroll` + modale
  `[data-testid="hr-payroll-modal"]` avec sélection mois / année.
- **Calcul automatique Congo OHADA** via `computeCongoPayroll(base)` :
  - **CNSS salarié 4 %** (employeur 16 % à charge de l'entreprise).
  - **IRPP barème mensuel 2025** : tranches progressives
    54 166 / 125 000 / 291 666 / 500 000 / ∞ aux taux
    0 / 8 / 15 / 20 / 40 %.
  - Net = brut − CNSS − IRPP.
- Skip automatique des employés déjà payés pour la même période
  (évite les doublons).
- Source du salaire : contrat actif le plus récent (CDI/CDD
  `Signed`/`Active`) en priorité, sinon `employee.salary`.

### Validé (Playwright)
- Modale congés ouvre, sélection Jean Test, sauvegarde OK →
  ligne dans le tableau « Demandes de Congés » avec statut
  « En attente », 04/05 → 11/05.
- Modale paie ouvre, confirmation OK → bulletin créé
  (Jean Test, 5/2026, net **411 667 XAF** sur 500 000 XAF brut
  après CNSS 20 000 + IRPP 68 333).

## Bug fix : conversion devis→facture en production (2026-05-02 — iter 22)

L'utilisateur signalait « la conversion devis facture fonctionne mal »
avec message d'erreur en **production Vercel**.

### Cause racine
La fonction `seedDatabase` dans `db.ts` court-circuitait tout le travail
de migration dès que `_app_meta.schema_version` valait
`'2026-04-29-onboarding'` (valeur stockée par le déploiement précédent).

Conséquence : sur les déploiements existants, **aucune des nouvelles
colonnes OHADA** (`remise`, `rabais`, `ristourne`, `escompte`,
`centimesAdditionnels`, `netCommercial`, `netFinancier`,
`convertedFromQuoteId`, `convertedToInvoiceId`, `convertedAt`) n'était
ajoutée → l'`INSERT INTO invoices` du endpoint
`POST /:id/convert-to-invoice` échouait avec
`column "convertedFromQuoteId" does not exist`.

### Fix
- Refactor `db.ts` :
  - Extraction des migrations incrémentales dans une lambda
    `runIncrementalMigrations()`.
  - Bump du `TARGET_SCHEMA` à `'2026-05-02-ohada'`.
  - Le fast-path retourne uniquement si `schema_version === TARGET_SCHEMA`
    (et non l'ancienne valeur).
  - Sur déploiements existants (`relrowsecurity=true` mais ancien
    schema_version), exécution forcée des migrations puis bump du flag.

### Validé
- DB locale après restart : les 10 colonnes OHADA sont présentes
  (`SELECT column_name FROM information_schema.columns`).
- `_app_meta.schema_version = '2026-05-02-ohada'`.
- Conversion devis acceptés→facture : 201 OK, total = 118 900 XAF
  (100k brut + TVA 18k + CAC 900). Items copiés correctement.

## Lien public de signature pour les contrats RH (2026-05-02 — iter 21)

Implémente le flux complet « Envoyer le contrat → Email avec lien public
→ Signature manuscrite par le salarié → Archivage » à parité avec le
flux devis.

### Backend
- **Nouveau endpoint** `POST /api/employees/contracts/:id/send-email`
  (`employees.ts`) :
  - Récupère contrat + employé + société.
  - Construit le lien public `${origin}/sign-contract/<id>` à partir
    du header `Origin` (fallback `PUBLIC_BASE_URL` /
    `REACT_APP_BACKEND_URL`).
  - Validation syntaxique de l'email avant tout SMTP roundtrip
    (rejet immédiat si typo).
  - Met le statut à `Sent` + persiste le `signatureLink`.
  - Envoie l'email HTML stylé via le mailer per-tenant
    (`getMailerForCompany` — OVH SMTP pour les démos).
  - **Rollback automatique** du statut si le serveur SMTP rejette
    le destinataire (domaine inconnu, etc.) → réponse 502 avec
    message + détail.
- `publicSignature.ts` GET `/contracts/:id` : `position` désormais
  dérivé de `role || department` (la table `employees` n'a pas
  de colonne `position`, ce qui faisait planter l'endpoint).

### Frontend (`HR.tsx`)
- `handleSendContract` réécrit pour appeler le nouvel endpoint.
  Copie le lien dans le presse-papier après succès, surface le
  message d'erreur précis du backend en cas d'échec
  (« Adresse email invalide pour X », « Le serveur a refusé… »).
- **Onglet « Contrats Signés / Réception »** : la colonne Actions,
  qui n'avait qu'un bouton Download sans handler, comporte
  désormais 3 boutons fonctionnels avec testids
  `signed-contract-{preview|link}-<id>` (preview ouvre la modale,
  link copie le lien public).
- **Nouvelle modale `viewingContract`** (read-only) : titre rouge
  avec ID + nom employé, contenu du contrat en mono-space avec
  préservation des sauts de ligne, bloc vert « ✓ Contrat signé »
  affichant la signature manuscrite, le nom du signataire,
  l'horodatage français et la mention juridique eIDAS / OHADA.

### Validé (curl + Playwright)
- `POST /:id/send-email` → 200 + lien retourné ; statut DB passe à
  `Sent`.
- Email avec destinataire `jean@test.cg` → 502 « domaine refusé »,
  status DB rollback à `Draft` (vérifié curl).
- `POST /api/public/contracts/:id/sign` → status `Signed`,
  `signedAt` défini.
- Onglet « Contrats Signés / Réception » :
  `signed-contract-row-<id>` rendu, bouton aperçu ouvre la modale,
  signature manuscrite + nom + date affichés.

## Templates de contrats RH OHADA / Congo (2026-04-30 — iter 20)

L'utilisateur souhaitait des modèles complets et conformes OHADA (Code du
travail congolais) pour CDI / CDD / Indépendant, avec articles
modifiables, auto-remplissage entreprise + employé.

### Templates (`/app/src/lib/contractTemplates.ts`)
- **CDI Congo** : 14 articles — Engagement, Prise de fonction, Période
  d'essai (art. 24), Lieu de travail, Durée du travail (art. 99 +
  majorations heures sup.), Rémunération + primes (transport, logement,
  IRPP/CNSS), Congés payés (art. 121, 26 jours ouvrables), Protection
  sociale (CNSS), Confidentialité, Propriété intellectuelle, Rupture
  (préavis légaux), Discipline & règlement intérieur, Litiges
  (Tribunal du travail + OHADA), Dispositions finales.
- **CDD Congo** : 12 articles — motif obligatoire (art. 25), durée
  bornée (max 2 ans art. 27), période d'essai, congés au prorata,
  rupture anticipée (art. 26), **indemnité de fin de contrat 5 %**
  (art. 31).
- **Mission/Intérim** : 7 articles avec entreprise utilisatrice,
  protection CNSS, indemnité de précarité.
- **Prestation/Indépendant** : 10 articles — indépendance (sans
  subordination), honoraires HT + pénalités de retard (3× taux légal),
  PI (cession exclusive), confidentialité, responsabilité limitée,
  force majeure (art. 119 OHADA), arbitrage CCJA Abidjan.

### Auto-fill enrichi
- `AutofillKey` étendu : `companyNiu`, `companyRccm`, `companyIdNat`,
  `companyTaxId`, `companyPhone`, `companyEmail`, `companyCity`,
  `companyCountry`, `companyCurrency`, `employeeCni`, `employeeNiu`,
  `employeeMatricule`, `employeeEmail`, `employeePhone`,
  `employeeDepartment`, `employeeJoinDate`.
- `HR.tsx` passe désormais l'intégralité des champs `companies` +
  `employees` au `ContractBuilder` (NIU, RCCM, ID NAT, CNI, matricule
  CNSS, téléphones, emails, devise…).
- Variables PARTIES enrichies : pour le salarié on demande/auto-remplit
  date de naissance, lieu de naissance, nationalité, CNI, NIU,
  matricule CNSS, situation de famille, nombre d'enfants. Pour
  l'employeur : RCCM + NIU + ID NAT + représentant + qualité.

### Articles modifiables (`ContractBuilder.tsx`)
- Bouton **« Modifier l'article »** par section (icône `Edit3`).
  Quand activé, le texte légal complet (avec ses placeholders
  `{{key}}`) s'affiche dans un `<textarea>` mono-space — l'utilisateur
  peut tout réécrire.
- Bouton **« Original »** (icône `RotateCcw`) pour annuler les
  modifications et revenir au texte de référence.
- `editedBodies[articleId]` propagé jusqu'à `renderContract` qui
  remplace le body par défaut tout en interpolant les variables —
  ainsi la modification d'un champ continue à mettre à jour le
  contrat même après l'édition manuelle.

### Validé (Playwright)
- Modal Nouveau contrat → CDI sélectionné → 14 articles rendus.
- Inputs `contract-var-employeeCni`, `contract-var-companyNiu`,
  `contract-var-companyRccm` présents.
- Auto-fill : `Jean Test`, `Brazzaville`, `Développeur`,
  `Congolaise` pré-remplis.
- Click `contract-edit-engagement` → textarea avec 240 chars du texte
  légal apparaît, en mode édition.

## Page de signature publique : breakdown OHADA + diagnostic conversion (2026-04-30 — iter 19)

L'utilisateur signalait :
- Le **Centime Additionnel** n'apparaissait pas dans la page de signature publique du devis.
- La **conversion devis → facture** affichait « Échec de la conversion » sans plus d'info.

### Page publique (`/sign-quote/:id`)
- `GET /api/public/quotes/:id` (`publicSignature.ts`) renvoie maintenant
  les colonnes OHADA + CAC : `remise/remiseType`, `rabais/rabaisType`,
  `ristourne/ristourneType`, `escompte/escompteType`,
  `centimesAdditionnels`, `netCommercial`, `netFinancier`.
- `SignQuotePage.tsx` rend désormais le breakdown complet :
  `Brut HT → réductions non nulles (en montant ou %) → Net commercial
  → Net financier → TVA → Centimes additionnels (5% TVA, en orange) →
  Total TTC`. Les lignes nulles sont masquées pour rester compact.

### Diagnostic conversion
- `handleConvertToInvoice` (`Sales.tsx`) affiche désormais le message
  d'erreur précis renvoyé par le backend (« Ce devis a déjà été
  converti », « Seuls les devis acceptés ou signés peuvent être
  convertis »…) au lieu d'un générique « Échec de la conversion ».
- Ajoute aussi un body JSON vide explicite + `Content-Type:
  application/json` pour éviter d'éventuels rejets de `Content-Length:
  0` côté reverse-proxy.

### Validé
- Test curl : `POST /:id/convert-to-invoice` → 201 sur DEV-2026-937
  (Signed). Refait sur le même devis → 409 « Ce devis a déjà été
  converti en facture. »
- Page publique du devis DEV-2026-937 : screenshot Playwright montre
  bien Brut HT 95 000 / TVA 17 100 / **Centimes additionnels (5%
  TVA) 855 XAF** / Total TTC 112 955 XAF.
- Vérification DOM : `Centimes additionnels` présent dans `body.innerText`.

## Réductions OHADA + CAC + conversion devis→facture (2026-04-30 — iter 18)

### Schéma DB
- `invoices` : ajout des colonnes `remise`, `remiseType`,
  `rabais`, `rabaisType`, `ristourne`, `ristourneType`, `escompte`,
  `escompteType`, `centimesAdditionnels`, `netCommercial`,
  `netFinancier`, `convertedFromQuoteId`, `convertedToInvoiceId`,
  `convertedAt`. Toutes nullables/avec défauts → migration ré-exécutable
  sans risque. Ajoutée à `db.ts` pour les cold starts Vercel.

### Backend
- Nouveau service `/app/server/services/invoiceTotals.ts` :
  helper `computeInvoiceTotals(items, reductions, opts)` qui implémente
  l'ordre comptable OHADA :
  ```
  Brut HT − Rabais − Remise − Ristourne   = Net commercial
  Net commercial − Escompte               = Net financier
  TVA = TVA brute × (Net financier / Brut HT)
  CAC = TVA × 5%   (Congo uniquement, opt-in via `applyCentimesAdditionnels`)
  Total TTC = Net financier + TVA + CAC
  ```
  Chaque réduction supporte `'amount' | 'percent'`.
- `POST /api/invoices` et `PUT /api/invoices/:id` (`invoices.ts`)
  recalculent les totaux **côté serveur** à partir du pays de la
  société (`country='CG'` → CAC activé). Le client peut se tromper
  ou utiliser un cache obsolète, le DB persiste toujours la valeur
  authoritative.
- Nouveau endpoint `POST /api/invoices/:id/convert-to-invoice` :
  - Vérifie : `type='Quote'`, pas déjà converti (409), statut dans
    `{'Accepted','Signed','Validé','Validated'}` (400 sinon).
  - Recopie les lignes `invoice_items` + les 4 réductions + recalcule
    les totaux.
  - Crée une nouvelle facture `Invoice` `Draft`, échéance +30j,
    note auto « Issu du devis <id> ».
  - Marque le devis source `status='Converted'`,
    `convertedToInvoiceId=<new>`, `convertedAt=NOW()`.
- `GET /api/invoices/:id/pdf` : PDF enrichi — Brut HT + chaque
  réduction non nulle (montant ou %) + Net commercial + Net
  financier + TVA + Centimes additionnels + Total TTC.

### Frontend — `/app/src/modules/Sales.tsx`
- `calculateTotals(items, inv)` réécrit pour appliquer la même
  formule OHADA + CAC (déduit `country='CG'` du `user`).
- Form modal : 4 lignes Rabais/Remise/Ristourne/Escompte avec
  switch segmenté `XAF` / `%` à droite de chaque champ. Affichage
  séparé Net commercial + Net financier + Centimes additionnels
  (orange, badge Congo).
- Aperçu modale : mêmes lignes, masquées si valeur = 0.
- Bouton **« Convertir en facture »** (icône `Repeat`) visible
  uniquement si `type='Quote' && status in ('Accepted','Signed') &&
  !convertedToInvoiceId`. Confirmation native + appel POST →
  refetch + ouvre la nouvelle facture en aperçu.
- Statut **« Converti »** rendu en violet/indigo avec petite
  référence `← <quoteId>` sur la facture issue.
- Helpers `getStatusText` étendus pour `Signed` et `Converted`.
- Type `Invoice` (`/app/src/types.ts`) étendu avec tous les
  nouveaux champs + statut `'Converted'`.

### Validé (curl + Playwright)
- Création devis avec rabais + remise + ristourne + escompte mixés
  amount/percent → totaux corrects côté serveur (Brut 1 200 000 →
  Net financier 1 051 050 → TVA 189 189 → CAC 9 459 → TTC
  1 249 698).
- `POST /:id/convert-to-invoice` → 201, devis `status='Converted'`
  + `convertedToInvoiceId` rempli. 2ᵉ appel → 409.
- Conversion d'un devis avec status `Sent` → 400 « Seuls les devis
  acceptés ou signés ».
- PDF contient les libellés « Brut HT », « Remise », « Centimes
  additionnels ».
- UI Sales : statut « Converti » + référence ←quoteId visibles ;
  aperçu modale affiche bien Brut HT, Remise -50 000, Net
  commercial 950 000, TVA 171 000, **Centimes additionnels (5%
  TVA) 8 550 XAF**, Total TTC 1 129 550 XAF.

## Planning : employés RH dans le sélecteur (2026-04-29 — iter 17)

L'utilisateur ne voyait pas les employés créés dans le module RH lors
de la création d'un planning : seul son compte de connexion
(« Demo Admin ») apparaissait dans la liste « Employé ».

### Schéma DB
- `schedules` : ajout d'une colonne nullable `employeeId TEXT`,
  contrainte `NOT NULL` retirée sur `userId` (un planning peut
  désormais cibler **un utilisateur SmartDesk OU un employé RH**).
  Index `idx_schedules_employee` ajouté. Migration appliquée à chaud
  via SQL direct + insérée dans `db.ts` pour les cold starts Vercel.

### Backend — `/app/server/routes/schedules.ts`
- `GET /api/schedules` : `LEFT JOIN users` + `LEFT JOIN employees`,
  `userName` résolu avec `COALESCE(u.name, e.name)`.
- `POST /api/schedules` accepte désormais `employeeId` ou `userId`
  (au moins l'un des deux). Stocke `null` pour celui non fourni.
- `PUT /api/schedules/:id` idem.
- Helper `isManagerRole(role)` : reconnaît les rôles **per-tenant**
  (`role_admin_demo-1`, `role_rh_demo-2`, etc.) en plus des valeurs
  legacy (`admin`, `rh`, `super_admin`). Sans ça, le POST renvoyait
  `403 Forbidden` pour les admins démo.

### Frontend — `/app/src/modules/Planning.tsx`
- Nouveau `fetchEmployees()` appelle `/api/employees` au mount.
- Sélecteur « Employé » dans le modal : 2 `<optgroup>` —
  « Employés (RH) » + « Utilisateurs SmartDesk ». Valeurs préfixées
  `emp:` ou `usr:` pour différencier au submit.
- Vue Semaine : la liste des « rangées » fusionne désormais
  employés RH + utilisateurs SmartDesk. Filtre des planning par
  `userId` OU `employeeId` selon le type de l'entité.
- `openAddModal(date, userId, employeeId)` : pré-remplit la bonne
  cible quand on clique dans une cellule de la rangée.
- `canManage` utilise désormais le helper `isManagerRole` (mêmes
  règles que le backend) : les admins démo peuvent maintenant
  créer / éditer / supprimer.
- i18n : `planning.employeesGroup` + `planning.usersGroup` (FR/EN).
- Cleanup : icône `Formation` corrigée (`'emerald'` → `'🎓'`).

### Validé (curl + Playwright)
- `POST /api/schedules` avec `employeeId="emp-…"` → 201, ligne créée
  avec `userId=null`, `employeeId="emp-…"`.
- `GET /api/schedules` retourne `userName="Jean Test"` (depuis la
  table `employees`).
- Vue Semaine de Planning : 2 rangées affichées (`Jean Test`,
  `Demo Admin`), planning « 09:00 - 17:00 Mission » visible sur
  Jean Test sam. 2 mai.
- Modal `Nouveau planning` : sélecteur contient
  `optgroup label="Employés (RH)"` (Jean Test) +
  `optgroup label="Utilisateurs SmartDesk"` (Demo Admin).

## Actions sur devis signés (2026-04-29 — iter 15 + iter 16)

L'utilisateur peut désormais **prévisualiser, télécharger et supprimer**
un devis signé depuis la liste Sales **et** depuis l'onglet
« Devis Signés / Réception » (Espace de Réception Devis).

### Frontend — `/app/src/modules/Sales.tsx`
- `handleDownloadPdf(invoice)` : appel `GET /api/invoices/:id/pdf`,
  blob → téléchargement (filename `Devis_<id>.pdf`).
- **Liste principale** : bouton Download entre Envoyer et Modifier
  (`data-testid="download-pdf-<id>"`).
- **Onglet « Devis Signés / Réception »** (iter 16) : la colonne
  Actions n'avait qu'un bouton Download sans handler → 3 boutons
  fonctionnels (`Eye`, `Download`, `Trash2`) avec testids
  `reception-{preview|download|delete}-<id>`. Date formatée FR.
- Modale d'aperçu : bloc Signature électronique pour les devis Signed.
- Helper `parseSignature(raw)` : JSON `{signerName, signatureDataUrl}`
  ou data-URL nue (rétro-compat).

### Backend — `/app/server/routes/invoices.ts`
- `GET /api/invoices/:id/pdf` embed la signature manuscrite via
  `doc.addImage` (50 × 22 mm) + nom signataire + date + mention eIDAS.

### Validé (curl + Playwright)
- Onglet Réception : 3 boutons (preview/download/delete) trouvés via
  `data-testid` sur un devis signé seedé en demo-1.
- Date affichée : `29/04/2026 20:25:39` (au lieu du timestamp ISO).
- PDF généré ~7 KB contient DEVIS + nom signataire.
- Aperçu modale : `[data-testid="quote-signature-image"]` +
  `quote-signer-name` rendus.

## Précision signature + descriptions multi-lignes (2026-04-29 — iter 14)

### Canvas de signature
- `/app/src/pages/SignQuotePage.tsx` :
  - Helper `eventToCanvasPoint` : conversion correcte coord souris → coord
    canvas (ratio `canvas.width / rect.width`). Fix l'offset perçu sur les
    canvas étirés en CSS.
  - `useEffect` qui (re)dimensionne la résolution interne du canvas à la
    taille affichée × `devicePixelRatio` (lignes nettes sur retina,
    pas de pixellisation).
  - `setPointerCapture` pour conserver le tracé même quand le pointeur
    sort/rentre du canvas pendant le mouvement.
  - Tracé continu via `lineTo()` entre points successifs (fini les
    segments disjoints), `lineCap='round'`, `lineJoin='round'`,
    largeur 2.2 × DPR.
  - Petit cercle au pointerDown pour qu'un tap unique laisse une trace.

### Descriptions de produits / lignes de devis
Aligne l'affichage sur le formulaire de création (qui est un `<textarea>`
préservant espaces et `\n`). Tous les rendus utilisent désormais
`whitespace-pre-wrap break-words`.
- `/app/src/pages/SignQuotePage.tsx` (page de signature publique).
- `/app/src/modules/Sales.tsx` (modale d'aperçu de devis/facture).
- `/app/server/routes/invoices.ts` (e-mail HTML envoyé au client) :
  échappement HTML + remplacement `\n` → `<br/>` et `white-space:
  pre-wrap` sur les `<td>` concernées.

### Validé
- Devis avec description multi-lignes (incluant lignes vides + listes à
  puces avec espaces de tête) : rendu fidèle au contenu saisi côté
  signature publique.
- Tracé Playwright (sinusoïde 200 points) : ligne continue, alignée
  pixel-près au curseur.

## Page de signature publique (2026-04-29 — iter 13)

Le lien public `/sign-quote/:id` redirigeait vers la page d'accueil
(login) car le `<Router>` n'était monté qu'après authentification.
Réécriture du flow d'auth pour gérer les routes publiques.

### Frontend
- `/app/src/App.tsx` : `<Router>` déplacé au niveau racine (`<App>`).
  `AppContent` détecte les pathnames `/sign-quote/`, `/sign-contract/`
  et `/sign/` (legacy HR) avant tout appel à `/api/auth/me` et rend
  directement `SignQuotePage` sans Sidebar/Header ni écran de login.
- `/app/src/pages/SignQuotePage.tsx` : page unifiée devis + contrats
  HR. Détecte le type via `useLocation()`, appelle `/api/public/quotes`
  ou `/api/public/contracts`, affiche soit le tableau d'items + totaux
  TTC/HT/TVA (devis), soit le contenu du contrat + rémunération (HR).
  Canvas de signature manuscrite + nom complet, POST sur l'endpoint
  correspondant `…/sign`.

### Backend
- `/app/server/routes/publicSignature.ts` : nouveau router monté sur
  `/api/public` **sans `requireAuth`**. Routes : `GET /quotes/:id`,
  `POST /quotes/:id/sign`, `GET /contracts/:id`, `POST /contracts/:id/sign`.
- `/app/server/middleware/db.ts` : `dbMiddleware` détecte le préfixe
  `/api/public/` et active `isSuperAdmin=true` sur la session RLS
  uniquement pour ces routes (sinon `req.user.companyId` est nul →
  RLS bloquerait la lecture cross-tenant).
- `/app/app.ts` : `app.use('/api/public', publicSignatureRouter)`
  monté avant le 404 handler.
- Sécurité : la signature stocke `{signerName, signatureDataUrl}` en
  JSON dans la colonne existante `signatureLink`, met
  `status='Signed'` + `signedAt=NOW()`, et renvoie 409 si déjà signé.

### Validé (curl + screenshot Playwright)
- `GET /api/public/quotes/:id` retourne 200 avec invoice + items + company + contact.
- `GET /api/public/contracts/:id` retourne 404 quand inexistant, 200 sinon.
- `POST /api/public/quotes/:id/sign` passe le devis à `Signed` + `signedAt`.
- Re-signer → 409 « Ce devis est déjà signé ».
- Page `/sign-quote/qt_unsigned_2` rendue sans login : header rouge,
  parties, items 200 000 XAF / TTC 236 000 XAF, canvas + bouton
  « Confirmer ma signature ».
- Page d'un devis déjà signé : badge vert « DEVIS SIGNÉ » au lieu du formulaire.



## Refactorisation Sales/HR (2026-05-04) — P1

### Objectif
Réduire la taille des fichiers monolithiques `Sales.tsx` (1904 lignes) et
`HR.tsx` (2343 lignes) pour améliorer la maintenabilité sans modifier
le comportement.

### Composants extraits

#### Module HR (`/app/src/modules/hr/`)
- `LeavesTab.tsx` — Tableau des demandes de congés + popover « Gérer »
  (Approuver/Refuser/Remettre en attente/Supprimer).
- `PayrollTab.tsx` — Tableau des bulletins + actions (téléchargement PDF,
  bascule statut Payé/Brouillon, suppression).
- `StatsTab.tsx` — 4 cartes statistiques (effectif, congés actifs,
  masse salariale, départements).
- `LeaveRequestModal.tsx` — Formulaire modal de nouvelle demande de congé.
- `PayrollGenerateModal.tsx` — Modal de génération des bulletins
  (mois/année).

#### Module Sales (`/app/src/modules/sales/`)
- `SignatureModal.tsx` — Modal de signature de devis avec canvas
  manuscrit et résumé du devis.

### Stratégie
- Composants **purement présentationnels** : tout l'état et tous les
  handlers restent dans le parent (`HR.tsx` / `Sales.tsx`) et sont
  transmis via props.
- Zéro changement de comportement : c'est un déplacement de JSX.

### Résultat
- HR.tsx : **2343 → 2008 lignes** (−335, −14 %).
- Sales.tsx : **1904 → 1798 lignes** (−106, −6 %).
- 6 fichiers focalisés créés (557 lignes au total).

### Validé (testing_agent_v3_fork — iteration_3.json)
- 100 % des tests de non-régression passent (HR 6 onglets, Sales CRUD
  + sous-onglets + signature + preview, pages publiques `/sign-quote`
  et `/sign-contract`).
- Build Vite OK (16.5 s), aucun warning bloquant.
- Aucun bug détecté (ni critique ni mineur).

## Automatisation & Synchronisation inter-modules — Phase 1 (2026-05-04)

### Objectif utilisateur
« Automatise et synchronise tous les modules du CRM ». Répondu en 4 phases ;
la Phase 1 couvre les automatisations métier (a). Les phases 2 (liens UI
bidirectionnels), 3 (WebSocket temps réel sur tous les CRUD) et 4 (dashboard
centralisé) restent à livrer.

### Automatisations livrées

Tout est centralisé dans `/app/server/services/automations.ts` (4 fonctions
pures, idempotentes, chacune gère sa transaction).

1. **Devis signé → facture brouillon auto**
   - Déclenchement : `POST /api/public/quotes/:id/sign` (lien public) et
     `PUT /api/invoices/:id` avec `status: 'Signed'` (signature interne).
   - Effet : crée une facture `type=Invoice`, `status=Draft`, avec tous les
     items + champs OHADA (remise, rabais, ristourne, escompte, CAC) du
     devis. Met le devis en `Converted` + stocke les liens bidirectionnels
     `convertedFromQuoteId` / `convertedToInvoiceId`.
   - Idempotence : si `convertedToInvoiceId` existe déjà, ne fait rien.

2. **Facture payée → écriture comptable OHADA auto**
   - Déclenchement : `PUT /api/invoices/:id` quand `status` passe de
     non-Paid à `Paid` (aussi bien sur la route classique que sur la route
     certifiée DGID).
   - Effet : insère un `journal_entries` (description « Encaissement
     facture … ») + 3 `journal_items` :
     - Débit **521** Banques = Total TTC
     - Crédit **701** Ventes = Total HT
     - Crédit **445** TVA facturée = TVA + Centimes Additionnels
   - Idempotence : colonne `journal_entries.sourceRef` (index) pointant
     sur l'id de la facture — une seule écriture par facture.

3. **Contrat signé → bulletin brouillon auto**
   - Déclenchement : `POST /api/public/contracts/:id/sign` et
     `PUT /api/employees/contracts/:id` quand `status` passe de
     non-(Signed/Active) à Signed ou Active.
   - Effet : crée un `payslips` Draft pour le mois/année courant avec
     `baseSalary = contract.salary`. Pour les sociétés congolaises
     (`country=CG`) : applique CNSS 4 % + IRPP 2025 (5 tranches).
   - Idempotence : check (employeeId, month, year).

4. **Nouvel employé → contrat CDI brouillon auto**
   - Déclenchement : `POST /api/employees`.
   - Effet : crée un `contracts` Draft avec `type = emp.contractType`
     (défaut CDI), `startDate = emp.joinDate`, `salary = emp.salary`.
   - Idempotence : saute si un contrat existe déjà pour l'employé.

### Notifications UI temps réel
- Chaque automatisation émet un événement WebSocket typé
  (`INVOICE_AUTO_CREATED`, `JOURNAL_AUTO_CREATED`, `PAYSLIP_AUTO_CREATED`).
- Nouveau système de toast léger (`/app/src/lib/toast.tsx` + `<ToastHost />`
  monté dans App.tsx).
- Nouveau hook `useAutomationNotifications` qui écoute le WebSocket et
  affiche un toast vert avec un message clair en français.

### Migration DB
- Schema version bumpée à `2026-05-04-automations`.
- Ajout colonne `journal_entries.sourceRef TEXT` + index
  `idx_journal_entries_source_ref ("companyId", "sourceRef")`.

### Validation (iteration_4.json)
- **10/10 tests d'automatisation passent** (testing_agent_v3_fork).
- Idempotence vérifiée sur les 4 scénarios.
- CNSS + IRPP Congo calculés correctement sur le bulletin auto-créé.
- 1 bug mineur corrigé : `inv.totalHT.toLocaleString()` crashait quand
  le champ était string (PG numeric) → coerced via `Number()`.

### Phases restantes
- **Phase 2 (d)** — Liens UI bidirectionnels (contact→factures/devis,
  employé→contrats/bulletins/congés, navigation cliquable partout).
- **Phase 3 (b)** — Étendre le broadcast WebSocket à TOUS les CRUD pour
  une synchro multi-utilisateur temps réel de bout en bout.
- **Phase 4 (c)** — Tableau de bord centralisé (widgets agrégés CA,
  factures impayées, alertes RH, stocks faibles, top clients).


## Phases 2 + 3 + 4 — Liens UI, synchro temps réel, dashboard centralisé (2026-05-04)

### Phase 2 — Liens UI bidirectionnels
- **Nouvelle modale « Fiche contact CRM »** (`/app/src/modules/crm/ContactDetailModal.tsx`)
  avec 4 onglets : Informations, Devis, Factures, Projets.
  Chaque ligne est cliquable et deep-link vers `/sales?open=:id` ou
  `/projects?open=:id` (la page cible lit le paramètre et ouvre la
  prévisualisation automatiquement).
  Ajout de 2 KPIs en tête : CA encaissé + encours.
- **Nouvelle modale « Fiche employé RH »**
  (`/app/src/modules/hr/EmployeeDetailModal.tsx`) avec 5 onglets :
  Informations, Contrats, Bulletins, Congés, Tâches, chacun avec
  badge de compteur.
- Sales.tsx : nouvel effet `useEffect` qui lit `?open=:id` et ouvre
  le devis/facture correspondant.

### Phase 3 — Synchronisation temps réel sur TOUS les CRUD
- **Backend** : nouveau middleware global
  `/app/server/middleware/resourceBroadcast.ts` qui intercepte les
  POST/PUT/PATCH/DELETE réussis sur les routes principales et
  émet un événement WebSocket `RESOURCE_CHANGED` avec
  `{ resource, method, url, id, companyId, at }`.
  Ressources couvertes : contacts, products, invoices, projects,
  employees, leaves, payslips, contracts, employeeTasks, schedules,
  journalEntries, transactions, events.
- **Frontend** : nouveau hook `/app/src/lib/useLiveSync.ts` qui
  s'abonne au WebSocket et rappelle `refetch()` (debounced 250 ms)
  quand une ressource pertinente change. Filtrage par `companyId`
  pour la sécurité multi-tenant.
- Branché dans : Dashboard, CRM, Sales, HR, Projects, Accounting,
  Inventory.
- Dégradation gracieuse : le WebSocket n'est instancié qu'en runtime
  local (tsx). Sur Vercel, `broadcast()` est un no-op.

### Phase 4 — Dashboard centralisé
- **Backend** : extension de `/api/stats` avec les nouveaux champs :
  `outstanding` (count, total, overdueCount, overdueTotal),
  `topClients` (top 5 par CA encaissé), `upcomingLeaves`
  (congés approuvés démarrant dans les 14 j), `expiringContracts`
  (CDD expirant dans les 30 j), `lowStock` (produits avec stock ≤ 5),
  `pendingLeaves` (count). `monthlyData` passé de 6 à **12 mois**.
- **Frontend** : nouveau composant `DashboardWidgets` avec :
  - 3 cartes d'alerte cliquables : Factures en retard, En attente
    de paiement, Congés à valider.
  - 4 panneaux : Top 5 Clients, Congés à venir, Contrats arrivant
    à échéance, Stock à recommander.
- Chaque ligne navigue vers le module correspondant ; les empty
  states sont traités proprement.

### DB
- Aucune nouvelle migration.
- Contournement : `invoices.dueDate`, `contracts.endDate`,
  `leave_requests.startDate/endDate` stockés en TEXT → cast
  `::date` ajouté dans les requêtes Phase 4.

### Testing (iteration_5.json)
- Backend : **25/26 tests passent** (1 skipped, aucun produit en base
  pour le test PUT).
- Frontend : **100 %** — Phase 2 modales + onglets, Phase 3 broadcasts,
  Phase 4 widgets tous vérifiés.
- 2 bugs critiques corrigés par le testing agent :
  1. `fetchData` hoisting dans Sales.tsx (useLiveSync appelé avant
     la définition const) → déplacé au-dessus.
  2. Référence `fetchInvoices()` inexistante → remplacée par
     `fetchData()`.

### Limitation connue
- WebSocket indisponible sur Vercel (serverless). Sur ce
  déploiement, le temps réel tombera en graceful no-op — les pages
  se rafraîchiront à chaque navigation mais pas entre utilisateurs
  sans F5.

### Reste à faire
- Widget « Activité récente » agrégeant les events `ACTIVITY`
  (déjà broadcastés) sur le dashboard.
- Tests d'intégration E2E Playwright pour les deep-links
  CRM→Sales et HR→sous-modules.

