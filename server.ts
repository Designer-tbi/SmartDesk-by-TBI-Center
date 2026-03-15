import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { db, seedDatabase } from "./db.js";
import * as mockData from "./src/constants.js";

// Import routers
import { contactsRouter } from './server/routes/contacts.js';
import { productsRouter } from './server/routes/products.js';
import { invoicesRouter } from './server/routes/invoices.js';
import { projectsRouter } from './server/routes/projects.js';
import { employeesRouter } from './server/routes/employees.js';
import { accountingRouter } from './server/routes/accounting.js';
import { statsRouter } from './server/routes/stats.js';
import { authRouter } from './server/routes/auth.js';
import { adminRouter } from './server/routes/admin.js';
import { companyRouter } from './server/routes/company.js';

// Import middlewares
import { dbMiddleware } from './server/middleware/db.js';
import { errorHandler } from './server/middleware/error.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // Seed database with demo data
  seedDatabase(db, mockData);

  // Attach database instance to request
  app.use(dbMiddleware);

  // API Routes
  app.use('/api/contacts', contactsRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/invoices', invoicesRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/employees', employeesRouter);
  app.use('/api', accountingRouter); // accounting routes are /api/transactions and /api/journal-entries
  app.use('/api/stats', statsRouter);
  app.use('/api/auth', authRouter); // auth routes are /api/auth/send-demo-email and /api/auth/login
  app.use('/api/admin', adminRouter);
  app.use('/api/company', companyRouter);

  // Global Error Handler for API routes
  app.use('/api', errorHandler);

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
