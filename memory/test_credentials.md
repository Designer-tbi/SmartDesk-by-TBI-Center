# SmartDesk — Comptes de test

Base PostgreSQL (Neon) — URL dans `/app/.env` (`DATABASE_URL`).

## Super Admins (mot de passe partagé)
- eden@tbi-center.fr / loub@ki2014D
- missengue07@gmail.com / loub@ki2014D
- contact@tbi-center.fr / loub@ki2014D

## Utilisateurs démo (entreprises isolées)
- admin@smartdesk.cg / admin → société `demo-1` (TechCorp Demo)
- admin@greenenergy.demo / admin → société `demo-2` (GreenEnergy Demo)

Chaque entreprise démo dispose de ses propres contacts, produits et factures.
L'isolation est garantie par PostgreSQL Row-Level Security (policies sur
`companyId = current_setting('app.current_company_id')`).

Les mots de passe et les données de démo sont (re)semés par `seedDatabase()`
dans `/app/db.ts` au démarrage du serveur Node (idempotent).
