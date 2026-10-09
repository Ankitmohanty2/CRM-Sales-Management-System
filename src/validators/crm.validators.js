import { z } from 'zod';
import { CUSTOMER_STATUSES } from '../constants/activityStatus.js';
import { DEAL_STAGES, OPEN_DEAL_STAGES } from '../constants/dealStage.js';
import { dateTimeSchema, emailSchema, idParamsSchema, objectIdSchema, optionalPhoneSchema, paginationSchema } from './common.js';

const addressSchema = z.object({
  street: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(20).optional(),
  country: z.string().trim().max(100).optional(),
}).strict();

export const createCustomerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(150),
    email: emailSchema,
    phone: optionalPhoneSchema,
    company: z.string().trim().max(150).optional(),
    address: addressSchema.optional(),
    assignedTo: objectIdSchema.optional(),
    status: z.enum(CUSTOMER_STATUSES).optional(),
  }).strict(),
});

export const updateCustomerSchema = z.object({
  params: idParamsSchema,
  body: z.object({
    name: z.string().trim().min(2).max(150).optional(),
    email: emailSchema.optional(),
    phone: optionalPhoneSchema,
    company: z.string().trim().max(150).optional(),
    address: addressSchema.optional(),
    status: z.enum(CUSTOMER_STATUSES).optional(),
  }).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required'),
});

export const customerQuerySchema = z.object({
  query: paginationSchema.extend({
    status: z.enum(CUSTOMER_STATUSES).optional(),
    assignedTo: objectIdSchema.optional(),
  }).strict(),
});

export const customerIdSchema = z.object({ params: idParamsSchema });

const dealFields = {
  name: z.string().trim().min(2).max(200),
  value: z.number().positive().max(1e12),
  probability: z.number().int().min(0).max(100).optional(),
  expectedClosingDate: dateTimeSchema,
  stage: z.enum(OPEN_DEAL_STAGES).optional(),
  description: z.string().trim().max(5000).optional(),
  customer: objectIdSchema,
  lead: objectIdSchema.optional(),
  assignedTo: objectIdSchema.optional(),
};

export const createDealSchema = z.object({
  body: z.object(dealFields).strict(),
});

export const updateDealSchema = z.object({
  params: idParamsSchema,
  body: z.object({
    name: z.string().trim().min(2).max(200).optional(),
    value: z.number().positive().max(1e12).optional(),
    probability: z.number().int().min(0).max(100).optional(),
    expectedClosingDate: dateTimeSchema.optional(),
    description: z.string().trim().max(5000).optional(),
  }).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required'),
});

export const dealStageSchema = z.object({
  params: idParamsSchema,
  body: z.object({
    stage: z.enum(DEAL_STAGES),
    lostReason: z.string().trim().min(1).max(1000).optional(),
  }).strict(),
});

export const reopenDealSchema = z.object({
  params: idParamsSchema,
  body: z.object({
    reason: z.string().trim().min(3).max(1000),
    stage: z.enum(OPEN_DEAL_STAGES),
    probability: z.number().int().min(0).max(100),
  }).strict(),
});

export const dealQuerySchema = z.object({
  query: paginationSchema.extend({
    stage: z.enum(DEAL_STAGES).optional(),
    status: z.enum(['open', 'won', 'lost']).optional(),
    assignedTo: objectIdSchema.optional(),
    minValue: z.coerce.number().positive().optional(),
    maxValue: z.coerce.number().positive().optional(),
    closingFrom: dateTimeSchema.optional(),
    closingTo: dateTimeSchema.optional(),
  }).strict(),
});

export const dealIdSchema = z.object({ params: idParamsSchema });
