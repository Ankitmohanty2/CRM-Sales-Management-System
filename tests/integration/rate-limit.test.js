import { beforeAll, afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { env } from '../../src/config/env.js';
import { resetAuthRateLimiter } from '../../src/middleware/rateLimiter.js';
import { getTestApp } from '../helpers/app.js';

let app;
const previousLimit = env.AUTH_RATE_LIMIT_MAX;

beforeAll(async () => {
  app = await getTestApp();
});

afterEach(async () => {
  env.AUTH_RATE_LIMIT_MAX = previousLimit;
  await resetAuthRateLimiter();
});

describe('login rate limit', () => {
  it('returns 429 after the configured number of login attempts', async () => {
    env.AUTH_RATE_LIMIT_MAX = 2;
    const body = { email: 'nobody@example.com', password: 'Password1' };

    const first = await request(app).post('/api/v1/auth/login').send(body);
    const second = await request(app).post('/api/v1/auth/login').send(body);
    const third = await request(app).post('/api/v1/auth/login').send(body);

    expect(first.status).toBe(401);
    expect(second.status).toBe(401);
    expect(third.status).toBe(429);
    expect(third.body).toEqual({
      success: false,
      message: 'Too many requests',
      errors: [],
    });

    env.AUTH_RATE_LIMIT_MAX = previousLimit;
    await resetAuthRateLimiter();
    const restored = await request(app).post('/api/v1/auth/login').send(body);
    expect(restored.status).toBe(401);
  });
});
