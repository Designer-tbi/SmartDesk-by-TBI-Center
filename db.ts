import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { enableTenantRLS } from './server/tenancy.js';

// Load .env only when running outside Vercel (which injects env vars natively).
// Using a manual parser so we don't depend on dotenv at runtime and stay
// ESM-compatible.
if (!process.env.VERCEL && !process.env.DATABASE_URL) {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) process.env[key] = value;
      }
    }
  } catch {
    /* ignore — rely on OS env vars */
  }
}

const rawConnectionString = process.env.DATABASE_URL;
const fallbackString = 'postgresql://neondb_owner:npg_j5oWLtA6DrXs@ep-twilight-hat-adrtam2f-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';

export const connectionString = (rawConnectionString && rawConnectionString.startsWith('postgres')) 
  ? (rawConnectionString.includes('sslmode=') ? rawConnectionString : `${rawConnectionString}${rawConnectionString.includes('?') ? '&' : '?'}sslmode=require`)
  : fallbackString;

export const db = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  // Aggressively short timeouts so a slow Neon cold-start never burns the
  // whole 10s Vercel serverless budget on a single connection attempt.
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: process.env.VERCEL ? 1 : 10,
});

// Catch idle client errors to prevent Node.js process from crashing
db.on('error', (err) => {
  console.error('Unexpected error on idle database client:', err.message);
  // We don't exit the process here to keep the server running
});

