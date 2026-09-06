BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS "paypalOptionStatus" TEXT NOT NULL DEFAULT 'inactive';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS "paypalOptionSubscriptionId" TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS "paypalOptionPeriodEnd" TIMESTAMPTZ;
COMMIT;
