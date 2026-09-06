BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "signingToken" TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS "signingToken" TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS niu TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS rccm TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS "idNat" TEXT;
CREATE TABLE IF NOT EXISTS product_categories (
  "companyId" TEXT NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  PRIMARY KEY ("companyId", name)
);
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON product_categories;
CREATE POLICY tenant_isolation ON product_categories
USING ("companyId" = current_setting('app.current_company_id', true) OR current_setting('app.is_super_admin', true) = 'true')
WITH CHECK ("companyId" = current_setting('app.current_company_id', true) OR current_setting('app.is_super_admin', true) = 'true');
COMMIT;
