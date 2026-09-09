import { z } from 'zod';

export const createTableSchema = z.object({
  number: z.number().int().min(1, 'Table number must be at least 1'),
  capacity: z.number().int().min(1, 'Capacity must be at least 1'),
  type: z.enum(['AC', 'NON_AC'], { required_error: 'Type must be AC or NON_AC' }),
});

export const updateTableSchema = z.object({
  number: z.number().int().optional(),
  capacity: z.number().int().optional(),
  type: z.enum(['AC', 'NON_AC']).optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'BILLING'], { required_error: 'Status must be AVAILABLE, OCCUPIED, or BILLING' }),
});
