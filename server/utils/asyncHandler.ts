import { Request, Response, NextFunction } from 'express';

/**
 * Wraps an asynchronous express route handler to ensure any errors are caught
 * and passed to the next() function (the global error handler).
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
