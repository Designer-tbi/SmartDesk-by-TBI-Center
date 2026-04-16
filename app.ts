import express from "express";
import path from "path";
import compression from "compression";
import cookieParser from "cookie-parser";
import { dbMiddleware } from './server/middleware/db';
import { errorHandler } from './server/middleware/error';

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

const app = express();

app.use(compression());
app.use(express.json());
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

// Debug route
app.get('/api/debug', (req, res) => {
  res.json({
    status: 'ok',
    vercel: !!process.env.VERCEL,
    env: process.env.NODE_ENV,
    hasDbUrl: !!process.env.DATABASE_URL,
    timestamp: new Date().toISOString()
  });
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
