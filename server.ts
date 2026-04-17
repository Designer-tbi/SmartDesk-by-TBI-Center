import app from "./app";
import { db, seedDatabase } from "./db";
import http from 'http';
import path from "path";
import express from "express";

// Global error handlers to prevent Node.js process from crashing (dev/prod).
// On Vercel these prevent the whole lambda invocation from being marked as
// FUNCTION_INVOCATION_FAILED if a stray promise rejects after the response
// has been sent.
const handleFatalError = (err: any, type: string) => {
  console.error(`FATAL ${type}:`, err);
};

if (!(process as any).__smartdesk_handlers_installed) {
  (process as any).__smartdesk_handlers_installed = true;
  process.on('uncaughtException', (err) => handleFatalError(err, 'uncaughtException'));
  process.on('unhandledRejection', (reason) => handleFatalError(reason, 'unhandledRejection'));
}

const server = http.createServer(app);
let wss: any = null;

// Only start WebSocket server if not running on Vercel
if (!process.env.VERCEL) {
  import('ws').then(({ WebSocketServer }) => {
    wss = new WebSocketServer({ server });
    console.log('WebSocket server started');
  }).catch(err => {
    console.error('Failed to start WebSocket server:', err);
  });
}

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// WebSocket broadcast helper
export const broadcast = (data: any) => {
  if (wss) {
    wss.clients.forEach((client: any) => {
      if (client.readyState === 1) { // 1 is WebSocket.OPEN
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

// Only seed database automatically if not on Vercel
if (!process.env.VERCEL) {
  seedDatabase(db).catch(err => {
    console.error('Failed to seed database:', err);
  });
}

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
    app.use(express.static(distPath, {
      maxAge: '1y',
      immutable: true,
      index: false
    }));

    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}
