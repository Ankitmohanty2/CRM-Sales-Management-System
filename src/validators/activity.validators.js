import { z } from 'zod';
import { ACTIVITY_STATUSES, ACTIVITY_TYPES, RELATED_ENTITY_TYPES } from '../constants/activityStatus.js';
import { LEAD_PRIORITIES, LEAD_SOURCES } from '../constants/leadStatus.js';
import { OPEN_DEAL_STAGES } from '../constants/dealStage.js';
import { dateTimeSchema, idParamsSchema, objectIdSchema, paginationSchema } from './common.js';

export const createActivitySchema = z.object({
  body: z.object({
    type: z.enum(ACTIVITY_TYPES),
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().max(5000).optional(),
    dueDate: dateTimeSchema.optional(),
    assignedTo: objectIdSchema.optional(),
    relatedEntityType: z.enum(RELATED_ENTITY_TYPES),
    relatedEntityId: objectIdSchema,
  }).strict(),
});

export const updateActivitySchema = z.object({
  params: idParamsSchema,
  body: z.object({
    type: z.enum(ACTIVITY_TYPES).optional(),
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    dueDate: dateTimeSchema.nullable().optional(),
    assignedTo: objectIdSchema.optional(),
  }).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required'),
});

export const activityQuerySchema = z.object({
  query: paginationSchema.extend({
    type: z.enum(ACTIVITY_TYPES).optional(),
    status: z.enum(ACTIVITY_STATUSES).optional(),
    assignedTo: objectIdSchema.optional(),
    relatedEntityType: z.enum(RELATED_ENTITY_TYPES).optional(),
    relatedEntityId: objectIdSchema.optional(),
    dueFrom: dateTimeSchema.optional(),
    dueTo: dateTimeSchema.optional(),
  }).strict(),
});

export const activityIdSchema = z.object({ params: idParamsSchema });

export const timelineQuerySchema = z.object({
  params: idParamsSchema,
  query: paginationSchema.pick({ page: true, limit: true, sortBy: true, sortOrder: true }).strict(),
});

export const analyticsQuerySchema = z.object({
  query: z.object({
    from: dateTimeSchema.optional(),
    to: dateTimeSchema.optional(),
  }).strict(),
});

export const updateConfigSchema = z.object({
  body: z.object({
    companyName: z.string().trim().min(2).max(150).optional(),
    defaultLeadSource: z.enum(LEAD_SOURCES).optional(),
    defaultLeadPriority: z.enum(LEAD_PRIORITIES).optional(),
    defaultDealStage: z.enum(OPEN_DEAL_STAGES).optional(),
    defaultDealProbability: z.number().int().min(0).max(100).optional(),
  }).strict().refine((value) => Object.keys(value).length > 0, 'At least one setting is required'),
});
