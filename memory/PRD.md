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

## Fix UX conversion devis — Espace Réception (2026-05-04)

### Demande utilisateur
« Les entreprises en démo peuvent aussi convertir les devis en facture ».

### Cause racine
Le bouton « Convertir en facture » n'existait que dans l'onglet
**Liste des Devis**. Il manquait dans l'onglet **Devis Signés / Réception**
— là où les utilisateurs (en démo ET en prod) consultent en priorité
leurs devis signés. Le backend n'avait AUCUNE restriction demo : la
limitation était purement UI.

### Fix
`/app/src/modules/Sales.tsx` (table de la réception) :
- Nouveau bouton `reception-convert-{quoteId}` (icône Repeat) à côté
  des actions Aperçu / Télécharger / Supprimer, visible uniquement si
  `!quote.convertedToInvoiceId`.
- Nouveau badge vert `reception-converted-{quoteId}` (libellé
  « Converti ») pour les devis déjà convertis.
- Réutilise le handler `handleConvertToInvoice` existant (pas de
  duplication).

### Testing (iteration_6.json)
- **100 % frontend** : bouton visible, dialog natif confirm,
  POST /api/invoices/{id}/convert-to-invoice, création d'une
  facture Draft avec `convertedFromQuoteId` correctement lié,
  badge Converti apparaît après conversion.
- Vérifié sur le compte démo `admin@smartdesk.cg` / `admin`.

- Widget « Activité récente » agrégeant les events `ACTIVITY`
  (déjà broadcastés) sur le dashboard.
- Tests d'intégration E2E Playwright pour les deep-links
  CRM→Sales et HR→sous-modules.


## Phase 5 — Abonnement PayPal récurrent (2026-05-04)

### Objectif utilisateur
« Quand une entreprise atteint 15 jours, demander une souscription
abonnement. République du Congo : 45.000 XAF / mois. RDC : 40 $ / mois.
Utiliser PayPal. » (clés LIVE fournies)

### Blocage technique résolu
PayPal ne supporte **PAS** le XAF pour la facturation récurrente
(25 devises supportées, XAF n'en fait pas partie — vérifié via web
search + playbook PayPal). Décision : les clients CG sont facturés
**75 USD** (équivalent ~45 000 XAF au taux de change du jour), la
banque du client applique la conversion automatiquement. L'UI
communique **explicitement** le montant en XAF au client pour
transparence.

### Architecture

**Pricing** (`/app/server/services/paypal.ts`)
- `CG_XAF` : 75 USD (affiché « 45 000 XAF ») — pour `country='CG'`
- `WORLD` : 40 USD (affiché « $40 USD ») — défaut pour tous les autres (y compris CD)

**Backend**
- `paypal.ts` : OAuth client_credentials (token caché), bootstrap
  idempotent du produit + 2 plans (IDs persistés dans `app_config`),
  helpers createSubscription / getSubscription / cancelSubscription /
  verifyWebhookSignature.
- `routes/subscription.ts` : 6 endpoints
  - `GET  /api/subscription/status`  → état courant + plan
  - `POST /api/subscription/start-trial` → stamp idempotent
  - `POST /api/subscription/create` → retourne `approveUrl` PayPal
  - `POST /api/subscription/activate` → sync après retour PayPal
  - `POST /api/subscription/cancel`
  - `POST /api/subscription/webhook` → handle BILLING.SUBSCRIPTION.*
- `middleware/enforceSubscription.ts` : décode lui-même le JWT
  (cookie ou Bearer), renvoie **HTTP 402** `SUBSCRIPTION_REQUIRED`
  sur les routes protégées quand `trial expiré + subStatus ≠ active`.
  Super admin bypass.
- Liste blanche : `/api/auth/*`, `/api/subscription/*`,
  `/api/public/*`, `GET /api/company`, `GET /api/stats`.
- `auth.ts` : stamp automatique de `trialStartedAt` + `subscriptionStatus='trial'`
  sur la première connexion admin (demo ET tenants réels). Ne
  bloque plus le login sur expiration (ancien 403 supprimé).

**DB (`2026-05-04-subscriptions`)**
- `companies` : `trialStartedAt`, `subscriptionStatus`,
  `paypalSubscriptionId`, `subscriptionPlan`, `subscriptionPeriodEnd`.
- Nouvelle table `app_config(key PK, value, updatedAt)` pour les IDs
  PayPal persistants.

