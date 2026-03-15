import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { db, seedDatabase, connectionString } from "./db.js";
import * as mockData from "./src/constants.js";
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

// Import routers
// ... existing imports ...
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

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// WebSocket broadcast helper
export const broadcast = (data: any) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};

// Activity logging helper
export const logActivity = async (userId: string | undefined, companyId: string | undefined, action: string, details: string) => {
  try {
    const id = `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.query(
      'INSERT INTO activity_log (id, "userId", "companyId", action, details, "createdAt") VALUES ($1, $2, $3, $4, $5, $6)',
      [id, userId || null, companyId || null, action, details, new Date().toISOString()]
    );
    broadcast({ type: 'ACTIVITY', data: { id, userId, companyId, action, details, createdAt: new Date().toISOString() } });
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
};

// Seed database with demo data
seedDatabase(db, mockData);

// Attach database instance to request
app.use(dbMiddleware);

// API Routes
// ... existing routes ...
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    environment: process.env.NODE_ENV,
    vercel: !!process.env.VERCEL,
    database: connectionString.includes('neon.tech') ? 'neon' : 'custom'
  });
});

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

// Export the app for Vercel serverless functions
export default app;

// Only start the server if not running on Vercel
if (!process.env.VERCEL) {
  if (process.env.NODE_ENV !== "production") {
    import("vite").then(({ createServer: createViteServer }) => {
      createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      }).then(vite => {
        app.use(vite.middlewares);
        server.listen(PORT, "0.0.0.0", () => {
          console.log(`Server running on http://localhost:${PORT}`);
        });
      });
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}
