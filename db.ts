import { Pool } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rawConnectionString = process.env.DATABASE_URL;
const fallbackString = 'postgresql://neondb_owner:npg_j5oWLtA6DrXs@ep-twilight-hat-adrtam2f-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

export const connectionString = (rawConnectionString && rawConnectionString.startsWith('postgres')) 
  ? rawConnectionString 
  : fallbackString;

export const db = new Pool({
  connectionString,
});

const initSql = `
  CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'real' or 'demo'
    status TEXT NOT NULL DEFAULT 'active',
    country TEXT DEFAULT 'AFRIQUE',
    state TEXT,
    "taxId" TEXT,
    rccm TEXT,
    "idNat" TEXT,
    siren TEXT,
    siret TEXT,
    email TEXT,
    phone TEXT,
    website TEXT,
    address TEXT,
    logo TEXT,
    language TEXT DEFAULT 'fr',
    currency TEXT DEFAULT 'XAF',
    "accountingStandard" TEXT DEFAULT 'OHADA', -- 'OHADA', 'US_GAAP', 'FRANCE'
    "createdAt" TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    "companyId" TEXT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL, -- 'super_admin', 'admin', 'user'
    name TEXT,
    status TEXT DEFAULT 'Active',
    "lastLogin" TEXT,
    FOREIGN KEY ("companyId") REFERENCES companies(id)
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
    "lastContact" TEXT,
    FOREIGN KEY ("companyId") REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    name TEXT NOT NULL,
    sku TEXT,
    price REAL,
    stock INTEGER,
    category TEXT,
    description TEXT,
    type TEXT,
    "tvaRate" REAL,
    FOREIGN KEY ("companyId") REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    type TEXT,
    "contactId" TEXT,
    date TEXT,
    "dueDate" TEXT,
    "totalHT" REAL,
    "tvaTotal" REAL,
    total REAL,
    status TEXT,
    notes TEXT,
    "signatureLink" TEXT,
    "signedAt" TEXT,
    FOREIGN KEY ("companyId") REFERENCES companies(id),
    FOREIGN KEY ("contactId") REFERENCES contacts(id)
  );

  CREATE TABLE IF NOT EXISTS invoice_items (
    id SERIAL PRIMARY KEY,
    "invoiceId" TEXT,
    "productId" TEXT,
    name TEXT,
    description TEXT,
    quantity INTEGER,
    price REAL,
    "tvaRate" REAL,
    "tvaAmount" REAL,
    FOREIGN KEY ("invoiceId") REFERENCES invoices(id)
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    name TEXT NOT NULL,
    client TEXT,
    status TEXT,
    deadline TEXT,
    progress INTEGER,
    description TEXT,
    details TEXT,
    FOREIGN KEY ("companyId") REFERENCES companies(id)
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
    salary REAL,
    "profilePicture" TEXT,
    documents TEXT,
    FOREIGN KEY ("companyId") REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    date TEXT,
    description TEXT,
    category TEXT,
    amount REAL,
    type TEXT,
    FOREIGN KEY ("companyId") REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    date TEXT,
    description TEXT,
    FOREIGN KEY ("companyId") REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS journal_items (
    id SERIAL PRIMARY KEY,
    "journalEntryId" TEXT,
    "accountId" TEXT,
    debit REAL,
    credit REAL,
    FOREIGN KEY ("journalEntryId") REFERENCES journal_entries(id)
  );

  CREATE TABLE IF NOT EXISTS quote_templates (
    id TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    name TEXT NOT NULL,
    notes TEXT,
    FOREIGN KEY ("companyId") REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS quote_template_items (
    id SERIAL PRIMARY KEY,
    "templateId" TEXT,
    "productId" TEXT,
    name TEXT,
    description TEXT,
    quantity INTEGER,
    price REAL,
    "tvaRate" REAL,
    "tvaAmount" REAL,
    FOREIGN KEY ("templateId") REFERENCES quote_templates(id)
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
    FOREIGN KEY ("companyId") REFERENCES companies(id),
    FOREIGN KEY ("employeeId") REFERENCES employees(id)
  );

  CREATE TABLE IF NOT EXISTS payslips (
    id TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    month TEXT NOT NULL,
    year INTEGER NOT NULL,
    "baseSalary" REAL NOT NULL,
    bonuses REAL NOT NULL,
    deductions REAL NOT NULL,
    "netSalary" REAL NOT NULL,
    status TEXT NOT NULL,
    FOREIGN KEY ("companyId") REFERENCES companies(id),
    FOREIGN KEY ("employeeId") REFERENCES employees(id)
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
    "createdAt" TEXT NOT NULL,
    "signatureLink" TEXT,
    "signedAt" TEXT,
    FOREIGN KEY ("companyId") REFERENCES companies(id),
    FOREIGN KEY ("employeeId") REFERENCES employees(id)
  );

  CREATE TABLE IF NOT EXISTS contract_templates (
    id TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    "lastModified" TEXT NOT NULL,
    FOREIGN KEY ("companyId") REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    name TEXT NOT NULL,
    FOREIGN KEY ("companyId") REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS role_permissions (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    PRIMARY KEY ("roleId", "permissionId"),
    FOREIGN KEY ("roleId") REFERENCES roles(id)
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    "companyId" TEXT,
    "userId" TEXT,
    action TEXT NOT NULL,
    details TEXT,
    "createdAt" TEXT NOT NULL,
    FOREIGN KEY ("companyId") REFERENCES companies(id),
    FOREIGN KEY ("userId") REFERENCES users(id)
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
    "createdAt" TEXT NOT NULL,
    FOREIGN KEY ("companyId") REFERENCES companies(id),
    FOREIGN KEY ("userId") REFERENCES users(id),
    FOREIGN KEY ("assignedTo") REFERENCES users(id)
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
    "createdAt" TEXT NOT NULL,
    FOREIGN KEY ("companyId") REFERENCES companies(id),
    FOREIGN KEY ("userId") REFERENCES users(id),
    FOREIGN KEY ("createdBy") REFERENCES users(id)
  );

  ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastLogin" TEXT;
  ALTER TABLE contacts ADD COLUMN IF NOT EXISTS role TEXT;
  ALTER TABLE contacts ADD COLUMN IF NOT EXISTS notes TEXT;
  ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "signedAt" TEXT;
  ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS description TEXT;
  ALTER TABLE employees ADD COLUMN IF NOT EXISTS "profilePicture" TEXT;
  ALTER TABLE employees ADD COLUMN IF NOT EXISTS documents TEXT;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS "accountingStandard" TEXT DEFAULT 'OHADA';
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS siren TEXT;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS siret TEXT;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'fr';
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'XAF';
  ALTER TABLE events ADD COLUMN IF NOT EXISTS "assignedTo" TEXT;
`;