**Frontend**
- `SubscriptionGate.tsx` : wrap la zone authentifiée, 3 états :
  1. **Actif / trial >7j** : pass-through transparent.
  2. **Trial ≤ 7j** : bannière sticky haut (ambre ≤7, rouge ≤3,
     « Dernier jour » ≤1) avec bouton « S'abonner ».
  3. **Expiré / no active sub** : **modal full-screen bloquante**,
     aucune navigation possible, bouton « S'abonner avec PayPal »
     ou « Déconnexion » uniquement.
- Message CG explicite : « Vous êtes facturé l'équivalent en
  dollars par PayPal (75 USD), mais votre carte sera débitée en XAF
  selon le taux de change du jour appliqué par votre banque — le
  coût final reste 45 000 XAF. »
- Retour PayPal (`?subscription=return`) : appel auto à
  `/activate` + toast de succès.

**Environnement**
`/app/.env` :
```
PAYPAL_MODE=live
PAYPAL_CLIENT_ID=…
PAYPAL_CLIENT_SECRET=…
PAYPAL_RETURN_URL_BASE=https://login-troubleshoot-18.preview.emergentagent.com
```
(À adapter en production sur Vercel — `PAYPAL_RETURN_URL_BASE` doit
pointer vers le domaine final du tenant.)

### Validation (iteration_7.json)
- **100 % backend (18/18)** : login ne bloque plus, stamping
  idempotent, plan CG correct, plan WORLD par défaut, approveUrl
  PayPal valide, 402 sur les routes protégées, allowlist OK,
  webhooks 4 events (ACTIVATED/CANCELLED/SUSPENDED/PAYMENT.FAILED),
  super admin bypass.
- **100 % frontend** : bannière amber/rouge selon daysLeft, modal
  bloquant avec pricing CG/World correct, disclosure XAF claire,
  redirect vers PayPal.com OK.
- Aucune régression sur Phases 1-4.

### À faire pour la production
- **Webhook PayPal** : créer le webhook dans le dashboard PayPal
  pointant vers `https://<domaine>/api/subscription/webhook` avec
  les événements BILLING.SUBSCRIPTION.* + PAYMENT.SALE.COMPLETED.
  Ajouter `PAYPAL_WEBHOOK_ID=…` à `.env` puis décommenter la
  vérification de signature dans `routes/subscription.ts`.
- **PAYPAL_RETURN_URL_BASE** : mettre à jour sur le domaine prod.
- Les 2 plans PayPal déjà créés (LIVE) persistent dans `app_config` ;
  ne pas les supprimer côté PayPal, sinon les subscriptions
  échoueront.



## Webhook PayPal — auto-bootstrap + vérification (2026-05-04)

### Approche
Plutôt que d'aller dans le dashboard PayPal, on crée le webhook via
l'API REST (`POST /v1/notifications/webhooks`) — automatisable et
idempotent.

### Implémentation
- `paypal.ts` → `ensureWebhook(db, baseUrl)` : liste les webhooks
  existants, ne crée qu'en cas d'absence, persiste l'id en
  `app_config`.
- 7 événements souscrits : `BILLING.SUBSCRIPTION.ACTIVATED /
  CANCELLED / SUSPENDED / EXPIRED / RENEWED / PAYMENT.FAILED`,
  `PAYMENT.SALE.COMPLETED`.
- Nouvel endpoint `POST /api/subscription/bootstrap-webhook` (super
  admin only) : retourne `{ok, id, url, created}`.
- `routes/subscription.ts` → POST /webhook **vérifie maintenant la
  signature** via `getStoredWebhookId(db)` + `verifyWebhookSignature`.
  Faux headers → HTTP 400. Aucune signature stockée encore → accepte
  avec warning (bootstrap initial).

### Trace production (LIVE)
```
paypal_webhook_id    = 7W15370887869372P
paypal_webhook_url   = https://…/api/subscription/webhook
```
Webhook PayPal réel, persistant. Ne pas supprimer.

### Production checklist (Vercel)
- Mettre à jour `PAYPAL_RETURN_URL_BASE` au domaine prod.
- Rejouer `POST /api/subscription/bootstrap-webhook` côté super admin.

## Validation Localisation RDC (2026-05-04 — iter 8 testing)

### Contexte
L'utilisateur (RDC) signalait que les formulaires CRM/HR/Sales restaient en
+242 / XAF (Congo-Brazzaville) au lieu de s'adapter à +243 / CDF/USD.

### Validation (iteration_8.json — frontend testing agent, 100%)
Comptes testés :
- `plamedi.fika@tbi-center.fr` / admin (CD/USD, onboarding terminé) — testé
  sur tous les modules.
- `ariane.mbombo@tbi-center.fr` / admin (CD/CDF) — testé via le wizard
  d'onboarding (qui affiche bien RDC/CDF/Kinshasa/OHADA).

