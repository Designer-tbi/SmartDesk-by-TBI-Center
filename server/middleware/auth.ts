import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Validate session in database
    const sessionRes = await req.db.query(
      'SELECT * FROM sessions WHERE token = $1 AND "userId" = $2 AND "expiresAt" > $3',
      [token, decoded.id, new Date().toISOString()]
    );

    if (sessionRes.rows.length === 0) {
      return res.status(401).json({ error: 'Unauthorized: Session expired or invalid' });
    }

    // Update last activity
    await req.db.query(
      'UPDATE sessions SET "lastActivity" = $1 WHERE token = $2',
      [new Date().toISOString(), token]
    );

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
    const targetCompanyId = (req.query.companyId as string) || (req.body && req.body.companyId);
    if (targetCompanyId) {
      req.user.companyId = targetCompanyId;
      return next();
    }
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
