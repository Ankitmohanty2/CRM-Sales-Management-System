import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { env } from '../../src/config/env.js';
import { getTestApp, resetDatabase } from '../helpers/app.js';
import { accessToken, cookieHeader, createUser, login, seedOrganization } from '../helpers/factory.js';
import { ROLES } from '../../src/constants/roles.js';

let app;

beforeAll(async () => {
  app = await getTestApp();
});

beforeEach(async () => {
  await resetDatabase();
});

describe('authentication', () => {
  it('logs in an active user and rejects bad credentials', async () => {
    await seedOrganization();
    const success = await login(app, 'admin@example.com');
    expect(success.status).toBe(200);
    expect(success.body.success).toBe(true);
    expect(success.body.data.accessToken).toEqual(expect.any(String));
    expect(success.body.data.user.email).toBe('admin@example.com');
    expect(success.body.data.user.password).toBeUndefined();
    expect(success.body.data.refreshToken).toBeUndefined();
    expect(success.headers['set-cookie'].join(';')).toMatch(/HttpOnly/i);

    const failure = await login(app, 'admin@example.com', 'WrongPass1');
    expect(failure.status).toBe(401);
    expect(failure.body.message).toBe('Invalid email or password');
  });

  it('rejects inactive users after a correct password', async () => {
    await createUser({
      name: 'Inactive User',
      email: 'inactive@example.com',
      role: ROLES.ADMIN,
      isActive: false,
    });
    const response = await login(app, 'inactive@example.com');
    expect(response.status).toBe(403);
    expect(response.body.message).toBe('Account is inactive');
  });

  it('requires authentication for the profile endpoint', async () => {
    const response = await request(app).get('/api/v1/auth/me');
    expect(response.status).toBe(401);
  });

  it('rotates refresh tokens and rejects reuse of a revoked token', async () => {
    await seedOrganization();
    const first = await login(app, 'admin@example.com');
    const originalCookie = cookieHeader(first);

    const rotated = await request(app).post('/api/v1/auth/refresh').set('Cookie', originalCookie);
    expect(rotated.status).toBe(200);
    expect(rotated.body.data.accessToken).toEqual(expect.any(String));
    expect(rotated.body.data.refreshToken).toBeUndefined();

    const reused = await request(app).post('/api/v1/auth/refresh').set('Cookie', originalCookie);
    expect(reused.status).toBe(401);

    const familyCookie = cookieHeader(rotated);
    const afterReuse = await request(app).post('/api/v1/auth/refresh').set('Cookie', familyCookie);
    expect(afterReuse.status).toBe(401);
  });

  it('revokes the refresh token on logout and on password change', async () => {
    await seedOrganization();
    const first = await login(app, 'admin@example.com');
    const cookie = cookieHeader(first);
    const token = first.body.data.accessToken;

    const loggedOut = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
    expect(loggedOut.status).toBe(200);
    const afterLogout = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(afterLogout.status).toBe(401);

    const again = await login(app, 'exec.a@example.com');
    const changed = await request(app)
      .patch('/api/v1/auth/me/password')
      .set('Authorization', `Bearer ${again.body.data.accessToken}`)
      .send({ currentPassword: 'Password1', newPassword: 'Password2' });
    expect(changed.status).toBe(200);
    const refreshAfterPassword = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookieHeader(again));
    expect(refreshAfterPassword.status).toBe(401);
    const relogin = await login(app, 'exec.a@example.com', 'Password2');
    expect(relogin.status).toBe(200);

    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
  });

  it('registers only sales executives and can disable public registration', async () => {
    const created = await request(app).post('/api/v1/auth/register').send({
      name: 'New Seller',
      email: 'new.seller@example.com',
      password: 'Password1',
    });
    expect(created.status).toBe(201);
    expect(created.body.data.user.role).toBe(ROLES.SALES_EXECUTIVE);
    expect(created.body.data.user.password).toBeUndefined();

    const escalated = await request(app).post('/api/v1/auth/register').send({
      name: 'Bad Admin',
      email: 'bad.admin@example.com',
      password: 'Password1',
      role: ROLES.ADMIN,
    });
    expect(escalated.status).toBe(400);

    env.ALLOW_PUBLIC_REGISTRATION = false;
    const disabled = await request(app).post('/api/v1/auth/register').send({
      name: 'Closed',
      email: 'closed@example.com',
      password: 'Password1',
    });
    env.ALLOW_PUBLIC_REGISTRATION = true;
    expect(disabled.status).toBe(403);
  });

  it('returns the authenticated profile', async () => {
    await seedOrganization();
    const token = await accessToken(app, 'manager.a@example.com');
    const response = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data.email).toBe('manager.a@example.com');
    expect(response.body.data.password).toBeUndefined();
  });
});
