import { Database } from 'better-sqlite3';

declare global {
  namespace Express {
    interface Request {
      db: Database;
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
