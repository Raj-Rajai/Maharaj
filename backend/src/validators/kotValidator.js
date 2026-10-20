import { z } from 'zod';

export const createKotSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
});

export const updateKotStatusSchema = z.object({
  status: z.enum(['NEW', 'PREPARING', 'READY', 'SERVED', 'COMPLETED']),
});

export const updateItemStatusSchema = z.object({
  status: z.enum(['PENDING', 'SENT', 'PREPARING', 'READY', 'SERVED', 'COMPLETED']),
});
