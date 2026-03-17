import { Pool, PoolClient } from 'pg';

declare global {
  namespace Express {
    interface Request {
      db: PoolClient | Pool;
      user?: {
        id: string;
        companyId: string | null;
        email: string;
        role: string;
        name: string;
        language?: string;
        currency?: string;
        companyLogo?: string | null;
        companyName?: string | null;
      };
    }
  }
}
