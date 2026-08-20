/**
 * Keeps `products.stock` in sync with invoiced quantities.
 *
 * Only physical products (`type = 'product'`) are tracked — services have
 * no stock concept. Stock is allowed to go negative rather than clamped at
 * 0: SmartDesk doesn't currently support backorders, and refusing to
 * invoice would be a worse failure mode for a small business than a
 * temporarily-inaccurate stock count. A negative value genuinely means
 * "oversold by N units" — clamping it to 0 here would make the decrement/
 * restore/adjust deltas non-invertible (an invoice for more than what's in
 * stock, later deleted, would over-restore stock past its true value).
 * The frontend (Inventory.tsx) clamps to 0 only for display, so the UI
 * never shows a negative number while the underlying math stays correct.
 */

export interface StockLineItem {
  productId?: string | null;
  quantity?: number | null;
}

type DB = { query: (text: string, params?: any[]) => Promise<{ rows: any[] }> };

/**
 * Apply a net quantity delta per product. `delta` maps productId -> change
 * in units SOLD (positive = more sold, stock should decrease; negative =
 * less sold, stock should increase back).
 */
async function applyStockDeltas(db: DB, companyId: string, delta: Map<string, number>) {
  for (const [productId, soldDelta] of delta) {
    if (!productId || !soldDelta) continue;
    await db.query(
      `UPDATE products
          SET stock = stock - $1, "updatedAt" = NOW()
        WHERE id = $2 AND "companyId" = $3 AND type = 'product'`,
      [soldDelta, productId, companyId],
    );
  }
}

function toDelta(items: StockLineItem[]): Map<string, number> {
  const delta = new Map<string, number>();
  for (const it of items || []) {
    if (!it.productId) continue;
    const qty = Number(it.quantity) || 0;
    if (!qty) continue;
    delta.set(it.productId, (delta.get(it.productId) || 0) + qty);
  }
  return delta;
}

/** Invoice created (or a Quote converted to an Invoice) — decrement stock. */
export async function decrementStockForItems(db: DB, companyId: string, items: StockLineItem[]) {
  await applyStockDeltas(db, companyId, toDelta(items));
}

/** Invoice deleted, or a Quote (never stock-tracked) — restore stock. */
export async function restoreStockForItems(db: DB, companyId: string, items: StockLineItem[]) {
  const delta = toDelta(items);
  const inverted = new Map<string, number>();
  for (const [productId, qty] of delta) inverted.set(productId, -qty);
  await applyStockDeltas(db, companyId, inverted);
}

/**
 * Invoice items replaced (edit): apply only the NET change so a no-op
 * edit (same quantities) doesn't touch stock, and a quantity increase
 * from 3 to 5 only decrements 2 more units rather than 5 (which would
 * double-count the original 3 already deducted at creation).
 */
export async function adjustStockForItemChange(
  db: DB,
  companyId: string,
  oldItems: StockLineItem[],
  newItems: StockLineItem[],
) {
  const oldDelta = toDelta(oldItems);
  const newDelta = toDelta(newItems);
  const productIds = new Set([...oldDelta.keys(), ...newDelta.keys()]);
  const net = new Map<string, number>();
  for (const productId of productIds) {
    const change = (newDelta.get(productId) || 0) - (oldDelta.get(productId) || 0);
    if (change) net.set(productId, change);
  }
  await applyStockDeltas(db, companyId, net);
}
