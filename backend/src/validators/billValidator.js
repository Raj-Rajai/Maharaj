import { z } from 'zod';

export const previewBillSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  discount: z.number().min(0).optional().default(0),
});

export const createBillSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  discount: z.number().min(0).optional().default(0),
  customerName: z.string().optional().nullable(),
  customerPhone: z.string().optional().nullable(),
});

export const finalizeBillSchema = z.object({
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD']),
  customerName: z.string().optional().nullable(),
  customerPhone: z.string().optional().nullable(),
});
