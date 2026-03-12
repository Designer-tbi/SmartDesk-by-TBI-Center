import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database('database.sqlite');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    status TEXT,
    lastContact TEXT
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT,
    price REAL,
    stock INTEGER,
    category TEXT,
    description TEXT,
    type TEXT,
    tvaRate REAL
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
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
    name TEXT NOT NULL,
    client TEXT,
    status TEXT,
    deadline TEXT,
    progress INTEGER,
    description TEXT,
    details TEXT
  );

  CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT,
    department TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    status TEXT,
    contractType TEXT,
    joinDate TEXT,
    salary REAL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    date TEXT,
    description TEXT,
    category TEXT,
    amount REAL,
    type TEXT
  );

  CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    date TEXT,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS journal_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    journalEntryId TEXT,
    accountId TEXT,
    debit REAL,
    credit REAL,
    FOREIGN KEY (journalEntryId) REFERENCES journal_entries(id)
  );
`);

// Seeding function
export function seedDatabase(data: any) {
  const { 
    MOCK_CONTACTS, 
    MOCK_PRODUCTS, 
    MOCK_INVOICES, 
    MOCK_PROJECTS, 
    MOCK_EMPLOYEES,
    MOCK_TRANSACTIONS,
    MOCK_JOURNAL_ENTRIES
  } = data;

  // Check if already seeded
  const count = db.prepare('SELECT COUNT(*) as count FROM contacts').get() as { count: number };
  if (count.count > 0) return;

  const insertContact = db.prepare('INSERT INTO contacts (id, name, email, phone, company, status, lastContact) VALUES (?, ?, ?, ?, ?, ?, ?)');
  MOCK_CONTACTS.forEach((c: any) => insertContact.run(c.id, c.name, c.email, c.phone, c.company, c.status, c.lastContact));

  const insertProduct = db.prepare('INSERT INTO products (id, name, sku, price, stock, category, description, type, tvaRate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  MOCK_PRODUCTS.forEach((p: any) => insertProduct.run(p.id, p.name, p.sku, p.price, p.stock, p.category, p.description, p.type, p.tvaRate));

  const insertInvoice = db.prepare('INSERT INTO invoices (id, type, contactId, date, dueDate, totalHT, tvaTotal, total, status, notes, signatureLink) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertInvoiceItem = db.prepare('INSERT INTO invoice_items (invoiceId, productId, name, quantity, price, tvaRate, tvaAmount) VALUES (?, ?, ?, ?, ?, ?, ?)');
  
  MOCK_INVOICES.forEach((inv: any) => {
    insertInvoice.run(inv.id, inv.type, inv.contactId, inv.date, inv.dueDate, inv.totalHT, inv.tvaTotal, inv.total, inv.status, inv.notes || null, inv.signatureLink || null);
    inv.items.forEach((item: any) => {
      insertInvoiceItem.run(inv.id, item.productId, item.name, item.quantity, item.price, item.tvaRate, item.tvaAmount);
    });
  });

  const insertProject = db.prepare('INSERT INTO projects (id, name, client, status, deadline, progress, description, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  MOCK_PROJECTS.forEach((p: any) => insertProject.run(p.id, p.name, p.client, p.status, p.deadline, p.progress, p.description, p.details));

  const insertEmployee = db.prepare('INSERT INTO employees (id, name, role, department, email, phone, address, status, contractType, joinDate, salary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  MOCK_EMPLOYEES.forEach((e: any) => insertEmployee.run(e.id, e.name, e.role, e.department, e.email, e.phone, e.address, e.status, e.contractType, e.joinDate, e.salary));

  const insertTransaction = db.prepare('INSERT INTO transactions (id, date, description, category, amount, type) VALUES (?, ?, ?, ?, ?, ?)');
  MOCK_TRANSACTIONS.forEach((t: any) => insertTransaction.run(t.id, t.date, t.description, t.category, t.amount, t.type));

  const insertJournalEntry = db.prepare('INSERT INTO journal_entries (id, date, description) VALUES (?, ?, ?)');
  const insertJournalItem = db.prepare('INSERT INTO journal_items (journalEntryId, accountId, debit, credit) VALUES (?, ?, ?, ?)');
  MOCK_JOURNAL_ENTRIES.forEach((entry: any) => {
    insertJournalEntry.run(entry.id, entry.date, entry.description);
    entry.items.forEach((item: any) => {
      insertJournalItem.run(entry.id, item.accountId, item.debit, item.credit);
    });
  });

  console.log('Database seeded successfully');
}

export default db;
