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
    country TEXT DEFAULT 'FR',
    state TEXT,
    "taxId" TEXT,
    rccm TEXT,
    "idNat" TEXT,
    email TEXT,
    phone TEXT,
    website TEXT,
    address TEXT,
    logo TEXT,
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

  ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastLogin" TEXT;
  ALTER TABLE contacts ADD COLUMN IF NOT EXISTS role TEXT;
  ALTER TABLE contacts ADD COLUMN IF NOT EXISTS notes TEXT;
  ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "signedAt" TEXT;
  ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS description TEXT;
  ALTER TABLE employees ADD COLUMN IF NOT EXISTS "profilePicture" TEXT;
  ALTER TABLE employees ADD COLUMN IF NOT EXISTS documents TEXT;
`;

// Initialize database
export async function initializeDatabase() {
  try {
    await db.query(initSql);
    console.log("Database initialized successfully");
  } catch (err) {
    console.error("Error initializing database", err);
  }
}

// Seeding function
export async function seedDatabase(dbInstance: Pool, data: any) {
  try {
    // Ensure database is initialized before seeding
    await initializeDatabase();
    
    // Check if super admin exists
    const res1 = await dbInstance.query('SELECT * FROM users WHERE email = $1', ['eden@tbi-center.fr']);
    if (res1.rows.length === 0) {
      const hashedPassword = bcrypt.hashSync('loub@ki2014D', 10);
      await dbInstance.query('INSERT INTO users (id, email, password, role, name) VALUES ($1, $2, $3, $4, $5)', 
        ['super_admin_1', 'eden@tbi-center.fr', hashedPassword, 'super_admin', 'Super Admin']);
    }

    const res2 = await dbInstance.query('SELECT * FROM users WHERE email = $1', ['missengue07@gmail.com']);
    if (res2.rows.length === 0) {
      const hashedPassword = bcrypt.hashSync('loub@ki2014D', 10);
      await dbInstance.query('INSERT INTO users (id, email, password, role, name) VALUES ($1, $2, $3, $4, $5)', 
        ['super_admin_2', 'missengue07@gmail.com', hashedPassword, 'super_admin', 'Admin User']);
    }

    console.log('Database seeded successfully with admin accounts');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}
