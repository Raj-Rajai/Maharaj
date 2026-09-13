import { z } from 'zod';

const orderItemSchema = z.object({
  menuItemId: z.string().uuid('Invalid menu item ID'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  notes: z.string().optional(),
});

export const createOrderSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID').optional(),
  tableId: z.string().uuid('Invalid table ID').optional(),
  items: z.array(orderItemSchema).optional(),
  generateKot: z.boolean().optional().default(true),
}).refine((data) => data.sessionId || data.tableId, {
  message: 'Either sessionId or tableId is required',
});

export const addItemsSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'At least one item is required'),
  generateKot: z.boolean().optional().default(true),
});

export const sendKotOrderSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID').optional(),
  tableId: z.string().uuid('Invalid table ID').optional(),
  items: z.array(orderItemSchema).min(1, 'At least one item is required'),
}).refine((data) => data.sessionId || data.tableId, {
  message: 'Either sessionId or tableId is required',
});

export const createTakeAwayOrderSchema = z.object({
  orderSource: z.enum(['SELF_PICKUP', 'SWIGGY', 'ZOMATO']),
  items: z.array(
    z.object({
      menuItemId: z.string().uuid('Invalid menu item ID'),
      quantity: z.number().int().min(1, 'Quantity must be at least 1'),
      notes: z.string().optional(),
    })
  ).min(1, 'At least one item is required'),
  generateKot: z.boolean().optional().default(false),
  customerNotes: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  externalOrderId: z.string().optional(),
});
