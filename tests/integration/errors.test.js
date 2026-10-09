import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { env } from '../../src/config/env.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { getTestApp, resetDatabase } from '../helpers/app.js';
import { accessToken, bearer, seedOrganization } from '../helpers/factory.js';

let app;

beforeAll(async () => {
  app = await getTestApp();
});

beforeEach(async () => {
  await resetDatabase();
  await seedOrganization();
});

describe('error handling', () => {
  it('rejects malformed ids, duplicate emails, invalid bodies, and unknown routes', async () => {
    const token = await accessToken(app, 'admin@example.com');
    const malformed = await request(app).get('/api/v1/leads/not-an-id').set(bearer(token));
    expect(malformed.status).toBe(400);
    expect(malformed.body.success).toBe(false);

    const missing = await request(app).get('/api/v1/leads/507f1f77bcf86cd799439011').set(bearer(token));
    expect(missing.status).toBe(404);

    const duplicate = await request(app).post('/api/v1/users').set(bearer(token)).send({
      name: 'Copy',
      email: 'admin@example.com',
      password: 'Password1',
      role: 'Admin',
    });
    expect(duplicate.status).toBe(409);

    const invalid = await request(app).post('/api/v1/auth/login').send({ email: 'nope' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.errors.length).toBeGreaterThan(0);

    const unknown = await request(app).get('/api/v1/does-not-exist');
    expect(unknown.status).toBe(404);

    const health = await request(app).get('/api/v1/health');
    expect(health.status).toBe(200);
    expect(health.body.data.database).toBe('connected');
    expect(JSON.stringify(health.body)).not.toMatch(/mongodb/i);
  });

  it('hides internal details from unexpected errors', () => {
    const previous = env.NODE_ENV;
    env.NODE_ENV = 'production';
    const res = {
      statusCode: 0,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
    errorHandler(new Error('password super-secret-token'), {}, res, () => {});
    env.NODE_ENV = previous;
    expect(res.statusCode).toBe(500);
    expect(res.body.message).toBe('Internal server error');
    expect(res.body.stack).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('super-secret-token');
  });
});
