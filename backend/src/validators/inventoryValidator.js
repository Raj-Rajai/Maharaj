import { z } from 'zod';

export const createInventorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  currentStock: z.number().min(0).default(0),
  unit: z.string().min(1),
  lowStockThreshold: z.number().min(0).default(0)
});

export const updateInventorySchema = z.object({
  currentStock: z.number().min(0).optional(),
  lowStockThreshold: z.number().min(0).optional(),
  unit: z.string().min(1).optional()
});

export const adjustStockSchema = z.object({
  inventoryItemId: z.string().uuid('Invalid inventory item ID'),
  quantity: z.number(),
  type: z.enum(['PURCHASE', 'MANUAL_ADJUSTMENT', 'PURCHASE_REVERSAL']),
  notes: z.string().optional(),
  referenceId: z.string().optional()
});
