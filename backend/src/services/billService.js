import prisma from '../utils/prisma.js';
import * as auditService from './auditService.js';
import { settingsCache, tableCache } from '../utils/cache.js';
import { emitBillCreated, emitBillUpdated, emitBillFinalized } from '../utils/socket.js';

const getSettings = async () => {
  const cached = settingsCache.get();
  if (cached) return cached;

  const settings = await prisma.settings.findFirst();
  const result = {
    sgstPercent: settings ? Number(settings.sgstPercent) : 2.5,
    cgstPercent: settings ? Number(settings.cgstPercent) : 2.5,
    restaurantName: settings?.restaurantName || 'Maharaj Veg Villa',
    address: settings?.address || '',
    phone: settings?.phone || '',
    gstin: settings?.gstin || '',
  };
  settingsCache.set(result);
  return result;
};

export const calculateBill = async (orderId, discount = 0) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) throw { status: 404, message: 'Order not found' };

  const settings = await getSettings();

  const validItems = order.items.filter(i => i.status !== 'CANCELLED');
  const subtotal = validItems.reduce(
    (sum, item) => sum + (Number(item.priceSnapshot) * item.quantity), 0
  );

  const taxableAmount = Math.max(0, subtotal - discount);
  const sgstAmount = taxableAmount * (settings.sgstPercent / 100);
  const cgstAmount = taxableAmount * (settings.cgstPercent / 100);
  const grandTotal = taxableAmount + sgstAmount + cgstAmount;
  const finalTotal = Math.round(grandTotal);
  const roundOff = Number((finalTotal - grandTotal).toFixed(2));

  return {
    subtotal,
    discount,
    sgstPercent: settings.sgstPercent,
    cgstPercent: settings.cgstPercent,
    sgstAmount: Number(sgstAmount.toFixed(2)),
    cgstAmount: Number(cgstAmount.toFixed(2)),
    total: finalTotal,
    roundOff,
  };
};

export const preview = async (orderId, discount) => {
  return calculateBill(orderId, discount);
};

export const create = async (orderId, discount = 0, customerName = null, customerPhone = null) => {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw { status: 404, message: 'Order not found' };
  if (order.status !== 'ACTIVE') throw { status: 400, message: 'Bill can only be created for active orders' };

  const existingBill = await prisma.bill.findUnique({ where: { orderId } });
  if (existingBill) throw { status: 400, message: 'Bill already exists for this order' };

  const calculation = await calculateBill(orderId, discount);

  const createdBill = await prisma.bill.create({
    data: {
      orderId,
      sessionId: order.sessionId || null,
      tableId: order.tableId || null,
      customerName: customerName ? String(customerName).trim() : null,
      customerPhone: customerPhone ? String(customerPhone).trim() : null,
      subtotal: calculation.subtotal,
      sgstPercent: calculation.sgstPercent,
      cgstPercent: calculation.cgstPercent,
      sgstAmount: calculation.sgstAmount,
      cgstAmount: calculation.cgstAmount,
      discount: calculation.discount,
      total: calculation.total,
      roundOff: calculation.roundOff,
      status: 'DRAFT',
    },
  });

  emitBillCreated(createdBill);
  return createdBill;
};

export const getAll = async (filters) => {
  const { status, startDate, endDate, from, to, all, limit, page } = filters || {};
  const where = {};
  if (status && status !== 'ALL') where.status = status;

  // Support startDate/endDate and from/to aliases
  const startParam = startDate || from;
  const endParam = endDate || to;

  if (all === true || all === 'true' || startParam === 'ALL') {
    // Explicitly requested all bills across history (no date filter)
  } else if (startParam || endParam) {
    where.createdAt = {};
    if (startParam) {
      const s = new Date(startParam);
      s.setHours(0, 0, 0, 0);
      where.createdAt.gte = s;
    }
    if (endParam) {
      const e = new Date(endParam);
      e.setHours(23, 59, 59, 999);
      where.createdAt.lte = e;
    }
  } else {
    // Default to today's bills if no date range is provided
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    where.createdAt = { gte: todayStart, lte: todayEnd };
  }

  const queryOptions = {
    where,
    include: {
      order: {
        select: {
          id: true,
          orderSource: true,
          tableId: true,
          table: { select: { id: true, number: true, type: true } },
          captain: { select: { id: true, name: true, role: true } },
        }
      },
      payment: {
        select: { id: true, method: true, amount: true, status: true, paidAt: true }
      },
    },
    orderBy: { createdAt: 'desc' },
  };

  const take = limit ? Number(limit) : undefined;
  const skip = page && take ? (Number(page) - 1) * take : undefined;
  if (take) queryOptions.take = take;
  if (skip) queryOptions.skip = skip;

  return prisma.bill.findMany(queryOptions);
};

