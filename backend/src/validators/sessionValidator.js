import { z } from 'zod';

export const createSessionSchema = z.object({
  tableId: z.string().uuid('Invalid table ID'),
  guestCount: z.number().int().min(1, 'Guest count must be at least 1').optional(),
});
