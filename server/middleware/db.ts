import { Request, Response, NextFunction } from 'express';
import { db } from '../../db.js';

export const dbMiddleware = (req: Request, res: Response, next: NextFunction) => {
  req.db = db;
  next();
};
