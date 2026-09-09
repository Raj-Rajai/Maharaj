import { z } from 'zod';

export const createPurchaseSchema = z.object({
  supplierId: z.string().uuid('Invalid supplier ID'),
  purchaseNumber: z.string().optional(),
  purchaseDate: z.string().or(z.date()),
  addToInventory: z.boolean().optional().default(false),
  items: z.array(z.object({
    name: z.string().min(1),
    quantity: z.number().min(0.01),
    unit: z.string().min(1),
    rate: z.number().min(0)
  })).min(1, 'At least one item is required')
});
