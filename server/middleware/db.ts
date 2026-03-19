import { Request, Response, NextFunction } from 'express';
import { db } from '../../db';

export const dbMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = await db.connect();
    req.db = client;
    
    // Reset search_path to public to ensure global tables (users, companies) are accessible
    // before any tenant-specific middleware changes it.
    await client.query('SET search_path TO public');
    
    let released = false;
    const release = () => {
      if (!released) {
        client.release();
        released = true;
      }
    };

    res.on('finish', release);
    res.on('close', release);

    next();
  } catch (err) {
    next(err);
  }
};
