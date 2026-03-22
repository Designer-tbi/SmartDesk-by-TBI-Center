import { db } from './db.js';
async function test() {
  try {
    const res = await db.query('SELECT * FROM users WHERE email = $1', ['missengue07@gmail.com']);
    console.log('User:', res.rows[0]);
  } catch (e: any) {
    console.error('DB error:', e.message);
  } finally {
    process.exit(0);
  }
}
test();
