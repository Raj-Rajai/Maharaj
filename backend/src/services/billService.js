import prisma from '../utils/prisma.js';
import * as auditService from './auditService.js';
import { settingsCache } from '../utils/cache.js';

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

  // billNumber is now autoincrement in PostgreSQL — no manual generation needed
  return prisma.bill.create({
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
};

export const getAll = async (filters) => {
  const { status, startDate, endDate } = filters || {};
  const where = {};
  if (status) where.status = status;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }
  return prisma.bill.findMany({
    where,
    include: {
      order: { include: { table: true, captain: { select: { id: true, name: true, role: true } } } },
      payment: true,
      session: { include: { table: true, captain: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const getById = async (id) => {
  const bill = await prisma.bill.findUnique({
    where: { id },
    include: {
      order: {
        include: {
          items: { include: { menuItem: true, history: true } },
          table: true,
          captain: { select: { id: true, name: true, role: true } },
        },
      },
      payment: true,
      session: { include: { table: true, captain: { select: { name: true } } } },
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

  return prisma.$transaction(async (tx) => {
    const updateData = { status: 'FINALIZED', finalizedAt: new Date() };
    if (customerName !== undefined && customerName !== null && String(customerName).trim()) {
      updateData.customerName = String(customerName).trim();
    }
    if (customerPhone !== undefined && customerPhone !== null && String(customerPhone).trim()) {
      updateData.customerPhone = String(customerPhone).trim();
    }

    const finalizedBill = await tx.bill.update({
      where: { id: billId },
      data: updateData,
    });
    const payment = await tx.payment.create({
      data: { billId, method, amount: bill.total, status: 'PAID', paidAt: new Date() },
    });
    await tx.order.update({ where: { id: bill.orderId }, data: { status: 'COMPLETED' } });
    await tx.kOT.updateMany({
      where: { orderId: bill.orderId },
      data: { status: 'COMPLETED' }
    });
    await tx.orderItem.updateMany({
      where: { orderId: bill.orderId, status: { notIn: ['CANCELLED', 'SERVED'] } },
      data: { status: 'SERVED' }
    });
    if (bill.tableId) {
      await tx.table.update({ where: { id: bill.tableId }, data: { status: 'AVAILABLE' } });
    }
    if (bill.sessionId) {
      await tx.tableSession.update({
        where: { id: bill.sessionId },
        data: { status: 'CLOSED', closedAt: new Date() },
      });
    }
    return { ...finalizedBill, payment };
  });
};

export const cancel = async (billId) => {
  const bill = await prisma.bill.findUnique({ where: { id: billId } });
  if (!bill) throw { status: 404, message: 'Bill not found' };
  if (bill.status === 'FINALIZED') throw { status: 400, message: 'Cannot cancel a FINALIZED bill' };
  return prisma.bill.update({ where: { id: billId }, data: { status: 'CANCELLED' } });
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

  // For new items, load authoritative price from DB
  const addedItems = changes.filter(c => c.isNew);
  if (addedItems.length > 0) {
    for (const added of addedItems) {
      if (!added.menuItemId) {
        throw { status: 400, message: 'New amendment items must include menuItemId' };
      }
      const menuItem = await prisma.menuItem.findUnique({ where: { id: added.menuItemId } });
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

  return prisma.$transaction(async (tx) => {
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
};

export const editDraft = async (billId, changes, discount, userId, customerName = null, customerPhone = null) => {
  // Wrap entire operation in a transaction for atomicity
  return prisma.$transaction(async (tx) => {
    const bill = await tx.bill.findUnique({
      where: { id: billId },
      include: { order: { include: { items: true } } }
    });
    if (!bill) throw { status: 404, message: 'Bill not found' };
    if (bill.status !== 'DRAFT') throw { status: 400, message: 'Only DRAFT bills can be edited' };

    const settings = await getSettings();

    for (const change of changes) {
      const item = bill.order.items.find(i => i.itemNameSnapshot === change.itemName && i.status !== 'CANCELLED');
      if (item && item.quantity !== change.newQty) {
        if (change.newQty === 0) {
          await tx.orderItem.update({
            where: { id: item.id },
            data: { status: 'CANCELLED', originalQuantity: item.originalQuantity || item.quantity }
          });
        } else {
          await tx.orderItem.update({
            where: { id: item.id },
            data: { quantity: change.newQty, originalQuantity: item.originalQuantity || item.quantity }
          });
        }
      }
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
};
