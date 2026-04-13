import app from '../app';
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
    
    console.log(`Vercel Request: ${req.method} ${req.url}`);
    
    // Handle the request
    return app(req, res);
  } catch (err: any) {
    console.error('Vercel Entry Point Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Vercel Entry Point Error', 
        message: err?.message || String(err),
        stack: err?.stack
      });
    }
  }
};