export const getById = async (id) => {
  const bill = await prisma.bill.findUnique({
    where: { id },
    include: {
      order: {
        include: {
          items: { include: { menuItem: true } },
          table: true,
          captain: { select: { id: true, name: true, role: true } },
        },
      },
      payment: true,
    },
  });
  if (!bill) throw { status: 404, message: 'Bill not found' };
  return bill;
};

export const finalize = async (billId, paymentMethod, customerName = null, customerPhone = null) => {
  const method = typeof paymentMethod === 'object' && paymentMethod !== null
    ? paymentMethod.paymentMethod
    : paymentMethod;
  const bill = await prisma.bill.findUnique({ where: { id: billId } });
  if (!bill) throw { status: 404, message: 'Bill not found' };
  if (bill.status !== 'DRAFT') throw { status: 400, message: 'Only DRAFT bills can be finalized' };

  const result = await prisma.$transaction(async (tx) => {
    const updateData = { status: 'FINALIZED', finalizedAt: new Date() };
    if (customerName !== undefined && customerName !== null && String(customerName).trim()) {
      updateData.customerName = String(customerName).trim();
    }
    if (customerPhone !== undefined && customerPhone !== null && String(customerPhone).trim()) {
      updateData.customerPhone = String(customerPhone).trim();
    }

    // Parallelize bill update and payment creation
    const [finalizedBill, payment] = await Promise.all([
      tx.bill.update({
        where: { id: billId },
        data: updateData,
      }),
      tx.payment.create({
        data: { billId, method, amount: bill.total, status: 'PAID', paidAt: new Date() },
      }),
    ]);

    // Parallelize all cascading updates
    const cascadeOps = [
      tx.order.update({ where: { id: bill.orderId }, data: { status: 'COMPLETED' } }),
      tx.kOT.updateMany({
        where: { orderId: bill.orderId },
        data: { status: 'COMPLETED' },
      }),
      tx.orderItem.updateMany({
        where: { orderId: bill.orderId, status: { notIn: ['CANCELLED', 'SERVED'] } },
        data: { status: 'SERVED' },
      }),
    ];

    if (bill.tableId) {
      cascadeOps.push(tx.table.update({ where: { id: bill.tableId }, data: { status: 'AVAILABLE' } }));
    }
    if (bill.sessionId) {
      cascadeOps.push(tx.tableSession.update({
        where: { id: bill.sessionId },
        data: { status: 'CLOSED', closedAt: new Date() },
      }));
    }

    await Promise.all(cascadeOps);

    return { ...finalizedBill, payment };
  });

  if (bill.tableId || bill.sessionId) {
    tableCache.invalidate();
  }

  emitBillFinalized(result);
  return result;
};

export const cancel = async (billId) => {
  const bill = await prisma.bill.findUnique({ where: { id: billId } });
  if (!bill) throw { status: 404, message: 'Bill not found' };
  if (bill.status === 'FINALIZED') throw { status: 400, message: 'Cannot cancel a FINALIZED bill' };
  const updated = await prisma.bill.update({ where: { id: billId }, data: { status: 'CANCELLED' } });
  emitBillUpdated(updated);
  return updated;
};

export const getBillPrintData = async (billId) => {
  const bill = await getById(billId);
  const settings = await getSettings();
  const validItems = bill.order.items.filter(i => i.status !== 'CANCELLED');
  return { bill, settings, validItems };
};

