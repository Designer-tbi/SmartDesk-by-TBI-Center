import app from '../server';
import { db, seedDatabase } from '../db';

let isInitialized = false;

export default async (req: any, res: any) => {
  try {
    if (!isInitialized) {
      console.log('Vercel Cold Start: Initializing database...');
      try {
        await seedDatabase(db);
        isInitialized = true;
      } catch (seedErr: any) {
        console.error('Seeding failed but continuing:', seedErr);
      }
    }
    
    if (typeof app !== 'function') {
      throw new Error(`App is not a function, it is a ${typeof app}. Check your server.ts export.`);
    }

    return app(req, res);
  } catch (err: any) {
    console.error('Vercel Entry Point Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Vercel Entry Point Error', 
        message: err?.message || String(err),
        name: err?.name,
        code: err?.code,
        stack: err?.stack
      });
    }
  }
};
