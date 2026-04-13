import { Request, Response, NextFunction } from 'express';
import { db } from '../../db';

export const dbMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  let client: any = null;
  let released = false;

  const release = () => {
    if (client && !released) {
      client.release();
      released = true;
    }
  };

  try {
    // Add a timeout for the connection attempt
    const connectionPromise = db.connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database connection timeout')), 5000)
    );

    client = await Promise.race([connectionPromise, timeoutPromise]);
    req.db = client;
    
    // Reset search_path to public
    await client.query('SET search_path TO public');
    
    res.on('finish', release);
    res.on('close', release);

    next();
  } catch (err) {
    release();
    next(err);
  }
};
