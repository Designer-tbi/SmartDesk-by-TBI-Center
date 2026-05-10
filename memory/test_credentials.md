# Test Credentials

## Super Admin
- Email: eden@tbi-center.fr
- Password: loub@ki2014D

## Demo Company (CG — Republic of Congo) — Onboarding RESET
- Email: designer@tbi-center.fr
- Password: admin
- Company ID: demo-company-1778004153821
- Country: CG
- onboardingCompleted=false (fresh wizard test)
- Subscription plan: CG_XAF (75 USD ≈ 45 000 XAF / month)

## Demo Company (CD — RDC, currency CDF) — Onboarding RESET
- Email: ariane.mbombo@tbi-center.fr
- Password: admin
- Company ID: demo-company-1777919795902
- Country: CD
- Currency: CDF
- onboardingCompleted=false (fresh wizard test — should NOT ask SFEC key)

## Demo Company (CD — RDC, currency USD) — Already onboarded
- Email: plamedi.fika@tbi-center.fr
- Password: admin
- Company ID: demo-company-1778066583519
- Country: CD
- Currency: USD

## PayPal (production)
- Mode: live
- Plans bootstrapped automatically on first `/api/subscription/create`
- Product ID + plan IDs persisted in `app_config` table