export const amendBill = async (billId, changes, reason, userId, discount, customerName = null, customerPhone = null) => {
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: { order: { include: { items: true } }, amendments: true }
  });
  if (!bill) throw { status: 404, message: 'Bill not found' };
  if (bill.status !== 'FINALIZED') throw { status: 400, message: 'Only FINALIZED bills can be amended' };

  const settings = await getSettings();
  const currentVersion = bill.amendments.length > 0
    ? Math.max(...bill.amendments.map(a => a.version))
    : bill.version;
  const newVersion = currentVersion + 1;

  let newSubtotal = 0;
  const activeItems = bill.order.items.filter(i => i.status !== 'CANCELLED');

  // For existing items, use the priceSnapshot (authoritative price from order creation)
  // Never trust client-provided newPrice
  for (const item of activeItems) {
    const change = changes.find(c => c.itemName === item.itemNameSnapshot);
    if (change) {
      const qty = change.newQty !== undefined ? change.newQty : item.quantity;
      // Always use the stored priceSnapshot — never trust client newPrice
      const price = Number(item.priceSnapshot);
      if (qty > 0) newSubtotal += qty * price;
    } else {
      newSubtotal += item.quantity * Number(item.priceSnapshot);
    }
  }

  // For new items, load authoritative price from DB in a single batch query
  const addedItems = changes.filter(c => c.isNew);
  if (addedItems.length > 0) {
    for (const added of addedItems) {
      if (!added.menuItemId) {
        throw { status: 400, message: 'New amendment items must include menuItemId' };
      }
    }
    const addedIds = addedItems.map(c => c.menuItemId);
    const dbMenuItems = await prisma.menuItem.findMany({
      where: { id: { in: addedIds } },
    });
    const itemMap = new Map(dbMenuItems.map(m => [m.id, m]));
    for (const added of addedItems) {
      const menuItem = itemMap.get(added.menuItemId);
      if (!menuItem) {
        throw { status: 404, message: `Menu item not found: ${added.menuItemId}` };
      }
      // Use DB price, not client-provided price
      newSubtotal += (added.newQty || 0) * Number(menuItem.price);
    }
  }

  const discountAmount = discount !== undefined ? Number(discount) : Number(bill.discount);
  const taxable = Math.max(0, newSubtotal - discountAmount);
  const newSgstAmount = Number((taxable * (settings.sgstPercent / 100)).toFixed(2));
  const newCgstAmount = Number((taxable * (settings.cgstPercent / 100)).toFixed(2));
  const newTotal = Math.round(taxable + newSgstAmount + newCgstAmount);
  const originalTotal = Number(bill.total);
  const difference = newTotal - originalTotal;

  const amendment = await prisma.$transaction(async (tx) => {
    const created = await tx.billAmendment.create({
      data: {
        billId,
        version: newVersion,
        changes,
        reason,
        modifiedBy: userId,
        originalTotal: bill.total,
        newSubtotal,
        newSgstAmount,
        newCgstAmount,
        newDiscount: discountAmount,
        newTotal,
        difference,
        paymentStatus: difference === 0 ? 'SETTLED' : 'PENDING'
      }
    });

    // Update Bill's financial fields + version so reports read correct totals
    const billUpdateData = {
      version: newVersion,
      subtotal: newSubtotal,
      sgstAmount: newSgstAmount,
      cgstAmount: newCgstAmount,
      discount: discountAmount,
      total: newTotal,
    };
    if (customerName !== undefined && customerName !== null && String(customerName).trim()) {
      billUpdateData.customerName = String(customerName).trim();
    }
    if (customerPhone !== undefined && customerPhone !== null && String(customerPhone).trim()) {
      billUpdateData.customerPhone = String(customerPhone).trim();
    }
    await tx.bill.update({ where: { id: billId }, data: billUpdateData });

    await auditService.log({
      userId, action: 'AMEND', entity: 'BILL', entityId: billId,
      before: { version: currentVersion, total: originalTotal },
      after: { version: newVersion, total: newTotal, difference },
      reason
    }, tx);

    return created;
  });

  emitBillUpdated({ id: billId, ...amendment });
  return amendment;
};

