import express from "express";
import path from "path";
import compression from "compression";
import { db, seedDatabase, connectionString } from "./db";
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

// Import routers
import { contactsRouter } from './server/routes/contacts';
import { productsRouter } from './server/routes/products';
import { invoicesRouter } from './server/routes/invoices';
import { projectsRouter } from './server/routes/projects';
import { employeesRouter } from './server/routes/employees';
import { accountingRouter } from './server/routes/accounting';
import { statsRouter } from './server/routes/stats';
import { authRouter } from './server/routes/auth';
import { adminRouter } from './server/routes/admin';
import { companyRouter } from './server/routes/company';
import { eventsRouter } from './server/routes/events';
import { schedulesRouter } from './server/routes/schedules';

// Import middlewares
import { dbMiddleware } from './server/middleware/db';
import { errorHandler } from './server/middleware/error';

const app = express();
app.use(compression());
const server = http.createServer(app);
let wss: WebSocketServer | null = null;

if (!process.env.VERCEL) {
  wss = new WebSocketServer({ server });
}

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// WebSocket broadcast helper
export const broadcast = (data: any) => {
  if (wss) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }
};

// Activity logging helper
export const logActivity = async (dbClient: any, userId: string | undefined, companyId: string | undefined, action: string, details: string) => {
  try {
    const id = `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await dbClient.query(
      'INSERT INTO activity_log (id, "userId", "companyId", action, details, "createdAt") VALUES ($1, $2, $3, $4, $5, $6)',
      [id, userId || null, companyId || null, action, details, new Date().toISOString()]
    );
    broadcast({ type: 'ACTIVITY', data: { id, userId, companyId, action, details, createdAt: new Date().toISOString() } });
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
};

// Always ensure the database is seeded, even on Vercel
// We do this asynchronously to avoid blocking the server startup
seedDatabase(db).catch(err => {
  console.error('Failed to seed database:', err);
});

// Attach database instance to request
app.use(dbMiddleware);

// API Routes
// ... existing routes ...
app.get('/api/health', async (req, res) => {
  try {
    const tablesRes = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    res.json({ 
      status: 'ok', 
      environment: process.env.NODE_ENV,
      vercel: !!process.env.VERCEL,
      database: connectionString.includes('neon.tech') ? 'neon' : 'custom',
      tables: tablesRes.rows.map(r => r.table_name)
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: String(err) });
  }
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
app.use('/api/events', eventsRouter);
app.use('/api/schedules', schedulesRouter);

// Global Error Handler for API routes
app.use('/api', errorHandler);

// Export the app for Vercel serverless functions
export default app;

// Only start the server if not running on Vercel
if (!process.env.VERCEL) {
  if (process.env.NODE_ENV !== "production") {
    const viteModule = "vite";
    import(viteModule).then(({ createServer: createViteServer }) => {
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
    // Cache static assets for 1 year
    app.use(express.static(distPath, {
      maxAge: '1y',
      immutable: true,
      index: false
    }));
    app.get("*", (req, res) => {
      // For Vercel, we need to handle the case where the file might not exist locally during the function execution
      // but is served by the Vercel edge. However, since we have a rewrite in vercel.json, 
      // this catch-all is mostly for local production testing.
      const indexPath = path.join(distPath, "index.html");
      res.sendFile(indexPath, {
        maxAge: '1h'
      });
    });
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}
