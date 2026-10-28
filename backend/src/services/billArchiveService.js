import crypto from 'node:crypto';
import { finished } from 'node:stream/promises';
import PDFDocument from 'pdfkit';
import { ZipArchive } from 'archiver';
import prisma from '../utils/prisma.js';
import { parseDateRange } from '../utils/dateUtils.js';
import { emitBillUpdated } from '../utils/socket.js';
import * as auditService from './auditService.js';

// Download-and-remove for a date range of bills (super admin only).
// 1. prepare  — fixes the exact set of bills and returns a token + summary for the warning popup
// 2. download — streams a zip of one PDF per bill (plus a CSV summary) for that set
// 3. confirm  — deletes only the bills that were fully downloaded under that token
// Bills are deleted only after their zip has been completely sent, so an interrupted
// download never loses data.

const ARCHIVE_TTL_MS = 30 * 60 * 1000;
const CHUNK_SIZE = 50;
const BUSINESS_TZ = 'Asia/Kolkata';
const archives = new Map();

const chunk = (list, size) => {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

const pruneExpired = () => {
  const now = Date.now();
  for (const [token, archive] of archives) {
    if (now - archive.createdAt > ARCHIVE_TTL_MS) archives.delete(token);
  }
};

const getArchive = (token, userId) => {
  pruneExpired();
  const archive = archives.get(token);
  if (!archive) throw { status: 404, message: 'This download has expired. Please start again.' };
  if (archive.userId !== userId) throw { status: 403, message: 'This download belongs to another user' };
  return archive;
};

// Settled or cancelled bills only — drafts and bills of still-running orders are never touched
const archivableWhere = (start, end) => ({
  createdAt: { gte: start, lte: end },
  status: { in: ['FINALIZED', 'CANCELLED'] },
  order: { status: { not: 'ACTIVE' } },
});

export const prepare = async ({ startDate, endDate }, userId) => {
  const { start, end } = parseDateRange(startDate, endDate);
  if (start > end) throw { status: 400, message: '"From" date must be on or before the "To" date' };

  const [bills, skipped] = await Promise.all([
    prisma.bill.findMany({
      where: archivableWhere(start, end),
      select: { id: true, billNumber: true, total: true, status: true },
      orderBy: { billNumber: 'asc' },
    }),
    prisma.bill.count({
      where: {
        createdAt: { gte: start, lte: end },
        OR: [{ status: 'DRAFT' }, { order: { status: 'ACTIVE' } }],
      },
    }),
  ]);

  pruneExpired();
  let token = null;
  if (bills.length > 0) {
    token = crypto.randomUUID();
    archives.set(token, {
      userId,
      startDate,
      endDate,
      billIds: bills.map((b) => b.id),
      downloadedIds: null,
      createdAt: Date.now(),
    });
  }

  const finalized = bills.filter((b) => b.status === 'FINALIZED');
  return {
    token,
    startDate,
    endDate,
    count: bills.length,
    finalizedCount: finalized.length,
    cancelledCount: bills.length - finalized.length,
    totalAmount: Number(finalized.reduce((sum, b) => sum + Number(b.total), 0).toFixed(2)),
    firstBillNumber: bills[0]?.billNumber ?? null,
    lastBillNumber: bills[bills.length - 1]?.billNumber ?? null,
    skippedOpenBills: skipped,
  };
};

// ─── PDF rendering (same layout as the 80mm thermal bill) ─────────────────────

const MM = 72 / 25.4;
const PAGE_W = 80 * MM;
const PAD = 4 * MM;
const CONTENT_W = PAGE_W - PAD * 2;
const BASE_SIZE = 8.5;

const money = (n) => `Rs.${Number(n || 0).toFixed(2)}`;
const fmtDate = (d) => new Intl.DateTimeFormat('en-IN', { timeZone: BUSINESS_TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
const fmtTime = (d) => new Intl.DateTimeFormat('en-IN', { timeZone: BUSINESS_TZ, hour: '2-digit', minute: '2-digit', hour12: true }).format(d);
const fmtDay = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

const sourceLabelFor = (bill) => {
  const src = bill.order?.orderSource;
  if (src === 'SELF_PICKUP') return 'Source: Self Pickup';
  if (src === 'SWIGGY') return 'Source: Swiggy';
  if (src === 'ZOMATO') return 'Source: Zomato';
  const tableNum = bill.session?.table?.number ?? bill.order?.table?.number ?? '-';
  return `Table: ${tableNum}`;
};

// Lays the bill out top to bottom and returns the height used; drawing the same layout
// twice (measure, then render on an exactly-sized page) keeps the PDF as one long receipt
const layoutBill = (doc, bill, settings) => {
  let y = PAD;

  const centered = (text, { bold = false, size = BASE_SIZE, gap = 1 } = {}) => {
    doc.font(bold ? 'Courier-Bold' : 'Courier').fontSize(size);
    const h = doc.heightOfString(text, { width: CONTENT_W, align: 'center' });
    doc.text(text, PAD, y, { width: CONTENT_W, align: 'center' });
    y += h + gap;
  };
  const row = (left, right, { bold = false, size = BASE_SIZE, gap = 1.5 } = {}) => {
    doc.font(bold ? 'Courier-Bold' : 'Courier').fontSize(size);
    const leftW = right ? CONTENT_W * 0.6 : CONTENT_W;
    const h = Math.max(doc.heightOfString(left, { width: leftW }), doc.currentLineHeight(true));
    doc.text(left, PAD, y, { width: leftW });
    if (right) doc.text(right, PAD, y, { width: CONTENT_W, align: 'right', lineBreak: false });
    y += h + gap;
  };
  const divider = () => {
    y += 2;
    doc.save().moveTo(PAD, y).lineTo(PAGE_W - PAD, y).lineWidth(0.6).dash(2, { space: 2 }).stroke().restore();
    y += 4;
  };

  const createdAt = new Date(bill.createdAt);
  centered((settings.restaurantName || 'Maharaj Veg Villa').toUpperCase(), { bold: true, size: 11, gap: 2 });
  if (bill.version > 1) centered(`AMENDED BILL - Version ${bill.version}`, { bold: true });
  if (settings.address) centered(settings.address);
  if (settings.phone) centered(`Contact: ${settings.phone}`);
  if (settings.gstin) centered(`GSTIN: ${settings.gstin}`);
  if (bill.status === 'CANCELLED') {
    y += 2;
    centered('*** CANCELLED BILL ***', { bold: true });
  }
  divider();
  row(`Bill #: ${bill.billNumber}`, `Date: ${fmtDate(createdAt)}`);
  row(sourceLabelFor(bill), `Time: ${fmtTime(createdAt)}`);
  if (bill.customerName) row(`Customer: ${bill.customerName}`);
  if (bill.customerPhone) row(`Phone: ${bill.customerPhone}`);
  divider();

  // Items table: name (wraps) | qty | line total
  const nameW = CONTENT_W * 0.5;
  const qtyW = CONTENT_W * 0.18;
  doc.font('Courier-Bold').fontSize(BASE_SIZE - 0.5);
  doc.text('ITEMS', PAD, y, { width: nameW, lineBreak: false });
  doc.text('QTY', PAD + nameW, y, { width: qtyW, align: 'center', lineBreak: false });
  doc.text('TOTAL', PAD, y, { width: CONTENT_W, align: 'right', lineBreak: false });
  y += doc.currentLineHeight(true) + 1;
  divider();

  doc.font('Courier').fontSize(BASE_SIZE);
  const items = (bill.order?.items || []).filter((i) => i.status !== 'CANCELLED');
  for (const item of items) {
    const name = item.itemNameSnapshot || 'Item';
    const h = Math.max(doc.heightOfString(name, { width: nameW }), doc.currentLineHeight(true));
    doc.text(name, PAD, y, { width: nameW });
    doc.text(String(item.quantity), PAD + nameW, y, { width: qtyW, align: 'center', lineBreak: false });
    doc.text(money(Number(item.priceSnapshot) * item.quantity), PAD, y, { width: CONTENT_W, align: 'right', lineBreak: false });
    y += h + 2;
  }
  divider();

  row('TOTAL', money(bill.subtotal));
  if (Number(bill.discount) > 0) row('DISCOUNT', `-${money(bill.discount)}`);
  row(`SGST (${Number(bill.sgstPercent || 2.5).toFixed(3)}%)`, money(bill.sgstAmount));
  row(`CGST (${Number(bill.cgstPercent || 2.5).toFixed(3)}%)`, money(bill.cgstAmount));
  if (Number(bill.roundOff || 0) !== 0) row('ROUND OFF', money(bill.roundOff));
  divider();
  row('FINAL AMOUNT', money(bill.total), { bold: true, size: BASE_SIZE + 1 });
  if (bill.payment) row(`PAYMENT (${bill.payment.method})`, 'PAID', { size: BASE_SIZE - 0.5 });
  divider();
  y += 2;
  centered('Thank you visit again');

  return y + PAD;
};

const renderBillPdf = (bill, settings) => {
  // Measure on a tall scratch page, then render on a page cut to the content height
  const measure = new PDFDocument({ size: [PAGE_W, 5000], margin: 0 });
  const height = Math.ceil(layoutBill(measure, bill, settings)) + 4;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [PAGE_W, height],
      margin: 0,
      info: { Title: `Bill #${bill.billNumber}`, Author: settings.restaurantName || 'Maharaj Veg Villa' },
    });
    const parts = [];
    doc.on('data', (d) => parts.push(d));
    doc.on('end', () => resolve(Buffer.concat(parts)));
    doc.on('error', reject);
    layoutBill(doc, bill, settings);
    doc.end();
  });
};