Résultats par module (utilisateur RDC USD) :
- CRM > Nouveau Contact : phone pré-rempli `+243 `, placeholder
  `+243 XX XXX XXXX`, tax ID label `ID NAT` ✅
- HR > Nouvel Employé : phone `+243 `, salaire libellé `SALAIRE ANNUEL ($)` ✅
- Sales / Inventory / Accounting / Dashboard : symbole devise `$` partout ✅
- Settings : pays "République Démocratique du Congo (RDC)", devise USD, 
  comptabilité OHADA ✅
- Aucun affichage `XAF` ou `FCFA` détecté pour les utilisateurs RDC ✅

### Note
- Le compte `ariane.mbombo` ne peut pas terminer son onboarding car la clé
  SFEC démo masquée (`97ecc28...943c`) ne passe pas la validation `≥16
  chars`. Pré-existant, non lié au fix de localisation.

### Crédentiels ajoutés à test_credentials.md
- `ariane.mbombo@tbi-center.fr` / `admin` (CD/CDF)
- `plamedi.fika@tbi-center.fr` / `admin` (CD/USD)

## Onboarding étendu + Responsive (2026-05-04 — iter 9)

### Demande utilisateur
1. Pour la RDC (CD) : ne PLUS demander de clé API SFEC à l'onboarding (la SFEC est congolaise — CG uniquement).
2. Formulaire de paramétrage complet (Congo + RDC) : logo, RCCM, NIU/ID NAT,
   forme juridique, capital, représentant légal + qualité, adresse, téléphone,
   email, taux CNSS patronale/salariale.
3. Adapter le site à tous les formats (mobile / tablette / desktop).

### Choix utilisateur
- Clé SFEC pour Congo : OPTIONNELLE (skippable, complétable plus tard depuis Paramètres).
- Logo : upload fichier (data:URL, max 2 Mo) OU URL externe.
- Tous les champs proposés inclus, plus les taux CNSS.

### DB — schema_version `2026-05-04-extended-config`
6 nouvelles colonnes nullables sur `companies` :
- `legalForm` TEXT (SARL, SA, SAS, EI…)
- `capital` REAL (capital social en devise société)
- `representativeName` TEXT
- `representativeRole` TEXT (Gérant, DG, Président…)
- `cnssEmployerRate` REAL (% patronal)
- `cnssEmployeeRate` REAL (% salarié)

### Backend (`/app/server/routes/company.ts`)
- `POST /api/company/onboarding` : `fiscalizationApiKey` désormais OPTIONNELLE.
  Validation 16 chars uniquement si fournie ET pays = CG. Accepte les 6 nouveaux
  champs + name/logo/taxId/rccm/idNat/niu/address/phone/email/website.
  Réponse : `hasFiscalizationKey` flag (jamais la clé brute).
- `PUT /api/company` : étendu pour accepter et persister les 6 nouveaux champs.

### Backend automations (`/app/server/services/automations.ts`)
- `computeCongoPayrollBreakdown(base, cnssRate?)` lit désormais
  `companies.cnssEmployeeRate` quand disponible, fallback 4 % par défaut.

### Frontend
- **OnboardingWizard.tsx — réécrit en 5 étapes** :
  1. Localisation (Pays/Ville + auto-détection IP)
  2. Identité (Logo upload/URL, Nom, Forme juridique 13 options, RCCM, NIU, ID NAT, Capital)
  3. Contact + représentant (Email, Téléphone, Site web, Adresse, Nom + Qualité représentant)
  4. CNSS (taux patronal/salarial avec pré-remplissage selon pays : CG 16%/4%, CD 13%/5%, FR 42%/22%)
  5. **Clé SFEC — uniquement pour Congo, OPTIONNELLE** avec bouton "Sauter cette étape"
  Pré-sélection automatique du pays depuis `user.country` (cache `window.__SMARTDESK_USER__`).
- **Settings.tsx** — 6 nouveaux champs ajoutés au formulaire entreprise :
  Forme juridique, Capital, Représentant légal, Qualité, CNSS patronale/salariale.
  Les CNSS ne sont visibles que si `accountingStandard='OHADA'`.
- **HR.tsx** — `computeCongoPayroll(base)` lit `companyInfo.cnssEmployeeRate`.

### Responsive
- `App.tsx` PageWrapper : padding main `p-4 sm:p-6 lg:p-8` (mobile→desktop).
- OnboardingWizard : `max-w-3xl` + `max-h-[70vh] overflow-y-auto` + grilles
  `sm:grid-cols-2`, stepper bar scrollable horizontalement, footer flex-wrap.
