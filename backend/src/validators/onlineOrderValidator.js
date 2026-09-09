import { z } from 'zod';

export const createOnlineOrderSchema = z.object({
  platform: z.enum(['SWIGGY', 'ZOMATO']),
  externalOrderId: z.string().min(1, 'External order ID is required'),
  customerName: z.string().optional(),
  items: z.array(z.object({
    name: z.string().min(1),
    quantity: z.number().min(1),
    price: z.number().min(0)
  })).min(1, 'At least one item is required'),
  subtotal: z.number().min(0),
  discount: z.number().min(0).default(0),
  charges: z.number().min(0).default(0),
  total: z.number().min(0),
  paymentStatus: z.enum(['PAID', 'PENDING', 'SETTLED', 'REFUNDED']).default('PAID'),
  status: z.enum(['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']).default('COMPLETED'),
  notes: z.string().optional()
});

export const updateOnlineOrderSchema = z.object({
  platform: z.enum(['SWIGGY', 'ZOMATO']).optional(),
  externalOrderId: z.string().min(1).optional(),
  customerName: z.string().optional(),
  items: z.array(z.object({
    name: z.string().min(1),
    quantity: z.number().min(1),
    price: z.number().min(0)
  })).min(1).optional(),
  subtotal: z.number().min(0).optional(),
  discount: z.number().min(0).optional(),
  charges: z.number().min(0).optional(),
  total: z.number().min(0).optional(),
  paymentStatus: z.enum(['PAID', 'PENDING', 'SETTLED', 'REFUNDED']).optional(),
  status: z.enum(['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']).optional(),
  notes: z.string().optional()
});

export const updateStatusSchema = z.object({
  status: z.enum(['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'])
});