// ─── CSV summary ──────────────────────────────────────────────────────────────

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const CSV_HEADER = ['Bill No', 'Date', 'Time', 'Status', 'Source', 'Customer', 'Phone', 'Payment', 'Subtotal', 'Discount', 'SGST', 'CGST', 'Round Off', 'Total'];

const csvRowFor = (bill) => {
  const createdAt = new Date(bill.createdAt);
  return [
    bill.billNumber,
    fmtDate(createdAt),
    fmtTime(createdAt),
    bill.status,
    sourceLabelFor(bill).replace(/^Source: /, ''),
    bill.customerName,
    bill.customerPhone,
    bill.payment?.method,
    Number(bill.subtotal).toFixed(2),
    Number(bill.discount).toFixed(2),
    Number(bill.sgstAmount).toFixed(2),
    Number(bill.cgstAmount).toFixed(2),
    Number(bill.roundOff).toFixed(2),
    Number(bill.total).toFixed(2),
  ].map(csvCell).join(',');
};

export const download = async (token, userId, res) => {
  const archive = getArchive(token, userId);
  archive.downloadedIds = null;

  const settings = (await prisma.settings.findFirst()) || {};
  const zip = new ZipArchive({ zlib: { level: 6 } });
  const fileName = `Bills_${archive.startDate}_to_${archive.endDate}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Cache-Control', 'no-store');
  zip.on('warning', (err) => console.warn('[BillArchive] zip warning:', err.message));
  zip.on('error', (err) => res.destroy(err));
  zip.pipe(res);

  const included = [];
  const csvLines = [CSV_HEADER.join(',')];
  try {
    for (const ids of chunk(archive.billIds, CHUNK_SIZE)) {
      const bills = await prisma.bill.findMany({
        where: { id: { in: ids } },
        include: {
          order: { include: { items: true, table: true } },
          session: { include: { table: true } },
          payment: true,
        },
        orderBy: { billNumber: 'asc' },
      });
      for (const bill of bills) {
        const pdf = await renderBillPdf(bill, settings);
        zip.append(pdf, { name: `${fmtDay(new Date(bill.createdAt))}/Bill-${bill.billNumber}.pdf` });
        csvLines.push(csvRowFor(bill));
        included.push(bill.id);
      }
    }
    // BOM so Excel opens the summary as UTF-8
    zip.append(`﻿${csvLines.join('\r\n')}\r\n`, { name: 'bills-summary.csv' });
    await zip.finalize();
    await finished(res);
  } catch (err) {
    console.error('[BillArchive] download failed:', err?.message || err);
    if (!res.destroyed) res.destroy(err);
    return;
  }

  // Only now — after every byte was handed to the client — may these bills be removed
  archive.downloadedIds = included;
};

export const confirmDelete = async (token, user) => {
  const archive = getArchive(token, user.id);
  if (!archive.downloadedIds) {
    throw { status: 400, message: 'The bills have not been downloaded completely yet, so nothing was deleted' };
  }

  let deletedCount = 0;
  let deletedTotal = 0;
  const billNumbers = [];

  for (const ids of chunk(archive.downloadedIds, CHUNK_SIZE)) {
    const deleted = await prisma.$transaction(async (tx) => {
      // Re-check: a bill may have been amended back into use or already removed since download
      const bills = await tx.bill.findMany({
        where: { id: { in: ids }, status: { in: ['FINALIZED', 'CANCELLED'] }, order: { status: { not: 'ACTIVE' } } },
        select: { id: true, orderId: true, sessionId: true, billNumber: true, total: true, status: true },
      });
      if (bills.length === 0) return [];

      const billIds = bills.map((b) => b.id);
      const orderIds = [...new Set(bills.map((b) => b.orderId))];
      const sessionIds = [...new Set(bills.map((b) => b.sessionId).filter(Boolean))];
      const itemIds = (await tx.orderItem.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } }))
        .map((i) => i.id);

      // Children first so no foreign key is left dangling
      if (itemIds.length > 0) await tx.orderItemHistory.deleteMany({ where: { orderItemId: { in: itemIds } } });
      await tx.payment.deleteMany({ where: { billId: { in: billIds } } });
      await tx.billAmendment.deleteMany({ where: { billId: { in: billIds } } });
      await tx.bill.deleteMany({ where: { id: { in: billIds } } });
      await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.kOT.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.order.deleteMany({ where: { id: { in: orderIds } } });

      // Closed table sessions left with nothing in them go too
      if (sessionIds.length > 0) {
        const sessions = await tx.tableSession.findMany({
          where: { id: { in: sessionIds }, status: 'CLOSED' },
          select: { id: true, _count: { select: { orders: true, kots: true, bills: true } } },
        });
        const empty = sessions
          .filter((s) => s._count.orders + s._count.kots + s._count.bills === 0)
          .map((s) => s.id);
        if (empty.length > 0) await tx.tableSession.deleteMany({ where: { id: { in: empty } } });
      }
      return bills;
    }, { timeout: 60000 });

    deletedCount += deleted.length;
    for (const b of deleted) {
      billNumbers.push(b.billNumber);
      if (b.status === 'FINALIZED') deletedTotal += Number(b.total);
    }
  }

  archives.delete(token);
  billNumbers.sort((a, b) => a - b);

  await auditService.log({
    userId: user.id,
    action: 'BULK_DELETE',
    entity: 'BILL',
    entityId: `${archive.startDate}..${archive.endDate}`,
    before: {
      count: deletedCount,
      total: Number(deletedTotal.toFixed(2)),
      firstBillNumber: billNumbers[0] ?? null,
      lastBillNumber: billNumbers[billNumbers.length - 1] ?? null,
      billNumbers: billNumbers.length <= 500 ? billNumbers : undefined,
    },
    reason: 'Bills downloaded as ZIP and removed from the database',
  });

  emitBillUpdated({ bulkDeleted: true, count: deletedCount });
  return { deletedCount, deletedTotal: Number(deletedTotal.toFixed(2)) };
};
