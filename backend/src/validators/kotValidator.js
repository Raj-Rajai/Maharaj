import { z } from 'zod';

export const createKotSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
});

export const updateKotStatusSchema = z.object({
  status: z.enum(['NEW', 'PREPARING', 'READY', 'COMPLETED']),
});

export const updateItemStatusSchema = z.object({
  status: z.enum(['SENT', 'PREPARING', 'READY', 'SERVED']),
});
