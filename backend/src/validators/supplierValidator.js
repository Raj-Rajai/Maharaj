import { z } from 'zod';

export const createSupplierSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  address: z.string().optional(),
  active: z.boolean().optional()
});

export const updateSupplierSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  active: z.boolean().optional()
});
