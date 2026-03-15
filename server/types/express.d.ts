import { Pool } from 'pg';

declare global {
  namespace Express {
    interface Request {
      db: Pool;
      user?: {
        id: string;
        companyId: string | null;
        email: string;
        role: string;
        name: string;
      };
    }
  }
}