const initSql = `
  CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('real', 'demo')),
    status TEXT NOT NULL DEFAULT 'active',
    country TEXT DEFAULT 'AFRIQUE',
    state TEXT,
    "taxId" TEXT,
    rccm TEXT,
    "idNat" TEXT,
    niu TEXT,
    siren TEXT,
    siret TEXT,
    email TEXT,
    phone TEXT,
    website TEXT,
    address TEXT,
    logo TEXT,
    language TEXT DEFAULT 'fr',
    currency TEXT DEFAULT 'XAF',
    "accountingStandard" TEXT DEFAULT 'OHADA',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    "companyId" TEXT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    name TEXT,
    status TEXT DEFAULT 'Active',
    "lastLogin" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    role TEXT,
    notes TEXT,
    status TEXT,
    "lastContact" TIMESTAMPTZ,
    niu TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    name TEXT NOT NULL,
    sku TEXT,
    price REAL DEFAULT 0,
    stock INTEGER DEFAULT 0,
    category TEXT,
    description TEXT,
    type TEXT,
    "tvaRate" REAL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    type TEXT NOT NULL, -- 'Invoice', 'Quote', 'Credit'
    "contactId" TEXT,
    date TEXT,
    "dueDate" TEXT,
    "totalHT" REAL DEFAULT 0,
    "tvaTotal" REAL DEFAULT 0,
    total REAL DEFAULT 0,
    status TEXT,
    notes TEXT,
    "signatureLink" TEXT,
    "signedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY ("contactId") REFERENCES contacts(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS invoice_items (
    id SERIAL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "productId" TEXT,
    name TEXT NOT NULL,
    description TEXT,
    quantity INTEGER DEFAULT 1,
    price REAL DEFAULT 0,
    "tvaRate" REAL DEFAULT 0,
    "tvaAmount" REAL DEFAULT 0,
    FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY ("invoiceId") REFERENCES invoices(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    name TEXT NOT NULL,
    client TEXT,
    "contactId" TEXT,
    status TEXT,
    deadline TEXT,
    "startDate" TEXT,
    progress INTEGER DEFAULT 0,
    description TEXT,
    details TEXT,
    priority TEXT DEFAULT 'Medium',
    budget REAL DEFAULT 0,
    "teamIds" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY ("contactId") REFERENCES contacts(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT,
    department TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    status TEXT,
    "contractType" TEXT,
    "joinDate" TEXT,
    salary REAL DEFAULT 0,
    "profilePicture" TEXT,
    documents TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    date TEXT,
    description TEXT,
    category TEXT,
    amount REAL DEFAULT 0,
    type TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    date TEXT,
    description TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS journal_items (
    id SERIAL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    debit REAL DEFAULT 0,
    credit REAL DEFAULT 0,
    FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY ("journalEntryId") REFERENCES journal_entries(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS quote_templates (
    id TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    name TEXT NOT NULL,
    notes TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS quote_template_items (
    id SERIAL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "productId" TEXT,
    name TEXT NOT NULL,
    description TEXT,
    quantity INTEGER DEFAULT 1,
    price REAL DEFAULT 0,
    "tvaRate" REAL DEFAULT 0,
    "tvaAmount" REAL DEFAULT 0,
    FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY ("templateId") REFERENCES quote_templates(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS leave_requests (
    id TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    type TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    status TEXT NOT NULL,
    reason TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY ("employeeId") REFERENCES employees(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS payslips (
    id TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    month TEXT NOT NULL,
    year INTEGER NOT NULL,
    "baseSalary" REAL NOT NULL,
    bonuses REAL DEFAULT 0,
    deductions REAL DEFAULT 0,
    "netSalary" REAL NOT NULL,
    status TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY ("employeeId") REFERENCES employees(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS contracts (
    id TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    type TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    salary REAL NOT NULL,
    status TEXT NOT NULL,
    content TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "signatureLink" TEXT,
    "signedAt" TIMESTAMPTZ,
    FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY ("employeeId") REFERENCES employees(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS contract_templates (
    id TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    "lastModified" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    name TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS role_permissions (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    PRIMARY KEY ("roleId", "permissionId"),
    FOREIGN KEY ("roleId") REFERENCES roles(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    "companyId" TEXT,
    "userId" TEXT,
    action TEXT NOT NULL,
    details TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedTo" TEXT,
    title TEXT NOT NULL,
    description TEXT,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    category TEXT,
    "isPrivate" BOOLEAN DEFAULT FALSE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY ("assignedTo") REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    type TEXT,
    status TEXT DEFAULT 'published',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY ("createdBy") REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    "companyId" TEXT,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "lastActivity" TIMESTAMPTZ,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS employee_tasks (
    id TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    status TEXT DEFAULT 'Todo',
    priority TEXT DEFAULT 'Medium',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY ("employeeId") REFERENCES employees(id) ON DELETE CASCADE
  );

  -- Schema updates for existing tables
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE users ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE users ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE contacts ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE contacts ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE journal_items ADD COLUMN IF NOT EXISTS "companyId" TEXT;
  ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS "companyId" TEXT;
  ALTER TABLE transactions ADD COLUMN IF NOT EXISTS "companyId" TEXT;
  ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS "companyId" TEXT;
  ALTER TABLE quote_templates ADD COLUMN IF NOT EXISTS "companyId" TEXT;
  ALTER TABLE quote_template_items ADD COLUMN IF NOT EXISTS "companyId" TEXT;

  -- Indexes for multi-company isolation and performance
  CREATE INDEX IF NOT EXISTS idx_users_company ON users("companyId");
  CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts("companyId");
  CREATE INDEX IF NOT EXISTS idx_products_company ON products("companyId");
  CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices("companyId");
  CREATE INDEX IF NOT EXISTS idx_invoice_items_company ON invoice_items("companyId");
  CREATE INDEX IF NOT EXISTS idx_projects_company ON projects("companyId");
  CREATE INDEX IF NOT EXISTS idx_employees_company ON employees("companyId");
  CREATE INDEX IF NOT EXISTS idx_transactions_company ON transactions("companyId");
  CREATE INDEX IF NOT EXISTS idx_journal_entries_company ON journal_entries("companyId");
  CREATE INDEX IF NOT EXISTS idx_journal_items_company ON journal_items("companyId");
  CREATE INDEX IF NOT EXISTS idx_activity_log_company ON activity_log("companyId");
  CREATE INDEX IF NOT EXISTS idx_events_company ON events("companyId");
  CREATE INDEX IF NOT EXISTS idx_schedules_company ON schedules("companyId");
  CREATE INDEX IF NOT EXISTS idx_sessions_company ON sessions("companyId");
  CREATE INDEX IF NOT EXISTS idx_companies_type ON companies(type);
  CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);
  CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
  CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date);
  CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log("createdAt");
  CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items("invoiceId");
  CREATE INDEX IF NOT EXISTS idx_journal_items_entry_id ON journal_items("journalEntryId");
  CREATE INDEX IF NOT EXISTS idx_events_start_date ON events("startDate");
  CREATE INDEX IF NOT EXISTS idx_schedules_start_date ON schedules("startDate");
`;

