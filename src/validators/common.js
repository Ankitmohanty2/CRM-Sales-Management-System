import { z } from 'zod';

export const objectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id');

export const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());

export const phoneSchema = z.string().trim().regex(/^\+?[0-9]{7,15}$/, 'Invalid phone number');

export const passwordSchema = z.string().min(8).max(128).regex(/[A-Za-z]/, 'Password must include a letter').regex(/[0-9]/, 'Password must include a number');

export const dateTimeSchema = z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid date');

export const optionalPhoneSchema = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  phoneSchema.optional(),
);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.string().trim().min(1).max(40).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().max(100).optional(),
  from: dateTimeSchema.optional(),
  to: dateTimeSchema.optional(),
});

export const idParamsSchema = z.object({
  id: objectIdSchema,
});
