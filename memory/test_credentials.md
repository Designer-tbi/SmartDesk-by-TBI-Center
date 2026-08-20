# Test Credentials

Real passwords must never be committed to this file — see the security
fixes on branch `claude/code-verification-0e8qdg`. Store actual values in
your secrets manager / local `.env` and reference the account by email only
here.

## Super Admin
- Email: eden@tbi-center.fr
- Password: set via `SUPER_ADMIN_SEED_PASSWORD` on first seed only (no
  longer hardcoded or reset on every boot — see `db.ts`).

## Demo Company (CG — Republic of Congo) — Onboarding RESET
- Email: designer@tbi-center.fr
- Company ID: demo-company-1778004153821
- Country: CG
- onboardingCompleted=false (fresh wizard test)
- Subscription plan: CG_XAF (75 USD ≈ 45 000 XAF / month)

## Demo Company (CD — RDC, currency CDF) — Onboarding RESET
- Email: ariane.mbombo@tbi-center.fr
- Company ID: demo-company-1777919795902
- Country: CD
- Currency: CDF
- onboardingCompleted=false (fresh wizard test — should NOT ask SFEC key)

## Demo Company (CD — RDC, currency USD) — Already onboarded
- Email: plamedi.fika@tbi-center.fr
- Company ID: demo-company-1778066583519
- Country: CD
- Currency: USD

## PayPal (production)
- Mode: live
- Plans bootstrapped automatically on first `/api/subscription/create`
- Product ID + plan IDs persisted in `app_config` table