- Sidebar/Header existants ont déjà mobile drawer (lg:sticky, hamburger).

### Validation (iteration_9.json — 100 % backend + 100 % frontend)
- 10/10 tests backend (test_onboarding.py) : POST /onboarding accepte clé vide
  pour CD et CG, rejette <16 chars pour CG, persiste les 6 champs étendus,
  PUT /company met à jour, GET /company expose seulement le flag.
- 17/17 tests frontend : RDC = 4 étapes (no SFEC) ; Congo = 5 étapes avec
  bouton Skip ; CNSS pré-rempli correctement ; Settings affiche tous les
  nouveaux champs ; mobile (390px) / tablette (768px) / desktop (1920px)
  tous validés ; régression localisation RDC OK.

### Crédentiels test (test_credentials.md)
- `designer@tbi-center.fr` / `admin` (CG, onboarding RESET pour test wizard)
- `ariane.mbombo@tbi-center.fr` / `admin` (CD/CDF, onboarding RESET)
- `plamedi.fika@tbi-center.fr` / `admin` (CD/USD, déjà onboardé)

## Sales : conversion auto-payée + visibilité devis signés + auto-refresh (2026-05-13 — iter 10)

### Demande utilisateur (6 points)
1. Bug : après conversion devis→facture, banner « réservée aux sociétés démo » s'affiche à tort.
2. Les factures auto-générées (depuis devis signé) doivent passer en **Payé** direct (choix `a`).
3. Devis envoyés pour signature → libellé « **En attente** ».
4. Les devis signés sont invisibles dans « Devis Signés / Réception ».
5. Auto-refresh global toutes les 10 s.
6. Vérifier module Utilisateurs & Rôles.

### Modifications

**Backend — `/app/server/services/automations.ts`**
- `autoConvertSignedQuoteToInvoice` : nouvelle facture créée avec `status='Paid'`
  (au lieu de `Draft`). Le devis source garde son statut (`Signed`), seul
  `convertedToInvoiceId` + `convertedAt` sont remplis → devis toujours
  visible dans l'onglet Réception.
- Post-commit : déclenche `autoPostPaidInvoiceJournal` (écriture comptable
  OHADA) + `autoCertifyInvoice` (DGID SFEC pour CG démo).
- Nouvelle fonction `autoCertifyInvoice(db, invoiceId, companyId)` :
  réutilise la logique SFEC du `POST /api/invoices`, lazy-import de
  `fiscalization.js` pour éviter une dépendance circulaire.

**Backend — `/app/server/routes/invoices.ts`**
- `POST /:id/convert-to-invoice` : même comportement (Paid, conserve
  statut devis, journal + cert auto).

**Frontend — `/app/src/modules/Sales.tsx`**
- `getStatusText(status, type)` accepte le type : si `Quote+Sent`,
  affiche « En attente » ; si `Invoice+Sent`, garde « Envoyé ».
- Filtre onglet « Devis Signés / Réception » : inclut `Converted` en
  plus de `Signed`/`Accepted` (legacy data).
- Message DGID neutralisé : retire « réservée aux sociétés démo pour
  l'instant ». Affiche un message clair selon `companyType`.

**Frontend — `/app/src/lib/useLiveSync.ts`**
- Ajout d'un **polling fallback toutes les 10 s** (en plus du
  WebSocket temps réel). Pause si l'onglet n'est pas visible
  (`document.visibilityState !== 'visible'`), refresh immédiat sur
  retour focus. Couvre les déploiements Vercel serverless où le WS
  est indisponible.

**Frontend — `/app/src/modules/CRM.tsx`**
- Fix bug HIGH détecté par testing agent : `contact.status.toLowerCase()`
  crashait quand status nullable. Fallback `'Lead'` ajouté.

### Validation (iteration_10.json — 10/12 backend + frontend OK)
- Conversion devis→facture : status='Paid', devis conserve Accepted/Signed,
  `convertedToInvoiceId` rempli, journal auto, 409 sur double conversion.
- Polling 10 s confirmé via Network (2 requêtes /api/contacts en 25 s).
- Module Utilisateurs/Rôles fonctionnel (list+CRUD users+roles).
- Onglet Réception : devis Signed/Accepted/Converted visibles.
- Message DGID nettoyé.
- Bug CRM corrigé.

## Workflow « Marquer comme payé » + Email auto facture certifiée (2026-05-13 — iter 11)