export const getAmendments = async (billId) => {
  return prisma.billAmendment.findMany({
    where: { billId },
    orderBy: { version: 'asc' }
  });
};

export const settleAmendment = async (amendmentId, paymentMethod) => {
  const amendment = await prisma.billAmendment.findUnique({ where: { id: amendmentId } });
  if (!amendment) throw { status: 404, message: 'Amendment not found' };
  if (amendment.paymentStatus === 'SETTLED') throw { status: 400, message: 'Already settled' };

  const result = await prisma.$transaction(async (tx) => {
    await tx.billAmendment.update({
      where: { id: amendmentId },
      data: { paymentStatus: 'SETTLED' }
    });

    const diff = Number(amendment.difference);
    if (diff !== 0) {
      const existingPayment = await tx.payment.findUnique({ where: { billId: amendment.billId } });
      if (existingPayment) {
        const newAmount = Number(existingPayment.amount) + diff;
        await tx.payment.update({
          where: { id: existingPayment.id },
          data: { amount: newAmount }
        });
      }
    }

    return { message: 'Amendment settled', difference: diff };
  });

  emitBillUpdated({ id: amendment.billId, amendmentId, settled: true });
  return result;
};

export const editDraft = async (billId, changes, discount, userId, customerName = null, customerPhone = null) => {
  // Wrap entire operation in a transaction for atomicity
  const updatedBill = await prisma.$transaction(async (tx) => {
    const bill = await tx.bill.findUnique({
      where: { id: billId },
      include: { order: { include: { items: true } } }
    });
    if (!bill) throw { status: 404, message: 'Bill not found' };
    if (bill.status !== 'DRAFT') throw { status: 400, message: 'Only DRAFT bills can be edited' };

    const settings = await getSettings();

    const itemUpdates = [];
    for (const change of changes) {
      const item = bill.order.items.find(i => i.itemNameSnapshot === change.itemName && i.status !== 'CANCELLED');
      if (item && item.quantity !== change.newQty) {
        if (change.newQty === 0) {
          itemUpdates.push(tx.orderItem.update({
            where: { id: item.id },
            data: { status: 'CANCELLED', originalQuantity: item.originalQuantity || item.quantity }
          }));
        } else {
          itemUpdates.push(tx.orderItem.update({
            where: { id: item.id },
            data: { quantity: change.newQty, originalQuantity: item.originalQuantity || item.quantity }
          }));
        }
      }
    }
    if (itemUpdates.length > 0) {
      await Promise.all(itemUpdates);
    }

    // Re-fetch items within the transaction to get updated quantities
    const updatedItems = await tx.orderItem.findMany({
      where: { orderId: bill.orderId }
    });

    const validItems = updatedItems.filter(i => i.status !== 'CANCELLED');
    const newSubtotal = validItems.reduce((sum, item) => sum + (Number(item.priceSnapshot) * item.quantity), 0);

    const discountAmount = discount !== undefined ? Number(discount) : Number(bill.discount);
    const taxable = Math.max(0, newSubtotal - discountAmount);
    const newSgstAmount = taxable * (settings.sgstPercent / 100);
    const newCgstAmount = taxable * (settings.cgstPercent / 100);
    const grandTotal = taxable + newSgstAmount + newCgstAmount;
    const newTotal = Math.round(grandTotal);
    const newRoundOff = Number((newTotal - grandTotal).toFixed(2));

    const updateData = {
      subtotal: newSubtotal,
      sgstAmount: Number(newSgstAmount.toFixed(2)),
      cgstAmount: Number(newCgstAmount.toFixed(2)),
      discount: discountAmount,
      total: newTotal,
      roundOff: newRoundOff,
    };
    if (customerName !== undefined && customerName !== null) {
      updateData.customerName = String(customerName).trim() || null;
    }
    if (customerPhone !== undefined && customerPhone !== null) {
      updateData.customerPhone = String(customerPhone).trim() || null;
    }

    return tx.bill.update({
      where: { id: billId },
      data: updateData,
    });
  });

  emitBillUpdated(updatedBill);
  return updatedBill;
};
