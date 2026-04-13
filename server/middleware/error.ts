import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('API Error:', err);
  
  // Prevent sending multiple responses
  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Erreur interne du serveur';
  
  // Check for Postgres specific errors
  let finalMessage = message;
  if (err.code === '23505') { // unique_violation
    finalMessage = 'Cet enregistrement existe déjà.';
  } else if (err.code === '23503') { // foreign_key_violation
    finalMessage = 'Impossible de supprimer cet élément car il est utilisé ailleurs.';
  } else if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    finalMessage = 'Erreur de connexion à la base de données.';
  }
  
  res.status(status).json({
    error: finalMessage,
    ...(process.env.NODE_ENV === 'development' && { 
      details: err,
      stack: err.stack,
      code: err.code
    })
  });
};
