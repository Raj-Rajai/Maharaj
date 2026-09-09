import { z } from 'zod';

export const createUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'AC_MASTER', 'NON_AC_MASTER']),
  permissions: z.array(z.string()).optional()
});

export const updateUserSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'AC_MASTER', 'NON_AC_MASTER']).optional(),
  permissions: z.array(z.string()).optional()
});

export const updateStatusSchema = z.object({
  active: z.boolean()
});