### Demande utilisateur
Le devis doit d'abord être marqué comme PAYÉ avant d'être converti en facture,
puis la facture certifiée DGID en PDF doit être envoyée automatiquement
par email au client. Choix : (1a) bloquer si email manquant, (2c) bouton
visible sur tous les devis non convertis, (3a) envoi email systématique.

### DB — schema_version `2026-05-13-mark-quote-paid`
- Nouvelle colonne `invoices.paidAt TIMESTAMPTZ`.

### Backend
- **Nouveau service** `/app/server/services/invoicePdf.ts` :
  `buildInvoicePdfBuffer(db, invoiceId, companyId)` centralise la
  génération PDF (en-tête, lignes, totaux, bloc signature électronique,
  bloc QR DGID/SFEC). Réutilisé par GET /pdf et le nouveau workflow.
- **Nouveau endpoint** `POST /api/invoices/:id/mark-quote-paid` :
  1. Valide le devis (404 si introuvable, 409 si déjà converti, 400 si
     pas de contactId ou pas d'email).
  2. UPDATE devis SET status='Paid', paidAt=NOW().
  3. Appelle `autoConvertSignedQuoteToInvoice` qui crée la facture
     `status='Paid'` + déclenche `autoPostPaidInvoiceJournal` +
     `autoCertifyInvoice` (best-effort, ne bloque pas le workflow).
  4. Génère le PDF via `buildInvoicePdfBuffer` et l'envoie en pièce
     jointe par email au client (template HTML avec badge de
     certification si applicable).
  5. Retourne `{ success, invoice, emailSent, emailError }`.
- **Signature publique** (`POST /api/public/quotes/:id/sign`) : RETIRE
  l'auto-conversion. Le devis reste à `status='Signed'`. La conversion
  se fait désormais uniquement via le bouton « Marquer comme payé ».
- **GET /api/invoices/:id/pdf** refactorisé pour utiliser
  `buildInvoicePdfBuffer` (réduction ~150 lignes dupliquées).

### Frontend (`/app/src/modules/Sales.tsx`)
- Nouveau `handleMarkQuotePaid(quote)` : confirm avec les 4 actions
  (convertir, journal, DGID, email) → POST endpoint → toast succès
  ou erreur (email manquant, email rejeté, etc.).
- **Bouton « Marquer comme payé »** (icône DollarSign vert) visible
  sur tous les devis non encore convertis dans :
  - La liste principale Sales (data-testid `mark-quote-paid-{id}`).
  - L'onglet Réception (data-testid `reception-mark-paid-{id}`).
- Le bouton de conversion classique (Repeat indigo) reste visible
  pour les cas où l'opérateur souhaite convertir sans paiement.

### Validation (iteration_11.json — 9/9 backend + 100 % frontend)
- 404 si id inexistant ; 409 si déjà converti ; 400 + message clair si
  email/contact manquant ; cas nominal : devis Paid + paidAt + facture
  Paid + journal + cert + email (emailSent/emailError).
- Signature publique ne convertit plus.
- GET /pdf renvoie un PDF valide.
- UI : boutons visibles selon les bons états, confirm content vérifié.

## API de provisioning externe + badge super-admin (2026-05-14 — iter 12)

### Demande utilisateur
Permettre à une plateforme externe de créer des comptes entreprises sur
SmartDesk et de les voir dans le tableau de bord super-admin. Choix :
1a (X-API-Key), 2c (name+adminEmail+country+city requis + tous les
autres optionnels), 3a (admin auto-créé, password renvoyé une fois),
4b (abonnement déjà actif, pas de trial), 5a (badge dans la liste
super-admin existante).

### Implementation
**DB — schema_version `2026-05-13-external-origin`**
- `companies.origin TEXT NOT NULL DEFAULT 'self_signup'` ('external' pour les comptes provisionnés par l'API).
- `companies.externalRef TEXT` (référence opaque côté partenaire, pour audit).

**Backend**
- `EXTERNAL_API_KEY` env var (générée 64 chars hex, stockée dans `/app/.env`).
- `server/middleware/requireExternalApiKey.ts` : valide `X-API-Key` ou `Authorization: Bearer`. Retourne 503 si l'env var n'est pas configurée, 401 si clé absente/invalide.
- `server/routes/external.ts` :
  - `POST /api/external/companies` : validation (404/400/409), création société avec `origin='external'`, `subscriptionStatus='active'`, `onboardingCompleted=true`, inférence devise selon pays (CG→XAF, CD→CDF, FR→EUR), inférence comptabilité (FR→FRANCE, sinon OHADA), création user admin avec password 16 chars retourné UNE seule fois.
  - `GET /api/external/companies` : liste les sociétés `origin='external'` pour réconciliation partenaire.
- `enforceSubscription` : `ALLOW_PREFIX` étendu avec `/api/external` (l'endpoint n'a pas de tenant context).
- Routage : `app.use('/api/external', externalRouter)` mont dans `app.ts` avant les autres routes.

**Frontend**
- `SuperAdmin.tsx` : badge violet **« ORIGINE : EXTERNE »** (data-testid `external-origin-badge-{id}`) à côté du badge type pour les sociétés `origin='external'`. Tooltip affiche `externalRef` si présent.

### Validation (iteration_12.json — 17/17 backend + UI OK)
- 401 sans/avec mauvaise clé ; 400 si champs requis manquants ; 400 si email invalide ; 409 si email déjà utilisé ; 201 cas nominal.
- Tous les champs optionnels (rccm, legalForm, capital, CNSS, etc.) bien persistés.
- Login fonctionnel avec password auto-généré.
- Société externe peut accéder aux routes protégées (subscriptionStatus='active' contourne le gate).
- GET /api/external/companies retourne uniquement origin='external'.
- /api/admin/companies expose `origin` et le badge violet s'affiche.
- Bearer token alternative au X-API-Key fonctionne.

### Doc partenaire
- `/app/memory/external_api.md` : exemple curl, key courante.

### Note pré-existante (non bloquante, hors scope)
- Bug pré-existant détecté : `POST /api/admin/companies` (création depuis le super-admin UI) échoue avec "relation invoices does not exist" dans `initializeTenantSchema`. Ce bug ne concerne pas la nouvelle API externe (qui n'utilise plus cette fonction, l'app étant en RLS pur sur le schéma public).

## Fix bug pré-existant `POST /api/admin/companies` (2026-05-14 — P2.a)

### Problème
La création d'une société depuis l'UI super-admin échouait avec
`relation "invoices" does not exist` (code Postgres 42P01).

### Cause
`POST /api/admin/companies` appelait `initializeTenantSchema(schemaName)`
qui tente de créer une table `invoice_items` avec un FK vers
`invoices(id)` dans le schéma tenant. Or les tables (`invoices`,
`contacts`, `products`, etc.) vivent toutes dans le schéma `public` —
SmartDesk utilise un multi-tenancy par **RLS sur public**, pas par
schéma. La colonne `companies.schemaName` est vestigiale.

### Fix
- Retrait de l'appel `initializeTenantSchema` dans
  `/app/server/routes/admin.ts` POST /companies.
- Retrait de l'import inutile.
- Commentaire explicatif laissé en place pour les futurs lecteurs.

### Validation (smoke test curl)
- `POST /api/admin/companies` (real) → 201 ✅
- `POST /api/admin/companies` (demo) → 201 ✅
- Login avec l'admin auto-créé → OK ✅
- Aucune régression côté `/api/external/companies` (qui n'utilisait
  déjà plus cette fonction).

## 3 bugs super-admin / subscription gate (2026-06-01 — iter 13)

### Demandes utilisateur
1. Super admin → atterrir directement sur l'entreprise **TBI Center** (réel).
2. Période d'essai terminée mais bouton « S'abonner avec PayPal » ne fonctionne pas → **remplacer par « S'abonner par carte bancaire »**.
3. Bouton « Se déconnecter » de la modal d'abonnement ne fonctionne pas.

### Fixes
**1. Super-admin landing**
- `/app/server/routes/auth.ts` POST /login : pour `role='super_admin'`, si `preferences.selectedCompanyId` est vide OU pointe vers une société supprimée, auto-cherche la société `LOWER(name) LIKE '%tbi center%' AND type='real'` et persiste le résultat.
- DB seed : tous les super-admins existants ont eu leur `preferences.selectedCompanyId` mis à `comp_default` (TBI Center).

**2. Relabel PayPal → carte bancaire**
- `/app/src/components/SubscriptionGate.tsx` :
  - Bouton : « S'abonner par carte bancaire » (au lieu de « S'abonner avec PayPal »).
  - Sous-texte : « Paiement sécurisé par carte bancaire (Visa, Mastercard). »
  - URL PayPal : ajout du paramètre `?landing_page=BILLING` qui ouvre directement le formulaire CB invité de PayPal Checkout (pas l'écran de login PayPal).

**3. Bouton logout dans la modal**
- Cause : `useAuth()` n'exposait pas de fonction `logout` — `useAuth() as any` masquait l'erreur, le bouton appelait `undefined()`.
- Fix : `AuthContext.tsx` : `AuthProvider` accepte désormais une prop `logout` et l'expose dans le `value` du contexte. `App.tsx` lui passe le `logout()` local (qui appelle `/api/auth/logout` + `clearApiSession()` + `setUser(null)`).
- `SubscriptionGate.tsx` : `const { user, logout } = useAuth();` (typé proprement).

### Validation (iteration_13.json — 7/7 backend + 7/7 frontend)
- Super admin login → `selectedCompanyId=comp_default` ✅
- POST /api/auth/logout → 200 + session purgée ✅
- POST /api/subscription/create → approveUrl PayPal valide ✅
- Modal affiche « S'abonner par carte bancaire » + texte CB ✅
- Aucun texte « PayPal » résiduel ✅
- Logout modal → retour à l'écran de login ✅
- Régression : Header logout toujours OK ✅

## Bypass SubscriptionGate pour super-admin (2026-06-01)

### Demande
Ne plus demander de paiement pour `eden@tbi-center.fr` (et tout super-admin).

### Fix
`/app/src/components/SubscriptionGate.tsx` :
- Short-circuit `if (user.role === 'super_admin') return <>{children}</>`
  AVANT toute logique de loading/blocker.
- `useEffect` qui fetch status : skip pour super_admin (ne fait pas
  POST /start-trial ni GET /status).

Le backend (`enforceSubscription` middleware) bypassait déjà via
`isSuperAdmin` ; ce fix aligne le frontend. Les super-admins peuvent
maintenant impersonner n'importe quelle société sans jamais voir la
modal d'abonnement.

### Validation
- Screenshot après login eden : `subscription-blocker` count = 0,
  `subscription-trial-banner` count = 0.
- GET /api/contacts en tant que super-admin : 200 OK (régression).

## Fix flow paiement compte suspendu (2026-06-01 — iter 14)

### Demande utilisateur
« Vérifie les paiements quand le compte est suspendu car ça ne fonctionne pas. »

### Bugs identifiés et corrigés

**1. Orphelins PayPal lors d'un re-subscribe**
- `/app/server/routes/subscription.ts` POST /create : si la société a déjà
  un `paypalSubscriptionId`, on appelle d'abord `cancelSubscription`
  côté PayPal pour annuler l'ancien billing agreement avant d'en créer
  un nouveau. Évite les doubles débits et les conflits côté PayPal.
  L'échec d'annulation est non-fatal (l'ancien sub peut déjà être
  expiré/inexistant) : on log et on continue.

**2. APPROVED bloquait l'accès indéfiniment**
- POST /activate : mapping PayPal → SmartDesk : `APPROVED → 'active'`
  (avant : `APPROVED → 'pending'`). Quand l'utilisateur revient de
  PayPal après avoir approuvé, PayPal peut prendre quelques minutes
  pour activer le sub (statut intermédiaire = APPROVED). On donne
  accès immédiatement ; si le premier paiement échoue,
  `BILLING.SUBSCRIPTION.PAYMENT.FAILED` webhook nous remet à
  `suspended`.

**3. `landing_page=BILLING` était inefficace sur /webapps/billing/subscriptions**
- `/app/src/components/SubscriptionGate.tsx` startSubscribe : retire
  l'ajout du param `landing_page=BILLING` (ce param ne marche QUE sur
  les URLs `/checkoutnow`, pas sur les URLs de Subscription PayPal).
  Le lien « Payer par carte » reste disponible sur l'écran PayPal en
  guest checkout.

### Validation (iteration_14.json — 14/15 backend + 9/9 frontend)
- Re-subscribe d'un compte suspended : OK, annule l'ancien sub, crée
  le nouveau, retourne approveUrl ✅
- Cancel échec non-fatal (404 sur ancien sub fictif) ✅
- APPROVED → active vérifié dans le code ✅
- Régressions OK (super-admin bypass, comptes active, etc.) ✅

### Note prod
- PayPal est en mode `live`. Pour un test réel, l'utilisateur doit
  avoir un compte PayPal sandbox ou cliquer sur « Payer par carte »
  sur l'écran PayPal (guest checkout). La carte sera facturée en USD
  équivalent à 45 000 XAF (CG) ou 40 USD (autres pays) selon le taux
  de change PayPal du jour.

## PWA installable mobile/tablette/PC (2026-06-02)

### Demande
Permettre d'installer SmartDesk depuis le menu (sidebar) sur mobile, tablette et PC. Choix : 1a (sidebar), 2a (masquer si installé + instructions iOS).

### Implementation

**Assets PWA**
- `/app/public/manifest.json` enrichi : name, short_name, description,
  display=standalone, theme_color=#7a0e1c, scope, shortcuts, et 6 icônes
  PNG (192/256/384/512 + maskable 192/512).
- `/app/public/icons/` : 6 PNG générés (TBI rouge + monogramme "S" blanc).
- `/app/public/sw.js` : service worker minimal, online-first (NEVER cache
  /api/* — risque multi-tenant), cache statique pour shell offline.
- `/app/index.html` : refs manifest, theme-color #7a0e1c, apple-touch-icon,
  apple-mobile-web-app-capable, enregistrement SW au load.

**Frontend**
- `/app/src/lib/useInstallPrompt.ts` : hook React qui capture
  `beforeinstallprompt` (Chrome/Edge/Android), détecte iOS (pas de prompt
  natif), détecte standalone (display-mode + navigator.standalone), expose
  `{ canInstall, isInstalled, isIOS, install() }`.
- `/app/src/components/InstallAppButton.tsx` : bouton rouge dans la sidebar.
  Comportement :
  - Si `isInstalled` → bouton masqué.
  - Si `canInstall` → bouton déclenche `prompt()` natif.
  - Si iOS → ouvre modal avec instructions « Share → Sur l'écran d'accueil ».
  - Sinon → ouvre modal avec instructions génériques (Chrome/Edge/Brave).
  - Modal portailée vers `document.body` (`createPortal`) pour éviter le
    bug visuel quand la sidebar utilise un `transform` parent.
- `/app/src/components/layout/Sidebar.tsx` : `<InstallAppButton collapsed={...}>`
  inséré dans le footer juste au-dessus du profil utilisateur. Réagit au
  mode collapsed (icône seule) et au drawer mobile.

### Vérification visuelle
- `manifest.json`, `sw.js`, icônes → HTTP 200 ✅
- Bouton « INSTALLER L'APPLICATION » visible dans la sidebar ✅
- Modal instructions centrée et lisible (3 étapes + note de bas) ✅

## Sync module Comptabilité + Numéros de comptes (2026-06-07 — iter 15)

### Demande utilisateur
1. Tableau de bord Comptabilité pas synchronisé
2. Voir les numéros de comptes débités/crédités dans les écritures
3. Déclaration TVA pas synchronisée
4. Vérifier que tout le module comptable est bien synchronisé

### Causes
- **POST /api/invoices avec status='Paid'** ne déclenchait PAS `autoPostPaidInvoiceJournal` (uniquement la PUT transition Draft→Paid le faisait). Conséquence : factures créées directement payées (cas `mark-quote-paid`) → pas d'écriture journal automatique.
- **autoPostPaidInvoiceJournal** créait l'écriture sans broadcaster `RESOURCE_CHANGED` (il est appelé depuis un service, pas une route → middleware `resourceChangeBroadcaster` non déclenché).
- **Journal UI** ne montrait pas les numéros de comptes (juste la description + débit/crédit).

### Fixes
**Backend**
- `/app/server/routes/invoices.ts` POST `/` : ajout d'un appel fire-and-forget à `autoPostPaidInvoiceJournal` après `res.status(201).json()` quand `inv.type='Invoice' && inv.status='Paid'`. Avec broadcast `JOURNAL_AUTO_CREATED` en cas de succès.
- `/app/server/services/automations.ts autoPostPaidInvoiceJournal` : import `broadcast` from `../activity.js`, et émet `RESOURCE_CHANGED { resource: 'journalEntries' }` après le COMMIT pour notifier le frontend en temps réel.

**Frontend**
- `/app/src/modules/Accounting.tsx` Journal tab : nouvelle colonne **« Compte »** (placée entre Date et Description) affichant le numéro OHADA en `font-mono font-bold` + le nom du compte (résolu via `OHADA_PCG.find`) en sous-titre 11px. data-testid `journal-account-code-{entryId}-{idx}` sur chaque cellule.
- `useLiveSync(['journalEntries','transactions','invoices'])` déjà câblé sur le module → Dashboard, Journal et TVA se rafraîchissent automatiquement (WebSocket immédiat + polling 10s fallback).

### Validation (iteration_15.json — 8/8 backend + 100% frontend)
- POST /invoices Paid → journal auto avec comptes 521 (Banques), 701 (Ventes), 445 (TVA) ✅
- sourceRef = invoice.id ✅
- Idempotence (pas de doublons) ✅
- PUT Draft→Paid régression OK ✅
- UI Journal affiche les codes OHADA (49 testids vérifiés) ✅
- Sync TVA observée en temps réel : 22 614 000 FC → 22 630 000 FC après création facture ✅
- WebSocket fail en preview, polling 10s compense (cas connu non bloquant) ✅
