/**
 * Per-partner API key management for the external provisioning API
 * (/api/external/*).
 *
 * Replaces the single shared `EXTERNAL_API_KEY` env var with one row per
 * partner in the `api_keys` table, so each integration can be identified,
 * rate-limited/audited, and revoked independently without rotating a
 * secret every other partner also depends on.
 *
 * Keys are stored HASHED (SHA-256) — the plaintext key is only ever
 * returned once, at creation time, exactly like a password. A short
 * plaintext `keyPrefix` is kept alongside the hash purely so an admin can
 * recognise which key is which in a list without ever seeing the secret
 * again.
 */
import crypto from 'crypto';
import { db as rootPool } from '../../db.js';

const KEY_PREFIX = 'sd_ext_';

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/** Generates a new plaintext API key. Never persisted as-is — only its hash is. */
export function generateApiKey(): string {
  return `${KEY_PREFIX}${crypto.randomBytes(24).toString('hex')}`;
}

export type ApiKeyRecord = {
  id: string;
  partnerName: string;
  keyPrefix: string;
  active: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

/** Creates a partner + API key, returning the PLAINTEXT key once. */
export async function createApiKey(partnerName: string): Promise<{ record: ApiKeyRecord; plainKey: string }> {
  const plainKey = generateApiKey();
  const id = `apikey_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const keyHash = hashKey(plainKey);
  const keyPrefix = plainKey.slice(0, KEY_PREFIX.length + 8);

  const result = await rootPool.query(
    `INSERT INTO api_keys (id, "partnerName", "keyHash", "keyPrefix", active, "createdAt")
     VALUES ($1, $2, $3, $4, TRUE, NOW())
     RETURNING id, "partnerName", "keyPrefix", active, "createdAt", "lastUsedAt", "revokedAt"`,
    [id, partnerName, keyHash, keyPrefix],
  );
  return { record: result.rows[0], plainKey };
}

export async function listApiKeys(): Promise<ApiKeyRecord[]> {
  const result = await rootPool.query(
    `SELECT id, "partnerName", "keyPrefix", active, "createdAt", "lastUsedAt", "revokedAt"
       FROM api_keys ORDER BY "createdAt" DESC`,
  );
  return result.rows;
}

export async function revokeApiKey(id: string): Promise<boolean> {
  const result = await rootPool.query(
    `UPDATE api_keys SET active = FALSE, "revokedAt" = NOW() WHERE id = $1 AND active = TRUE`,
    [id],
  );
  return (result.rowCount || 0) > 0;
}

/**
 * Validates a presented key against the DB. Returns the matching partner
 * row (and bumps `lastUsedAt`, fire-and-forget) or null if the key is
 * unknown/revoked.
 */
export async function verifyApiKey(presented: string): Promise<{ id: string; partnerName: string } | null> {
  const keyHash = hashKey(presented);
  const result = await rootPool.query(
    `SELECT id, "partnerName" FROM api_keys WHERE "keyHash" = $1 AND active = TRUE`,
    [keyHash],
  );
  const row = result.rows[0];
  if (!row) return null;
  rootPool.query(`UPDATE api_keys SET "lastUsedAt" = NOW() WHERE id = $1`, [row.id]).catch(() => {});
  return { id: row.id, partnerName: row.partnerName };
}
