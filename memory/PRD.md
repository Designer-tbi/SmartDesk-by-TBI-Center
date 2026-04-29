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

## Actions sur devis signés (2026-04-29 — iter 15)

L'utilisateur peut désormais **prévisualiser, télécharger et supprimer**
un devis signé directement depuis la liste Sales.

### Frontend — `/app/src/modules/Sales.tsx`
- `handleDownloadPdf(invoice)` : nouveau handler qui appelle
  `GET /api/invoices/:id/pdf`, convertit la réponse en blob et déclenche
  le téléchargement (filename `Devis_<id>.pdf` ou `Facture_<id>.pdf`).
- Bouton **Download** ajouté entre « Envoyer » et « Modifier » dans
  chaque ligne du tableau (`data-testid="download-pdf-<id>"`), spinner
  pendant la génération.
- Modale d'aperçu : nouveau bloc « Signature électronique » affiché si
  `type === 'Quote' && status === 'Signed'`. Image manuscrite +
  `Signé par` + `Date` + mention eIDAS/OHADA.
- Helper `parseSignature(raw)` : décode soit le JSON
  `{signerName, signatureDataUrl}` (nouveau format public/in-app), soit
  la data-URL nue (rétro-compat).

### Backend — `/app/server/routes/invoices.ts`
- Endpoint `GET /api/invoices/:id/pdf` enrichi : pour les devis signés,
  embed la signature manuscrite via `doc.addImage` (50 × 22 mm), avec
  nom du signataire, date et mention juridique. Détection PNG/JPEG
  d'après la data-URL.

### Validé (curl + Playwright)
- Création + signature publique d'un devis → `status='Signed'`.
- `GET /api/invoices/:id/pdf` (auth démo) → 200, PDF valide 6.8 KB
  contenant « DEVIS » et le nom du signataire.
- Liste Sales : bouton télécharger trouvé via `data-testid` et
  bouton supprimer non désactivé (devis signé non certifié).
- Aperçu modale : bloc signature présent

## Précision signature + descriptions multi-lignes (2026-04-29 — iter 14)
  (`[data-testid="quote-signature-image"]` + `quote-signer-name`
  affiche « Marie Kabongo » + horodatage).


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

