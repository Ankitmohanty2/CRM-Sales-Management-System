import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import SwaggerParser from '@apidevtools/swagger-parser';
import { User } from '../../src/models/User.js';
import { Customer } from '../../src/models/Customer.js';
import { Lead } from '../../src/models/Lead.js';
import { Deal } from '../../src/models/Deal.js';
import { Activity } from '../../src/models/Activity.js';
import { AuditLog } from '../../src/models/AuditLog.js';
import { RefreshToken } from '../../src/models/RefreshToken.js';
import { getTestApp } from '../helpers/app.js';

const REQUIRED_OPERATIONS = [
  ['get', '/api/v1/health'],
  ['post', '/api/v1/auth/register'],
  ['post', '/api/v1/auth/login'],
  ['post', '/api/v1/auth/refresh'],
  ['post', '/api/v1/auth/logout'],
  ['post', '/api/v1/auth/logout-all'],
  ['get', '/api/v1/auth/me'],
  ['patch', '/api/v1/auth/me/password'],
  ['post', '/api/v1/users'],
  ['get', '/api/v1/users'],
  ['get', '/api/v1/users/{id}'],
  ['patch', '/api/v1/users/{id}'],
  ['patch', '/api/v1/users/{id}/status'],
  ['delete', '/api/v1/users/{id}'],
  ['post', '/api/v1/leads'],
  ['get', '/api/v1/leads'],
  ['get', '/api/v1/leads/{id}'],
  ['patch', '/api/v1/leads/{id}'],
  ['patch', '/api/v1/leads/{id}/status'],
  ['patch', '/api/v1/leads/{id}/assignment'],
  ['delete', '/api/v1/leads/{id}'],
  ['post', '/api/v1/leads/{id}/convert'],
  ['post', '/api/v1/customers'],
  ['get', '/api/v1/customers'],
  ['get', '/api/v1/customers/{id}'],
  ['patch', '/api/v1/customers/{id}'],
  ['delete', '/api/v1/customers/{id}'],
  ['post', '/api/v1/deals'],
  ['get', '/api/v1/deals'],
  ['get', '/api/v1/deals/{id}'],
  ['patch', '/api/v1/deals/{id}'],
  ['patch', '/api/v1/deals/{id}/stage'],
  ['patch', '/api/v1/deals/{id}/assignment'],
  ['post', '/api/v1/deals/{id}/reopen'],
  ['delete', '/api/v1/deals/{id}'],
  ['post', '/api/v1/activities'],
  ['get', '/api/v1/activities'],
  ['get', '/api/v1/activities/{id}'],
  ['patch', '/api/v1/activities/{id}'],
  ['patch', '/api/v1/activities/{id}/complete'],
  ['delete', '/api/v1/activities/{id}'],
  ['get', '/api/v1/timeline/leads/{id}'],
  ['get', '/api/v1/timeline/customers/{id}'],
  ['get', '/api/v1/timeline/deals/{id}'],
  ['get', '/api/v1/analytics/overview'],
  ['get', '/api/v1/analytics/pipeline'],
  ['get', '/api/v1/analytics/team-performance'],
  ['get', '/api/v1/config'],
  ['patch', '/api/v1/config'],
];

const PUBLIC_OPERATIONS = new Set([
  'get /api/v1/health',
  'post /api/v1/auth/register',
  'post /api/v1/auth/login',
  'post /api/v1/auth/refresh',
  'post /api/v1/auth/logout',
]);

describe('OpenAPI document', () => {
  it('validates as OpenAPI 3.0 and documents required operations', async () => {
    const specPath = path.resolve('docs/openapi.yaml');
    const api = await SwaggerParser.validate(specPath);
    expect(api.openapi.startsWith('3.0.')).toBe(true);

    for (const [method, route] of REQUIRED_OPERATIONS) {
      const operation = api.paths?.[route]?.[method];
      expect(operation, `${method.toUpperCase()} ${route}`).toBeTruthy();
      const key = `${method} ${route}`;
      if (PUBLIC_OPERATIONS.has(key)) {
        expect(operation.security).toEqual([]);
      } else {
        expect(operation.security).toEqual([{ bearerAuth: [] }]);
      }
      if (['post', 'patch', 'put'].includes(method) && !route.endsWith('/complete') && route !== '/api/v1/auth/refresh' && route !== '/api/v1/auth/logout' && route !== '/api/v1/auth/logout-all') {
        expect(operation.requestBody, `${key} request body`).toBeTruthy();
      }
    }
  });
});

describe('database indexes', () => {
  beforeAll(async () => {
    await getTestApp();
  });

  it('enforces unique user email and unique customer original lead', async () => {
    await Promise.all([
      User.init(),
      Customer.init(),
      Lead.init(),
      Deal.init(),
      Activity.init(),
      AuditLog.init(),
      RefreshToken.init(),
    ]);
    const userIndexes = await User.collection.indexes();
    expect(userIndexes.some((index) => index.key?.email === 1 && index.unique)).toBe(true);
    expect(userIndexes.some((index) => index.key?.role === 1 && index.key?.isActive === 1 && index.key?.team === 1)).toBe(true);

    const customerIndexes = await Customer.collection.indexes();
    expect(customerIndexes.some((index) => index.key?.originalLead === 1 && index.unique)).toBe(true);

    const leadIndexes = await Lead.collection.indexes();
    expect(leadIndexes.some((index) => index.key?.team === 1 && index.key?.assignedTo === 1 && index.key?.createdAt === -1)).toBe(true);

    const dealIndexes = await Deal.collection.indexes();
    expect(dealIndexes.some((index) => index.key?.stage === 1 && index.key?.createdAt === -1)).toBe(true);

    const activityIndexes = await Activity.collection.indexes();
    expect(activityIndexes.some((index) => index.key?.dueDate === 1 && index.key?.status === 1)).toBe(true);

    const auditIndexes = await AuditLog.collection.indexes();
    expect(auditIndexes.some((index) => index.key?.entityType === 1 && index.key?.entityId === 1 && index.key?.createdAt === -1)).toBe(true);

    const refreshIndexes = await RefreshToken.collection.indexes();
    expect(refreshIndexes.some((index) => index.key?.tokenHash === 1 && index.unique)).toBe(true);
    expect(refreshIndexes.some((index) => index.key?.expiresAt === 1)).toBe(true);
  });
});