// Initialize database
export async function initializeDatabase() {
  try {
    console.log("Initializing database...");
    await db.query(initSql);
    console.log("Database initialized successfully");
    
    // Verify columns
    const columnsRes = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'companies' AND column_name = 'accountingStandard'
    `);
    if (columnsRes.rows.length === 0) {
      console.log("Adding missing accountingStandard column...");
      await db.query('ALTER TABLE companies ADD COLUMN "accountingStandard" TEXT DEFAULT \'OHADA\'');
      console.log("accountingStandard column added successfully");
    }
    // Verify columns for events
    const eventColumnsRes = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'events' AND column_name = 'assignedTo'
    `);
    if (eventColumnsRes.rows.length === 0) {
      console.log("Adding missing assignedTo column to events...");
      await db.query('ALTER TABLE events ADD COLUMN IF NOT EXISTS "assignedTo" TEXT');
      console.log("assignedTo column added successfully to events");
    }
  } catch (err) {
    console.error("Error initializing database:", err);
  }
}

// Seeding function
export async function seedDatabase(dbInstance: Pool, data: any) {
  try {
    // Ensure database is initialized before seeding
    await initializeDatabase();

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
    if (res1.rows.length === 0) {
      console.log('Seeding super admin: eden@tbi-center.fr');
      const hashedPassword = bcrypt.hashSync('loub@ki2014D', 10);
      await dbInstance.query('INSERT INTO users (id, "companyId", email, password, role, name) VALUES ($1, $2, $3, $4, $5, $6)', 
        ['super_admin_1', defaultCompanyId, 'eden@tbi-center.fr', hashedPassword, 'super_admin', 'Super Admin']);
      console.log('Super admin eden@tbi-center.fr seeded successfully');
    } else {
      console.log('Super admin eden@tbi-center.fr already exists');
    }

    const res2 = await dbInstance.query('SELECT * FROM users WHERE email = $1', ['missengue07@gmail.com']);
    if (res2.rows.length === 0) {
      console.log('Seeding super admin: missengue07@gmail.com');
      const hashedPassword = bcrypt.hashSync('loub@ki2014D', 10);
      await dbInstance.query('INSERT INTO users (id, "companyId", email, password, role, name) VALUES ($1, $2, $3, $4, $5, $6)', 
        ['super_admin_2', defaultCompanyId, 'missengue07@gmail.com', hashedPassword, 'super_admin', 'Admin User']);
      console.log('Super admin missengue07@gmail.com seeded successfully');
    } else {
      console.log('Super admin missengue07@gmail.com already exists');
    }

    console.log('Database seeded successfully with admin accounts');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}
