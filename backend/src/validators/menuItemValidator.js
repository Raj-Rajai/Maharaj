import { z } from 'zod';

export const createMenuItemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  categoryId: z.string().uuid('Invalid category ID'),
  menuType: z.enum(['AC', 'NON_AC', 'SWIGGY', 'ZOMATO'], { required_error: 'Menu type must be AC, NON_AC, SWIGGY, or ZOMATO' }),
  price: z.number().positive('Price must be positive'),
  description: z.string().optional(),
});

export const updateMenuItemSchema = z.object({
  name: z.string().min(1).optional(),
  categoryId: z.string().uuid().optional(),
  menuType: z.enum(['AC', 'NON_AC', 'SWIGGY', 'ZOMATO']).optional(),
  price: z.number().positive().optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
});

export const updateAvailabilitySchema = z.object({
  active: z.boolean({ required_error: 'Active status is required' }),
});

export const bulkAddMenuItemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  categoryId: z.string().uuid('Invalid category ID'),
  description: z.string().optional(),
  items: z.array(z.object({
    menuType: z.enum(['AC', 'NON_AC', 'SWIGGY', 'ZOMATO']),
    price: z.number().positive('Price must be positive')
  })).min(1, 'At least one menu type is required')
});
