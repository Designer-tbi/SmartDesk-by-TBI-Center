/**
 * Activity logging + real-time broadcast helpers.
 *
 * Extracted from server.ts so the API routes don't need to import the
 * server bootstrap file. Depending on server.ts from /api/index.ts on
 * Vercel produced a circular import (api → app → routes → server → app)
 * which intermittently resolved `app` as `undefined`, crashing the
 * serverless function with FUNCTION_INVOCATION_FAILED.
 */

// Optional reference to a WebSocket server; wired up by server.ts at boot
// time in local/dev. On Vercel this stays null and broadcasts are no-ops.
let wssInstance: any = null;

export const setWebSocketServer = (wss: any) => {
  wssInstance = wss;
};

export const broadcast = (data: any) => {
  if (!wssInstance) return;
  try {
    wssInstance.clients.forEach((client: any) => {
      if (client.readyState === 1 /* WebSocket.OPEN */) {
        client.send(JSON.stringify(data));
      }
    });
  } catch (err) {
    console.error('broadcast error:', err);
  }
};

export const logActivity = async (
  dbClient: any,
  userId: string | undefined,
  companyId: string | undefined,
  action: string,
  details: string,
) => {
  try {
    const id = `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await dbClient.query(
      'INSERT INTO activity_log (id, "userId", "companyId", action, details, "createdAt") VALUES ($1, $2, $3, $4, $5, $6)',
      [id, userId || null, companyId || null, action, details, new Date().toISOString()],
    );
    broadcast({
      type: 'ACTIVITY',
      data: { id, userId, companyId, action, details, createdAt: new Date().toISOString() },
    });
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
};
