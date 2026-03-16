import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  console.log('requireAuth: authHeader =', authHeader);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('requireAuth: Missing or invalid token');
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (error) {
    console.log('requireAuth: Invalid token error =', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Forbidden: Super Admin access required' });
  }
  next();
};

export const requireCompany = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.user.companyId) {
    return next();
  }

  if (req.user.role === 'super_admin') {
    try {
      // For super admins without a companyId, try to find the first company
      const companiesRes = await req.db.query('SELECT id FROM companies LIMIT 1');
      if (companiesRes.rows.length > 0) {
        req.user.companyId = companiesRes.rows[0].id;
        return next();
      }
    } catch (error) {
      console.error('Error finding company for super_admin:', error);
    }
  }

  return res.status(403).json({ error: 'Forbidden: Company access required' });
};
