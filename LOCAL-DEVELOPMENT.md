# Lancement local

Configurer `DATABASE_URL`, `JWT_SECRET` et `APP_URL` dans `.env` (ignoré par Git).
Conserver `SKIP_DATABASE_SEED=true` avec une base existante : le seed historique peut réinitialiser les données de démonstration.

```powershell
npm ci
node --env-file=.env --import tsx server/migrate-local.ts
node --env-file=.env --import tsx server.ts
```

Application : http://localhost:3000.

La migration ciblée ajoute les colonnes `signingToken`, les identifiants légaux manquants et la table de catégories. Elle ne réinitialise pas les données et n’attribue aucune permission aux rôles existants.

## Rôles

Le catalogue de `src/constants.ts` couvre tous les modules de navigation de l’entreprise. Les rôles existants conservent leurs permissions enregistrées. Les nouvelles permissions se configurent dans Utilisateurs & Rôles ; elles ne sont pas automatiquement accordées aux rôles existants.

Les déclarations sont réservées aux rôles admin, super_admin et manager (y compris les identifiants `role_admin_*`, `role_super_admin_*`, `role_manager_*`), avec `declarations.view`/`declarations.edit`. Les rôles RH et les rôles personnalisés ordinaires ne peuvent pas contourner cette restriction, même avec ces permissions. La navigation conserve le filtre pays Congo. La console super-admin est une fonction de plateforme et ne se délègue pas aux rôles d’entreprise.

## Vérification

```powershell
node --import tsx --test server/tests/requested-fixes.test.ts
node --env-file=.env --import tsx server/tests/categories.integration.ts
npm run build
```

Le test d’intégration utilise une entreprise existante et annule ses écritures de test par ROLLBACK. Il ne crée pas de document commercial et n’envoie aucun email.
