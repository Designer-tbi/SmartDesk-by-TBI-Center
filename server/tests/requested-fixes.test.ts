import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canAccessDeclarations } from '../../shared/declarationAccess.js';
import { requireDeclarationManager } from '../middleware/declarations.js';
import { MOCK_PERMISSIONS } from '../../src/constants.js';
import { buildInvoicePdfBuffer } from '../services/invoicePdf.js';

test('declarations allow admin and manager, reject HR and other roles', () => {
  for (const role of ['admin', 'manager', 'super_admin', 'role_admin_company', 'role_manager_company']) assert.equal(canAccessDeclarations(role), true);
  for (const role of [undefined, 'rh', 'sales', 'role_rh_company', 'role_sales_company', 'role-custom']) {
    assert.equal(canAccessDeclarations(role), false);
    let status = 0;
    requireDeclarationManager({ user: { role } } as any, { status(n: number) { status = n; return this; }, json() {} } as any, () => assert.fail('must reject'));
    assert.equal(status, 403);
  }
});

test('every tenant navigation module has a permission and IDs are unique', () => {
  const ids = MOCK_PERMISSIONS.map(p => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const module of ['dashboard','agenda','crm','sales','inventory','planning','projects','hr','accounting','declarations','users','subscriptions','options','agents','settings']) {
    assert.ok(ids.some(id => id.startsWith(`${module}.`)), module);
  }
});

test('manager declaration permissions distinguish reading from writing', async () => {
  for (const method of ['GET', 'POST']) {
    let allowed = false;
    let status = 200;
    const req: any = { method, user: { role: 'role_manager_company' }, db: { async query() { return { rows: [{ permissionId: 'declarations.view' }] }; } } };
    const res: any = { status(n: number) { status = n; return res; }, json() {} };
    await requireDeclarationManager(req, res, () => { allowed = true; });
    assert.equal(allowed, method === 'GET');
    assert.equal(status, method === 'GET' ? 200 : 403);
  }
});

test('PDFs support manual lines and legal identifiers for all document types', async () => {
  for (const type of ['Quote', 'Invoice', 'PurchaseOrder']) {
    const item = { productId: null, name: 'Prestation manuelle', quantity: 2, price: 100, tvaRate: 0.18 };
    const fakeDb = { async query(sql: string) {
      if (sql.includes('FROM invoices')) return { rows: [{ id: 'TEST', type, totalHT: 200, tvaTotal: 36, total: 236 }] };
      if (sql.includes('FROM invoice_items')) return { rows: [item] };
      if (sql.includes('FROM companies')) return { rows: [{name: 'Test', niu: 'NIU-TEST', rccm: 'RCCM-TEST', idNat: 'NAT-TEST', taxId: 'FISC-TEST'}] };
      return { rows: [] };
    }};
    const result = await buildInvoicePdfBuffer(fakeDb, 'TEST', 'test');
    const content = result!.buffer.toString('latin1');
    for (const value of ['Prestation manuelle','NIU-TEST','RCCM-TEST','NAT-TEST','FISC-TEST']) assert.ok(content.includes(value), value);
  }
});
