import { readFile } from 'node:fs/promises';
import { db } from '../db.js';
const client = await db.connect();
try {
  await client.query('CREATE TABLE IF NOT EXISTS smartdesk_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  for (const name of ['20260906.sql']) {
    if ((await client.query('SELECT 1 FROM smartdesk_migrations WHERE name = $1', [name])).rowCount) continue;
    await client.query(await readFile(new URL(`./migrations/${name}`, import.meta.url), 'utf8'));
    await client.query('INSERT INTO smartdesk_migrations (name) VALUES ($1)', [name]);
    console.log(`Migration ${name} applied.`);
  }
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await db.end();
}
