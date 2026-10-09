import { z } from 'zod';
import { LEAD_PRIORITIES, LEAD_SOURCES, LEAD_STATUSES } from '../constants/leadStatus.js';
import { dateTimeSchema, emailSchema, idParamsSchema, objectIdSchema, optionalPhoneSchema, paginationSchema } from './common.js';

const leadBody = {
  name: z.string().trim().min(2).max(150),
  email: emailSchema,
  phone: optionalPhoneSchema,
  company: z.string().trim().max(150).optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  priority: z.enum(LEAD_PRIORITIES).optional(),
  description: z.string().trim().max(5000).optional(),
  assignedTo: objectIdSchema.optional(),
};

export const createLeadSchema = z.object({
  body: z.object(leadBody).strict(),
});

export const updateLeadSchema = z.object({
  params: idParamsSchema,
  body: z.object({
    name: leadBody.name.optional(),
    email: emailSchema.optional(),
    phone: optionalPhoneSchema,
    company: z.string().trim().max(150).optional(),
    source: z.enum(LEAD_SOURCES).optional(),
    priority: z.enum(LEAD_PRIORITIES).optional(),
    description: z.string().trim().max(5000).optional(),
  }).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required'),
});

export const leadStatusSchema = z.object({
  params: idParamsSchema,
  body: z.object({
    status: z.enum(LEAD_STATUSES),
  }).strict(),
});

export const assignmentSchema = z.object({
  params: idParamsSchema,
  body: z.object({
    assignedTo: objectIdSchema,
    reason: z.string().trim().min(2).max(500).optional(),
  }).strict(),
});

export const leadQuerySchema = z.object({
  query: paginationSchema.extend({
    status: z.enum(LEAD_STATUSES).optional(),
    priority: z.enum(LEAD_PRIORITIES).optional(),
    source: z.enum(LEAD_SOURCES).optional(),
    assignedTo: objectIdSchema.optional(),
  }).strict(),
});

export const leadIdSchema = z.object({
  params: idParamsSchema,
});

export const convertLeadSchema = z.object({
  params: idParamsSchema,
  body: z.object({
    deal: z.object({
      name: z.string().trim().min(2).max(200),
      value: z.number().positive().max(1e12),
      probability: z.number().int().min(0).max(100),
      expectedClosingDate: dateTimeSchema,
      stage: z.enum(['Qualification', 'Discovery', 'Proposal', 'Negotiation']).optional(),
      description: z.string().trim().max(5000).optional(),
    }).strict(),
  }).strict(),
});
