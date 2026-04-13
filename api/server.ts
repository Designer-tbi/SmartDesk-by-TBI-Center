import app from '../server';
import { db, seedDatabase } from '../db';

let isInitialized = false;

export default async (req: any, res: any) => {
  try {
    if (!isInitialized) {
      console.log('Vercel Cold Start: Initializing database...');
      await seedDatabase(db);
      isInitialized = true;
    }
    return app(req, res);
  } catch (err: any) {
    console.error('Vercel Entry Point Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Vercel Entry Point Error', 
        message: err.message,
        stack: err.stack
      });
    }
  }
};
