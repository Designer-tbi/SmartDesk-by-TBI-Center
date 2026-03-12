import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import db, { seedDatabase } from "./db.js";
import * as mockData from "./src/constants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Seed database with demo data
  seedDatabase(mockData);

  // API Routes
  
  // Contacts (CRM)
  app.get("/api/contacts", (req, res) => {
    const contacts = db.prepare('SELECT * FROM contacts').all();
    res.json(contacts);
  });

  app.post("/api/contacts", (req, res) => {
    const { id, name, email, phone, company, status, lastContact } = req.body;
    const info = db.prepare('INSERT INTO contacts (id, name, email, phone, company, status, lastContact) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, name, email, phone, company, status, lastContact);
    res.status(201).json({ id, name, email, phone, company, status, lastContact });
  });

  app.put("/api/contacts/:id", (req, res) => {
    const { id } = req.params;
    const { name, email, phone, company, status, lastContact } = req.body;
    db.prepare('UPDATE contacts SET name = ?, email = ?, phone = ?, company = ?, status = ?, lastContact = ? WHERE id = ?')
      .run(name, email, phone, company, status, lastContact, id);
    res.json({ id, name, email, phone, company, status, lastContact });
  });

  app.delete("/api/contacts/:id", (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM contacts WHERE id = ?').run(id);
    res.status(204).send();
  });

  // Products
  app.get("/api/products", (req, res) => {
    const products = db.prepare('SELECT * FROM products').all();
    res.json(products);
  });

  // Invoices
  app.get("/api/invoices", (req, res) => {
    const invoices = db.prepare('SELECT * FROM invoices').all();
    const invoicesWithItems = invoices.map((inv: any) => {
      const items = db.prepare('SELECT * FROM invoice_items WHERE invoiceId = ?').all(inv.id);
      return { ...inv, items };
    });
    res.json(invoicesWithItems);
  });

  app.post("/api/invoices", (req, res) => {
    const inv = req.body;
    const insertInvoice = db.prepare('INSERT INTO invoices (id, type, contactId, date, dueDate, totalHT, tvaTotal, total, status, notes, signatureLink) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    insertInvoice.run(inv.id, inv.type, inv.contactId, inv.date, inv.dueDate, inv.totalHT, inv.tvaTotal, inv.total, inv.status, inv.notes || null, inv.signatureLink || null);
    
    const insertItem = db.prepare('INSERT INTO invoice_items (invoiceId, productId, name, quantity, price, tvaRate, tvaAmount) VALUES (?, ?, ?, ?, ?, ?, ?)');
    inv.items.forEach((item: any) => {
      insertItem.run(inv.id, item.productId, item.name, item.quantity, item.price, item.tvaRate, item.tvaAmount);
    });
    
    res.status(201).json(inv);
  });

  // Projects
  app.get("/api/projects", (req, res) => {
    const projects = db.prepare('SELECT * FROM projects').all();
    res.json(projects);
  });

  app.post("/api/projects", (req, res) => {
    const proj = req.body;
    db.prepare('INSERT INTO projects (id, name, client, status, deadline, progress, description, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(proj.id, proj.name, proj.client, proj.status, proj.deadline, proj.progress, proj.description, proj.details);
    res.status(201).json(proj);
  });

  app.put("/api/projects/:id", (req, res) => {
    const { id } = req.params;
    const proj = req.body;
    db.prepare('UPDATE projects SET name = ?, client = ?, status = ?, deadline = ?, progress = ?, description = ?, details = ? WHERE id = ?')
      .run(proj.name, proj.client, proj.status, proj.deadline, proj.progress, proj.description, proj.details, id);
    res.json(proj);
  });

  app.delete("/api/projects/:id", (req, res) => {
    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    res.status(204).send();
  });

  // Accounting
  app.get("/api/transactions", (req, res) => {
    const transactions = db.prepare('SELECT * FROM transactions').all();
    res.json(transactions);
  });

  app.get("/api/journal-entries", (req, res) => {
    const entries = db.prepare('SELECT * FROM journal_entries').all();
    const entriesWithItems = entries.map((entry: any) => {
      const items = db.prepare('SELECT * FROM journal_items WHERE journalEntryId = ?').all(entry.id);
      return { ...entry, items };
    });
    res.json(entriesWithItems);
  });

  app.post("/api/journal-entries", (req, res) => {
    const entry = req.body;
    db.prepare('INSERT INTO journal_entries (id, date, description) VALUES (?, ?, ?)')
      .run(entry.id, entry.date, entry.description);
    
    const insertItem = db.prepare('INSERT INTO journal_items (journalEntryId, accountId, debit, credit) VALUES (?, ?, ?, ?)');
    entry.items.forEach((item: any) => {
      insertItem.run(entry.id, item.accountId, item.debit, item.credit);
    });
    res.status(201).json(entry);
  });

  // Employees
  app.get("/api/employees", (req, res) => {
    const employees = db.prepare('SELECT * FROM employees').all();
    res.json(employees);
  });

  app.post("/api/employees", (req, res) => {
    const emp = req.body;
    db.prepare('INSERT INTO employees (id, name, role, department, email, phone, address, status, contractType, joinDate, salary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(emp.id, emp.name, emp.role, emp.department, emp.email, emp.phone, emp.address, emp.status, emp.contractType, emp.joinDate, emp.salary);
    res.status(201).json(emp);
  });

  app.put("/api/employees/:id", (req, res) => {
    const { id } = req.params;
    const emp = req.body;
    db.prepare('UPDATE employees SET name = ?, role = ?, department = ?, email = ?, phone = ?, address = ?, status = ?, contractType = ?, joinDate = ?, salary = ? WHERE id = ?')
      .run(emp.name, emp.role, emp.department, emp.email, emp.phone, emp.address, emp.status, emp.contractType, emp.joinDate, emp.salary, id);
    res.json(emp);
  });

  // Stats API
  app.get("/api/stats", (req, res) => {
    const contactsCount = db.prepare("SELECT COUNT(*) as count FROM contacts").get() as any;
    const invoicesTotal = db.prepare("SELECT SUM(total) as total FROM invoices WHERE type = 'Invoice' AND status = 'Paid'").get() as any;
    const invoicesCount = db.prepare("SELECT COUNT(*) as count FROM invoices").get() as any;
    const productsCount = db.prepare("SELECT COUNT(*) as count FROM products").get() as any;

    res.json({
      contacts: contactsCount.count,
      revenue: invoicesTotal.total || 0,
      orders: invoicesCount.count,
      products: productsCount.count
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
