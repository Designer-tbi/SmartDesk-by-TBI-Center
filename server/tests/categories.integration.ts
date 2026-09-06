import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../../db.js';
import { productsRouter } from '../routes/products.js';
const client = await db.connect();
async function invoke(method: string, path: string, req: any) {
  const route = productsRouter.stack.find((layer: any) => layer.route?.path === path && layer.route.methods[method])!.route!;
  let result: any;
  const res: any = { status() { return res; }, json(value: any) { result = value; } };
  await route.stack.at(-1)!.handle({ db: client, ...req }, res, (error: any) => { if (error) throw error; });
  return result;
}
try {
  await client.query('BEGIN');
  const company = (await client.query('SELECT id FROM companies LIMIT 1')).rows[0];
  assert.ok(company, 'Requires an existing company');
  await client.query("SELECT set_config('app.current_company_id', $1, true), set_config('app.is_super_admin', 'false', true)", [company.id]);
  const name = `test-category-${randomUUID()}`;
  const req = { user: { companyId: company.id }, body: { name: ` ${name} ` } };
  assert.deepEqual(await invoke('post','/categories',req), {name});
  await invoke('post','/categories',req);
  assert.ok((await invoke('get','/categories',req)).includes(name));
  assert.equal((await client.query('SELECT count(*)::int AS count FROM product_categories WHERE name = $1', [name])).rows[0].count, 1);
  await client.query("SELECT set_config('app.current_company_id', 'unrelated-test-tenant', true)");
  assert.ok(!(await invoke('get', '/categories', { user: { companyId: 'unrelated-test-tenant' } })).includes(name));
  const cols = (await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='invoices' AND column_name='signingToken'")).rows;
  assert.equal(cols.length, 1);
  console.log('PASS: category create/list/deduplication, tenant isolation, signingToken column. Test data rolled back.');
} finally {
  await client.query('ROLLBACK');
  client.release();
  await db.end();
}
