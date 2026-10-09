import { z } from 'zod';
import { ROLE_VALUES } from '../constants/roles.js';
import { emailSchema, idParamsSchema, objectIdSchema, optionalPhoneSchema, paginationSchema, passwordSchema } from './common.js';

const roleEnum = z.enum(ROLE_VALUES);

export const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100),
    email: emailSchema,
    password: passwordSchema,
    phone: optionalPhoneSchema,
  }).strict(),
});

export const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1).max(128),
  }).strict(),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1).max(128),
    newPassword: passwordSchema,
  }).strict(),
});

export const createUserSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100),
    email: emailSchema,
    password: passwordSchema,
    phone: optionalPhoneSchema,
    role: roleEnum,
    teamId: objectIdSchema.optional(),
    teamName: z.string().trim().min(2).max(100).optional(),
    isActive: z.boolean().optional(),
  }).strict(),
});

export const updateUserSchema = z.object({
  params: idParamsSchema,
  body: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    email: emailSchema.optional(),
    phone: optionalPhoneSchema,
    password: passwordSchema.optional(),
    role: roleEnum.optional(),
    teamId: objectIdSchema.optional(),
    teamName: z.string().trim().min(2).max(100).optional(),
  }).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required'),
});

export const userStatusSchema = z.object({
  params: idParamsSchema,
  body: z.object({
    isActive: z.boolean(),
  }).strict(),
});

export const userIdSchema = z.object({
  params: idParamsSchema,
});

export const userQuerySchema = z.object({
  query: paginationSchema.extend({
    role: roleEnum.optional(),
    team: objectIdSchema.optional(),
    isActive: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  }).strict(),
});
