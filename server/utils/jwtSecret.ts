/**
 * Single source of truth for the JWT signing secret. Throws at import time
 * if JWT_SECRET is not set — a hardcoded fallback here would let anyone who
 * reads this (public) source forge a `super_admin` token.
 */
const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error(
    'JWT_SECRET environment variable is required. Refusing to start with a hardcoded fallback secret.',
  );
}

export const JWT_SECRET = secret;
