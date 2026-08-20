import app from "./app.js";
import { db, seedDatabase } from "./db.js";
import http from 'http';
import path from "path";
import express from "express";
import { setWebSocketServer, broadcast, logActivity } from './server/activity.js';
import { tenantContextFromCookieHeader } from './server/utils/authFromCookie.js';

// Re-export helpers for any lingering deep-imports. NOTE: new code should
// import directly from './server/activity.js' to avoid the circular-import
// trap that crashed Vercel before.
export { broadcast, logActivity };

const server = http.createServer(app);

// Only start WebSocket server if not running on Vercel
if (!process.env.VERCEL) {
  import('ws').then(({ WebSocketServer }) => {
    const wss = new WebSocketServer({ server });
    // Authenticate at the handshake: same session cookie used by every
    // REST call. Unauthenticated sockets are refused outright — previously
    // ANY client (logged out, or another tenant) could connect and receive
    // every broadcast (activity descriptions, invoice/journal events, …)
    // for every company on the platform, since nothing scoped delivery.
    // See server/activity.ts's broadcast() for the matching per-tenant
    // filter on the send side.
    wss.on('connection', (ws: any, req: any) => {
      const { companyId, isSuperAdmin } = tenantContextFromCookieHeader(req.headers?.cookie);
      if (!companyId && !isSuperAdmin) {
        ws.close(4001, 'Unauthorized');
        return;
      }
      ws.companyId = companyId;
      ws.isSuperAdmin = isSuperAdmin;
    });
    setWebSocketServer(wss);
    console.log('WebSocket server started');
  }).catch(err => {
    console.error('Failed to start WebSocket server:', err);
  });
}

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

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
