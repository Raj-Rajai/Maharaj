import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  displayOrder: z.number().int().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  displayOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});