// Initialize database
export async function initializeDatabase() {
  try {
    console.log("Initializing database...");
    
    // Check connection first
    await db.query('SELECT 1');

    // Fast-path: if a previous run already finished initialization, skip the
    // heavy ALTER/CREATE/RLS work. This is critical on Vercel serverless,
    // where every cold start would otherwise re-run 80+ DDL statements and
    // hit the function timeout.
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS _app_meta (
          key TEXT PRIMARY KEY,
          value TEXT,
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      const flag = await db.query(
        `SELECT value FROM _app_meta WHERE key = 'schema_version'`,
      );
      if (flag.rows[0]?.value === '2026-04-17-invoice-certif') {
        console.log('Database schema already up-to-date, skipping init.');
        return;
      }

      // Second fast-path: if the core tables already exist AND RLS is
      // already enabled on `contacts`, we're fine. Just mark and exit
      // without re-running DDL. This handles the transition from the
      // previous deploy (which initialized everything) to this one.
      const rlsCheck = await db.query(`
        SELECT c.relrowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'contacts'
      `);
      if (rlsCheck.rows[0]?.relrowsecurity === true) {
        console.log('Tables exist & RLS already enabled, applying incremental migrations.');
        // Idempotent migrations that must run regardless of schema_version.
        await db.query(
          `ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb`,
        );
        await db.query('ALTER TABLE contacts ADD COLUMN IF NOT EXISTS niu TEXT');
        await db.query('ALTER TABLE contacts ADD COLUMN IF NOT EXISTS address TEXT');
        await db.query(
          `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS "contactType" TEXT DEFAULT 'professionnel'`,
        );
        await db.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS "firstLoginAt" TIMESTAMPTZ`);
        await db.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS "demoExpiresAt" TIMESTAMPTZ`);
        await db.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS niu TEXT`);
        await db.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS "fiscalizationApiKey" TEXT`);
        await db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "certificationNumber" TEXT`);
        await db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "certifiedAt" TIMESTAMPTZ`);
        await db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "certificationStatus" TEXT`);
        await db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "certificationPayload" JSONB`);
        await db.query(
          `UPDATE companies SET "fiscalizationApiKey" = $1
           WHERE type = 'demo' AND ("fiscalizationApiKey" IS NULL OR "fiscalizationApiKey" = '')`,
          [process.env.DGID_DEMO_API_KEY || '97ecc2858d30bfe83f8f4b4f66250fd5eda6c41af396dada290ea4144bfd943c'],
        );
        await db.query(`
          INSERT INTO _app_meta (key, value, "updatedAt")
          VALUES ('schema_version', '2026-04-17-invoice-certif', NOW())
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = NOW()
        `);
        return;
      }
    } catch (err) {
      // If the fast-path itself fails (e.g. no permission), just continue
      // with the full init — worst case we redo idempotent work.
      console.error('Schema version check failed, running full init:', err);
    }

    // Split initSql into individual statements to handle potential errors better
    const statements = initSql.split(';').filter(s => s.trim().length > 0);
    for (const statement of statements) {
      try {
        await db.query(statement);
      } catch (err) {
        console.error("Error executing statement:", statement.substring(0, 50) + "...", err);
      }
    }
    
    console.log("Database initialized successfully");
    
    // Verify employee_tasks exists
    const checkRes = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'employee_tasks'
      );
    `);
    console.log("employee_tasks exists:", checkRes.rows[0].exists);
    
    if (!checkRes.rows[0].exists) {
      console.log("Manually creating employee_tasks...");
      await db.query(`
        CREATE TABLE IF NOT EXISTS employee_tasks (
          id TEXT PRIMARY KEY,
          "companyId" TEXT NOT NULL,
          "employeeId" TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          date TEXT NOT NULL,
          "startTime" TEXT,
          "endTime" TEXT,
          status TEXT DEFAULT 'Todo',
          priority TEXT DEFAULT 'Medium',
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE CASCADE,
          FOREIGN KEY ("employeeId") REFERENCES employees(id) ON DELETE CASCADE
        );
      `);
    }
    const tablesToUpdate = [
      'companies', 'users', 'contacts', 'products', 'invoices', 'projects', 
      'employees', 'transactions', 'journal_entries', 'quote_templates', 
      'leave_requests', 'payslips', 'contracts', 'contract_templates', 
      'roles', 'activity_log', 'events', 'schedules', 'sessions', 'employee_tasks'
    ];

    for (const table of tablesToUpdate) {
      try {
        const colRes = await db.query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = 'updatedAt'
        `, [table]);
        
        if (colRes.rows.length === 0 && !['transactions', 'journal_entries', 'activity_log', 'leave_requests', 'payslips', 'journal_items', 'invoice_items', 'quote_template_items'].includes(table)) {
          console.log(`Adding updatedAt to ${table}...`);
          await db.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW()`);
        }

        const createdColRes = await db.query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = 'createdAt'
        `, [table]);

        if (createdColRes.rows.length === 0 && table !== 'role_permissions') {
          console.log(`Adding createdAt to ${table}...`);
          await db.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW()`);
        }
      } catch (err) {
        console.error(`Error updating columns for table ${table}:`, err);
      }
    }

    // Specific fixes
    await db.query('ALTER TABLE companies ADD COLUMN IF NOT EXISTS "accountingStandard" TEXT DEFAULT \'OHADA\'');
    await db.query('ALTER TABLE events ADD COLUMN IF NOT EXISTS "assignedTo" TEXT');
    await db.query('ALTER TABLE sessions ALTER COLUMN "companyId" DROP NOT NULL');
    await db.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS "startDate" TEXT');
    await db.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS "priority" TEXT DEFAULT \'Medium\'');
    await db.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS "budget" REAL DEFAULT 0');
    await db.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS "contactId" TEXT');
    await db.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS "teamIds" TEXT');
    await db.query('ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS "companyId" TEXT');
    await db.query('ALTER TABLE quote_template_items ADD COLUMN IF NOT EXISTS "companyId" TEXT');
    await db.query('ALTER TABLE contacts ADD COLUMN IF NOT EXISTS niu TEXT');
    await db.query('ALTER TABLE contacts ADD COLUMN IF NOT EXISTS address TEXT');
    await db.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS "contactType" TEXT DEFAULT 'professionnel'`);
    // Demo lifecycle — track first login so we can auto-deactivate demo
    // companies 15 days after the first sign-in (lazy enforcement on login).
    await db.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS "firstLoginAt" TIMESTAMPTZ`);
    await db.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS "demoExpiresAt" TIMESTAMPTZ`);
    // NIU (Numéro d'Identification Unique) — used by CEMAC/OHADA tax admins
    // and displayed on invoices, fiscal liasse and declarations.
    await db.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS niu TEXT`);
    // DGID invoice fiscalization (per-company API key + invoice cert fields).
    await db.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS "fiscalizationApiKey" TEXT`);
    await db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "certificationNumber" TEXT`);
    await db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "certifiedAt" TIMESTAMPTZ`);
    await db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "certificationStatus" TEXT`);
    await db.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "certificationPayload" JSONB`);
    // Auto-propagate the default DGID key to every existing demo company that
    // doesn't have one yet. New demo companies get it on creation (see
    // /api/auth/send-demo-email).
    await db.query(
      `UPDATE companies
       SET "fiscalizationApiKey" = $1
       WHERE type = 'demo' AND ("fiscalizationApiKey" IS NULL OR "fiscalizationApiKey" = '')`,
      [process.env.DGID_DEMO_API_KEY || '97ecc2858d30bfe83f8f4b4f66250fd5eda6c41af396dada290ea4144bfd943c'],
    );
    // Per-user preferences (language, sidebar state, etc.) stored in DB so
    // that the frontend can get rid of localStorage entirely.
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb`);
    
    // Ensure companies.type has the check constraint
    try {
      await db.query("ALTER TABLE companies ADD CONSTRAINT check_company_type CHECK (type IN ('real', 'demo'))");
    } catch (e) {
      // Constraint might already exist
    }

    // Enable Row-Level Security so that every tenant table is strictly
    // isolated at the DB layer (demo vs production companies included).
    await enableTenantRLS(db);

    // Mark schema as initialized so future cold starts can short-circuit.
    try {
      await db.query(`
        INSERT INTO _app_meta (key, value, "updatedAt")
        VALUES ('schema_version', '2026-04-17-invoice-certif', NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = NOW()
      `);
    } catch (err) {
      console.error('Could not write schema_version:', err);
    }
  } catch (err) {
    console.error("Error initializing database:", err);
  }
}

// Seeding function
export async function initializeTenantSchema(schemaName: string) {
  const client = await db.connect();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
    await client.query(`SET search_path TO ${schemaName}`);

    // Create tenant-specific tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id TEXT PRIMARY KEY,
        "userId" TEXT,
        "companyId" TEXT,
        action TEXT NOT NULL,
        details TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT,
        amount REAL NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('Income', 'Expense')),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS journal_entries (
        id TEXT PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS journal_items (
        id SERIAL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "journalEntryId" TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
        "accountId" TEXT NOT NULL,
        debit REAL DEFAULT 0,
        credit REAL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS quote_templates (
        id TEXT PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        name TEXT NOT NULL,
        notes TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS quote_template_items (
        id SERIAL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "templateId" TEXT NOT NULL REFERENCES quote_templates(id) ON DELETE CASCADE,
        "productId" TEXT,
        name TEXT NOT NULL,
        description TEXT,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        "tvaRate" REAL DEFAULT 0,
        "tvaAmount" REAL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS invoice_items (
        id SERIAL PRIMARY KEY,
        "companyId" TEXT NOT NULL,
        "invoiceId" TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        "productId" TEXT,
        name TEXT NOT NULL,
        description TEXT,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        "tvaRate" REAL DEFAULT 0,
        "tvaAmount" REAL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query('SET search_path TO public');
  } finally {
    client.release();
  }
}

export async function seedDatabase(dbInstance: Pool) {
  try {
    // Ensure database is initialized before seeding
    await initializeDatabase();

    // Fast-path: if seeding was already done in a previous run, skip.
    try {
      const seedFlag = await dbInstance.query(
        `SELECT value FROM _app_meta WHERE key = 'seed_version'`,
      );
      if (seedFlag.rows[0]?.value === '2026-04-17-cg-default') {
        return;
      }
    } catch {
      /* table may not exist yet — continue with full seed */
    }

    // Seeding runs outside of a user request, so we need to bypass RLS.
    // We grab a dedicated client, flag it as "super-admin" for the duration
    // of the seed and use it for every write.
    const seedClient = await dbInstance.connect();
    try {
      await seedClient.query(
        `SELECT set_config('app.is_super_admin', 'true', false)`,
      );
      await runSeed(seedClient);

      // Mark seed as done so future cold starts can skip it instantly.
      await seedClient.query(`
        INSERT INTO _app_meta (key, value, "updatedAt")
        VALUES ('seed_version', '2026-04-17-cg-default', NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = NOW()
      `).catch(() => {});
    } finally {
      await seedClient.query(
        `SELECT set_config('app.is_super_admin', 'false', false)`,
      ).catch(() => {});
      seedClient.release();
    }
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}

async function runSeed(dbInstance: any) {
  try {
    // Check if any company exists
    const companyRes = await dbInstance.query('SELECT * FROM companies LIMIT 1');
    let defaultCompanyId = 'comp_default';
    if (companyRes.rows.length === 0) {
      await dbInstance.query(`
        INSERT INTO companies (id, name, type, status, address, email, phone, website, "taxId", rccm, "idNat", "createdAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        defaultCompanyId, 
        'SmartDesk', 
        'real', 
        'active', 
        'Avenue de la Paix, Brazzaville, République du Congo',
        'contact@smartdesk.cg',
        '+242 06 600 00 00',
        'https://smartdesk.cg',
        'NIF: 1234567A',
        'RCCM: CG-BZV-01-2024-B12-00001',
        'ID NAT: 01-123-A4567B',
        new Date().toISOString()
      ]);
    } else {
      defaultCompanyId = companyRes.rows[0].id;
    }
    
    // Check if super admin exists
    const res1 = await dbInstance.query('SELECT * FROM users WHERE email = $1', ['eden@tbi-center.fr']);
    const adminPassword = 'loub@ki2014D';
    const hashedAdminPassword = bcrypt.hashSync(adminPassword, 10);
    
    if (res1.rows.length === 0) {
      console.log('Seeding super admin: eden@tbi-center.fr');
      await dbInstance.query('INSERT INTO users (id, "companyId", email, password, role, name) VALUES ($1, $2, $3, $4, $5, $6)', 
        ['super_admin_1', defaultCompanyId, 'eden@tbi-center.fr', hashedAdminPassword, 'super_admin', 'Super Admin']);
    } else {
      console.log('Updating super admin password: eden@tbi-center.fr');
      await dbInstance.query('UPDATE users SET password = $1 WHERE email = $2', [hashedAdminPassword, 'eden@tbi-center.fr']);
    }

    const res2 = await dbInstance.query('SELECT * FROM users WHERE email = $1', ['missengue07@gmail.com']);
    if (res2.rows.length === 0) {
      console.log('Seeding super admin: missengue07@gmail.com');
      await dbInstance.query('INSERT INTO users (id, "companyId", email, password, role, name) VALUES ($1, $2, $3, $4, $5, $6)', 
        ['super_admin_2', defaultCompanyId, 'missengue07@gmail.com', hashedAdminPassword, 'super_admin', 'Admin User']);
    } else {
      console.log('Updating super admin password: missengue07@gmail.com');
      await dbInstance.query('UPDATE users SET password = $1 WHERE email = $2', [hashedAdminPassword, 'missengue07@gmail.com']);
    }

    const res4 = await dbInstance.query('SELECT * FROM users WHERE email = $1', ['contact@tbi-center.fr']);
    if (res4.rows.length === 0) {
      console.log('Seeding super admin: contact@tbi-center.fr');
      await dbInstance.query('INSERT INTO users (id, "companyId", email, password, role, name) VALUES ($1, $2, $3, $4, $5, $6)', 
        ['super_admin_3', defaultCompanyId, 'contact@tbi-center.fr', hashedAdminPassword, 'super_admin', 'Contact Admin']);
    } else {
      console.log('Updating super admin password: contact@tbi-center.fr');
      await dbInstance.query('UPDATE users SET password = $1 WHERE email = $2', [hashedAdminPassword, 'contact@tbi-center.fr']);
    }

    // Seed demo companies (default country = CG — marché cible du Congo,
    // le libellé du champ "NIU" s'affichera correctement dans le CRM).
    const demoCompanies = [
      { id: 'demo-1', name: 'TechCorp Demo', type: 'demo' },
      { id: 'demo-2', name: 'GreenEnergy Demo', type: 'demo' }
    ];
    for (const dc of demoCompanies) {
      const res = await dbInstance.query('SELECT * FROM companies WHERE id = $1', [dc.id]);
      if (res.rows.length === 0) {
        console.log(`Seeding demo company: ${dc.name}`);
        await dbInstance.query(`
          INSERT INTO companies (id, name, type, status, country, address, email, phone, website, "taxId", rccm, "idNat", "createdAt")
          VALUES ($1, $2, $3, $4, 'CG', $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          dc.id, dc.name, dc.type, 'active', 'Demo Address', 'demo@' + dc.id + '.com', '+242 00 000 00 00', 'https://demo.com', 'NIF: DEMO', 'RCCM: DEMO', 'ID NAT: DEMO', new Date().toISOString()
        ]);
      } else {
        // Backfill — align existing demo companies to the Congo defaults
        // so the CRM shows the correct locale-specific labels.
        await dbInstance.query(
          `UPDATE companies SET country = 'CG' WHERE id = $1 AND (country IS NULL OR country = 'FR')`,
          [dc.id],
        );
      }
    }

    // Seed default roles for all existing companies
    const companies = await dbInstance.query('SELECT id FROM companies');
    for (const company of companies.rows) {
      await seedDefaultRoles(dbInstance, company.id);
    }

    // Seed demo user
    const demoUserEmail = 'admin@smartdesk.cg';
    const res3 = await dbInstance.query('SELECT * FROM users WHERE email = $1', [demoUserEmail]);
    const hashedDemoPassword = bcrypt.hashSync('admin', 10);
    
    if (res3.rows.length === 0) {
      console.log(`Seeding demo user: ${demoUserEmail}`);
      const adminRoleId = `role_admin_demo-1`;
      await dbInstance.query('INSERT INTO users (id, "companyId", email, password, role, name) VALUES ($1, $2, $3, $4, $5, $6)', 
        ['demo_user_1', 'demo-1', demoUserEmail, hashedDemoPassword, adminRoleId, 'Demo Admin']);
    } else {
      console.log(`Updating demo user password: ${demoUserEmail}`);
      await dbInstance.query('UPDATE users SET password = $1 WHERE email = $2', [hashedDemoPassword, demoUserEmail]);
    }

    // Seed an admin user for demo-2 as well so each demo company is
    // independently usable & auditable.
    const demo2Email = 'admin@greenenergy.demo';
    const res5 = await dbInstance.query('SELECT * FROM users WHERE email = $1', [demo2Email]);
    if (res5.rows.length === 0) {
      console.log(`Seeding demo user: ${demo2Email}`);
      await dbInstance.query(
        'INSERT INTO users (id, "companyId", email, password, role, name) VALUES ($1, $2, $3, $4, $5, $6)',
        ['demo_user_2', 'demo-2', demo2Email, hashedDemoPassword, `role_admin_demo-2`, 'GreenEnergy Admin'],
      );
    } else {
      await dbInstance.query('UPDATE users SET password = $1 WHERE email = $2', [hashedDemoPassword, demo2Email]);
    }

    // NOTE : les nouvelles entreprises démo démarrent avec 0 donnée CRM —
    // elles sont prêtes à être vendues. Aucun seed de contacts / produits
    // / factures n'est effectué ici, afin de ne pas polluer l'espace client.

    // Nettoyage one-shot des anciennes données démo (CRM, produits, factures)
    // pour s'assurer que les tenants démo sont bien vides après migration.
    await clearDemoTenantData(dbInstance);

    console.log('Database seeded successfully with admin and demo accounts');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}

/**
 * Purge all tenant data (CRM, inventory, invoices, projects, accounting) of
 * every demo company so the tenants are factory-fresh, ready for sales.
 * Runs once when seed_version reaches the "2026-04-17-clean-demo" marker.
 */
export async function clearDemoTenantData(dbInstance: any) {
  const demoIds = await dbInstance.query(
    `SELECT id FROM companies WHERE type = 'demo'`,
  );
  if (demoIds.rows.length === 0) return;
  const ids = demoIds.rows.map((r: any) => r.id);

  const tables = [
    'invoice_items', 'invoices',
    'journal_items', 'journal_entries',
    'quote_template_items', 'quote_templates',
    'employee_tasks', 'leave_requests', 'payslips', 'contracts', 'contract_templates', 'employees',
    'transactions',
    'projects',
    'products',
    'contacts',
    'events', 'schedules',
    'activity_log',
  ];
  for (const t of tables) {
    try {
      await dbInstance.query(`DELETE FROM ${t} WHERE "companyId" = ANY($1::text[])`, [ids]);
    } catch (err: any) {
      // Table may not exist in the schema — ignore.
      if (err?.code !== '42P01') {
        console.error(`Failed to clear ${t}:`, err?.message);
      }
    }
  }
  console.log(`Purged CRM/accounting data of ${ids.length} demo compan${ids.length === 1 ? 'y' : 'ies'}.`);
}

/**
 * Called when creating a brand-new company. Starts it truly empty (no seed
 * data other than default roles — which are created elsewhere by the caller).
 */
export async function seedDemoCompanyData(_dbInstance: any, _companyId: string, _label: string) {
  // Intentionally a no-op. New companies (demo and production) must start
  // fresh with zero CRM rows so the first impression the customer gets is
  // a clean slate they fill themselves.
  return;
}

export async function seedDefaultRoles(dbInstance: any, companyId: string) {
  const roles = [
    { id: `role_admin_${companyId}`, name: 'Administrator', permissions: ['all'] },
    { id: `role_manager_${companyId}`, name: 'Manager', permissions: ['crm.view', 'crm.edit', 'sales.view', 'sales.edit', 'inventory.view', 'hr.view', 'projects.view', 'projects.edit'] },
    { id: `role_sales_${companyId}`, name: 'Sales Representative', permissions: ['crm.view', 'crm.edit', 'sales.view', 'sales.edit'] },
    { id: `role_accountant_${companyId}`, name: 'Accountant', permissions: ['accounting.view', 'accounting.edit', 'sales.view'] },
    { id: `role_user_${companyId}`, name: 'User', permissions: ['crm.view', 'sales.view'] }
  ];

  for (const role of roles) {
    const roleExists = await dbInstance.query('SELECT id FROM roles WHERE id = $1', [role.id]);
    if (roleExists.rows.length === 0) {
      await dbInstance.query('INSERT INTO roles (id, "companyId", name) VALUES ($1, $2, $3)', [role.id, companyId, role.name]);
      for (const perm of role.permissions) {
        await dbInstance.query('INSERT INTO role_permissions ("roleId", "permissionId") VALUES ($1, $2)', [role.id, perm]);
      }
    }
  }
}

/**
 * Seed a small, self-contained set of sample data for a demo company.
 *
 * Each demo tenant gets ITS OWN contacts, products and invoice — every row
 * carries the correct `companyId`, and Row-Level Security guarantees that
 * users of demo-1 never see rows from demo-2 (and vice-versa).
 */

// Legacy seedDemoCompanyData body removed: new companies now start empty
// (see the no-op `seedDemoCompanyData` declared earlier in this file).

