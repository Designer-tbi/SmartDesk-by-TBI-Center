import express from "express";
import path from "path";
import compression from "compression";
import cookieParser from "cookie-parser";
import { dbMiddleware } from './server/middleware/db.js';
import { errorHandler } from './server/middleware/error.js';

// Install global error handlers ASAP — this is critical on Vercel where an
// unhandled rejection in a background task would otherwise crash the whole
// lambda invocation as FUNCTION_INVOCATION_FAILED.
if (!(process as any).__smartdesk_handlers_installed) {
  (process as any).__smartdesk_handlers_installed = true;
  process.on('uncaughtException', (err) =>
    console.error('[SmartDesk] uncaughtException:', err),
  );
  process.on('unhandledRejection', (reason) =>
    console.error('[SmartDesk] unhandledRejection:', reason),
  );
}

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
import { eventsRouter } from './server/routes/events.js';
import { schedulesRouter } from './server/routes/schedules.js';
import { publicSignatureRouter } from './server/routes/publicSignature.js';

const app = express();

app.use(compression() as any);
// Vercel's Node runtime may pre-parse the JSON body before it reaches
// Express. If `req.body` is already an object, skip the express.json()
// middleware — otherwise it would hang waiting on an empty stream.
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return next();
  }
  express.json({ limit: '10mb' })(req, res, next);
});
app.use(cookieParser());

// Diagnostic logging for Vercel
app.use((req, res, next) => {
  if (process.env.VERCEL) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// Attach database instance to request
app.use(dbMiddleware);

// API Routes
app.use('/api/contacts', contactsRouter);
app.use('/api/products', productsRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/employees', employeesRouter);
app.use('/api', accountingRouter);
app.use('/api/stats', statsRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/company', companyRouter);
app.use('/api/events', eventsRouter);
app.use('/api/schedules', schedulesRouter);
// Public (no-auth) signature flow — recipients of quotes click a link and
// land on /sign-quote/:id which calls these endpoints.
app.use('/api/public', publicSignatureRouter);

// Debug route — CRITICAL for diagnosing Vercel 500s. Visit /api/debug on the
// live deployment to see exactly what's failing.
app.get('/api/debug', async (req, res) => {
  const info: any = {
    status: 'ok',
    vercel: !!process.env.VERCEL,
    env: process.env.NODE_ENV,
    nodeVersion: process.version,
    hasDbUrl: !!process.env.DATABASE_URL,
    hasJwtSecret: !!process.env.JWT_SECRET,
    timestamp: new Date().toISOString(),
  };
  try {
    // req.db is already acquired by dbMiddleware — a successful SELECT 1
    // proves the whole chain (env → pg.Pool → Neon → RLS session vars) works.
    const t = Date.now();
    const result = await req.db.query('SELECT NOW() as now, version() as pg_version');
    info.db = {
      ok: true,
      latencyMs: Date.now() - t,
      now: result.rows[0].now,
      pgVersion: result.rows[0].pg_version?.split(' ').slice(0, 2).join(' '),
    };
  } catch (err: any) {
    info.status = 'error';
    info.db = {
      ok: false,
      error: err?.message || String(err),
      code: err?.code,
    };
  }
  res.json(info);
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    error: 'Route non trouvée',
    path: req.originalUrl
  });
});

// Global Error Handler
app.use(errorHandler);

export default app;
