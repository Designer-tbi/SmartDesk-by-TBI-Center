import rateLimit from 'express-rate-limit';

/**
 * Throttle brute-force / credential-stuffing attempts against auth
 * endpoints. Keyed by IP; counts only failed attempts by default would be
 * nicer but express-rate-limit's stock behaviour (count every request) is
 * still a large improvement over no limiting at all.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion. Réessayez dans quelques minutes.' },
});

export const demoSignupRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez plus tard.' },
});
