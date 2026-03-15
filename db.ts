import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const db = new Database('database.sqlite');

const initSql = `
  CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'real' or 'demo'
    status TEXT NOT NULL DEFAULT 'active',
    country TEXT DEFAULT 'FR',
    state TEXT,
    taxId TEXT,
    rccm TEXT,
    idNat TEXT,
    email TEXT,
    phone TEXT,
    website TEXT,
    address TEXT,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    companyId TEXT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL, -- 'super_admin', 'admin', 'user'
    name TEXT,
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    status TEXT,
    lastContact TEXT,
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    name TEXT NOT NULL,
    sku TEXT,
    price REAL,
    stock INTEGER,
    category TEXT,
    description TEXT,
    type TEXT,
    tvaRate REAL,
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    type TEXT,
    contactId TEXT,
    date TEXT,
    dueDate TEXT,
    totalHT REAL,
    tvaTotal REAL,
    total REAL,
    status TEXT,
    notes TEXT,
    signatureLink TEXT,
    FOREIGN KEY (companyId) REFERENCES companies(id),
    FOREIGN KEY (contactId) REFERENCES contacts(id)
  );

  CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoiceId TEXT,
    productId TEXT,
    name TEXT,
    quantity INTEGER,
    price REAL,
    tvaRate REAL,
    tvaAmount REAL,
    FOREIGN KEY (invoiceId) REFERENCES invoices(id)
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    name TEXT NOT NULL,
    client TEXT,
    status TEXT,
    deadline TEXT,
    progress INTEGER,
    description TEXT,
    details TEXT,
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT,
    department TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    status TEXT,
    contractType TEXT,
    joinDate TEXT,
    salary REAL,
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    date TEXT,
    description TEXT,
    category TEXT,
    amount REAL,
    type TEXT,
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    companyId TEXT NOT NULL,
    date TEXT,
    description TEXT,
    FOREIGN KEY (companyId) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS journal_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    journalEntryId TEXT,
    accountId TEXT,
    debit REAL,
    credit REAL,
    FOREIGN KEY (journalEntryId) REFERENCES journal_entries(id)
  );
`;

db.exec(initSql);

// Seeding function
export function seedDatabase(dbInstance: Database.Database, data: any) {
  // Check if super admin exists
  const superAdmin = dbInstance.prepare('SELECT * FROM users WHERE email = ?').get('eden@tbi-center.fr');
  if (!superAdmin) {
    const hashedPassword = bcrypt.hashSync('loub@ki2014D', 10);
    dbInstance.prepare('INSERT INTO users (id, email, password, role, name) VALUES (?, ?, ?, ?, ?)')
      .run('super_admin_1', 'eden@tbi-center.fr', hashedPassword, 'super_admin', 'Super Admin');
  }

  const userAdmin = dbInstance.prepare('SELECT * FROM users WHERE email = ?').get('missengue07@gmail.com');
  if (!userAdmin) {
    const hashedPassword = bcrypt.hashSync('loub@ki2014D', 10);
    dbInstance.prepare('INSERT INTO users (id, email, password, role, name) VALUES (?, ?, ?, ?, ?)')
      .run('super_admin_2', 'missengue07@gmail.com', hashedPassword, 'super_admin', 'Admin User');
  }

  console.log('Database seeded successfully with admin accounts');
}
