import { z } from 'zod';

export const updateSettingsSchema = z.object({
  restaurantName: z.string().min(1).optional(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  gstin: z.string().optional().nullable(),
  sgstPercent: z.number().min(0).max(100).optional(),
  cgstPercent: z.number().min(0).max(100).optional(),
  includePurchasesInReports: z.boolean().optional(),
});
