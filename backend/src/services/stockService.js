import { emitInventoryUpdated } from '../utils/socket.js';

// Live stock for menu items linked to an inventory item: ordering deducts the same
// quantity. Orders are never blocked — stock floors at zero — and every movement is
// recorded against its order item, so cancelling or editing an item moves back exactly
// what was taken for it.

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Bring stock in line with the current quantity of each order item.
 *
 * @param {object} tx - Prisma interactive-transaction client
 * @param {Array<{orderItemId: string, inventoryItemId?: string|null, quantity: number, name?: string}>} lines
 *   quantity is the item's quantity now (0 when cancelled); inventoryItemId is the menu item's current link
 * @param {{fresh?: boolean}} [opts] - fresh: the order items were just created, so nothing was deducted yet
 * @returns {Promise<string[]>} ids of inventory items whose stock changed
 */
export async function syncStock(tx, lines, { fresh = false } = {}) {
  const candidates = fresh ? lines.filter((l) => l.inventoryItemId) : lines;
  if (candidates.length === 0) return [];

  // Net amount already deducted per order item (SALE is negative, SALE_REVERSAL positive)
  const deducted = new Map();
  if (!fresh) {
    const past = await tx.inventoryTransaction.findMany({
      where: { referenceId: { in: candidates.map((l) => l.orderItemId) }, type: { in: ['SALE', 'SALE_REVERSAL'] } },
      select: { referenceId: true, inventoryItemId: true, quantity: true },
    });
    for (const t of past) {
      const prev = deducted.get(t.referenceId) || { inventoryItemId: t.inventoryItemId, amount: 0 };
      prev.amount = round2(prev.amount - Number(t.quantity));
      deducted.set(t.referenceId, prev);
    }
  }

  const moves = [];
  for (const line of candidates) {
    const already = deducted.get(line.orderItemId);
    const inventoryItemId = already?.inventoryItemId || line.inventoryItemId;
    if (!inventoryItemId) continue;
    const delta = round2(Math.max(line.quantity, 0) - (already?.amount || 0));
    if (delta !== 0) moves.push({ ...line, inventoryItemId, delta });
  }
  if (moves.length === 0) return [];

  // Lock the stock rows (in id order, to avoid deadlocks) so concurrent orders can't spend the same units
  const ids = [...new Set(moves.map((m) => m.inventoryItemId))].sort();
  const rows = await tx.$queryRawUnsafe(
    `SELECT id, currentStock FROM \`InventoryItem\` WHERE id IN (${ids.map(() => '?').join(', ')}) ORDER BY id FOR UPDATE`,
    ...ids
  );
  const stock = new Map(rows.map((r) => [r.id, Number(r.currentStock)]));

  const transactions = [];
  for (const move of moves) {
    if (!stock.has(move.inventoryItemId)) continue; // inventory item was deleted after linking
    const current = stock.get(move.inventoryItemId);
    const label = move.name ? `${move.name}` : 'menu item';

    if (move.delta > 0) {
      const taken = round2(Math.min(move.delta, Math.max(current, 0)));
      if (taken <= 0) continue;
      stock.set(move.inventoryItemId, round2(current - taken));
      transactions.push({
        inventoryItemId: move.inventoryItemId,
        type: 'SALE',
        quantity: -taken,
        referenceId: move.orderItemId,
        notes: taken < move.delta
          ? `Ordered ${move.delta} × ${label} (only ${taken} in stock)`
          : `Ordered ${taken} × ${label}`,
      });
    } else {
      const returned = round2(-move.delta);
      stock.set(move.inventoryItemId, round2(current + returned));
      transactions.push({
        inventoryItemId: move.inventoryItemId,
        type: 'SALE_REVERSAL',
        quantity: returned,
        referenceId: move.orderItemId,
        notes: move.quantity > 0
          ? `Quantity reduced: ${label} (${returned} returned)`
          : `Cancelled: ${label} (${returned} returned)`,
      });
    }
  }
  if (transactions.length === 0) return [];

  const changed = [...new Set(transactions.map((t) => t.inventoryItemId))];
  await Promise.all(changed.map((id) => tx.inventoryItem.update({
    where: { id },
    data: { currentStock: stock.get(id) },
  })));
  await tx.inventoryTransaction.createMany({ data: transactions });
  return changed;
}

// Call after the transaction commits so other screens refresh stock live
export function notifyStockChanged(inventoryItemIds) {
  if (inventoryItemIds && inventoryItemIds.length > 0) {
    emitInventoryUpdated({ ids: inventoryItemIds });
  }
}
