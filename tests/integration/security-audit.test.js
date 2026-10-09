import jwt from 'jsonwebtoken';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { env } from '../../src/config/env.js';
import { ROLES } from '../../src/constants/roles.js';
import { getTestApp, resetDatabase } from '../helpers/app.js';
import { accessToken, bearer, createLead, seedOrganization } from '../helpers/factory.js';

let app;
let org;

beforeAll(async () => {
  app = await getTestApp();
});

beforeEach(async () => {
  await resetDatabase();
  org = await seedOrganization();
});

describe('security regressions', () => {
  it('rejects tampered, wrong-audience, and expired access tokens', async () => {
    const wrongSecret = jwt.sign({ role: ROLES.ADMIN }, 'another-secret-that-is-long-enough-32', {
      subject: String(org.execA._id),
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      expiresIn: '5m',
    });
    const wrongAudience = jwt.sign({ role: ROLES.ADMIN }, env.JWT_ACCESS_SECRET, {
      subject: String(org.execA._id),
      issuer: env.JWT_ISSUER,
      audience: 'other-client',
      expiresIn: '5m',
    });
    const expired = jwt.sign({ role: ROLES.SALES_EXECUTIVE }, env.JWT_ACCESS_SECRET, {
      subject: String(org.execA._id),
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      expiresIn: -10,
    });

    for (const token of [wrongSecret, wrongAudience, expired]) {
      const response = await request(app).get('/api/v1/auth/me').set(bearer(token));
      expect(response.status).toBe(401);
    }
  });

  it('rejects an access token after the user is deactivated', async () => {
    const token = await accessToken(app, 'exec.a@example.com');
    const adminToken = await accessToken(app, 'admin@example.com');
    const deactivated = await request(app)
      .patch(`/api/v1/users/${org.execA._id}/status`)
      .set(bearer(adminToken))
      .send({ isActive: false });
    expect(deactivated.status).toBe(200);

    const me = await request(app).get('/api/v1/auth/me').set(bearer(token));
    expect(me.status).toBe(401);
  });

  it('does not change a lead when the assignee has the wrong role', async () => {
    const execToken = await accessToken(app, 'exec.a@example.com');
    const managerToken = await accessToken(app, 'manager.a@example.com');
    const created = await createLead(app, execToken, { email: 'role-assignee@example.com' });
    const leadId = created.body.data._id;
    const originalAssignee = String(created.body.data.assignedTo._id);

    const response = await request(app)
      .patch(`/api/v1/leads/${leadId}/assignment`)
      .set(bearer(managerToken))
      .send({ assignedTo: String(org.managerA._id), reason: 'Wrong role' });
    expect(response.status).toBe(422);

    const reread = await request(app).get(`/api/v1/leads/${leadId}`).set(bearer(execToken));
    expect(String(reread.body.data.assignedTo._id)).toBe(originalAssignee);
  });

  it('merges customer address updates instead of replacing the whole address', async () => {
    const token = await accessToken(app, 'exec.a@example.com');
    const created = await request(app).post('/api/v1/customers').set(bearer(token)).send({
      name: 'Address Buyer',
      email: 'address@example.com',
      address: { street: '12 MG Road', city: 'Pune' },
    });
    expect(created.status).toBe(201);

    const updated = await request(app)
      .patch(`/api/v1/customers/${created.body.data._id}`)
      .set(bearer(token))
      .send({ address: { city: 'Mumbai' } });
    expect(updated.status).toBe(200);
    expect(updated.body.data.address.street).toBe('12 MG Road');
    expect(updated.body.data.address.city).toBe('Mumbai');
  });

  it('hides users outside an executive scope from team performance', async () => {
    const adminToken = await accessToken(app, 'admin@example.com');
    const execToken = await accessToken(app, 'exec.a@example.com');
    const customer = await request(app).post('/api/v1/customers').set(bearer(adminToken)).send({
      name: 'Scoped Buyer',
      email: 'scoped-buyer@example.com',
      assignedTo: String(org.execA._id),
    });
    expect(customer.status).toBe(201);
    const deal = await request(app).post('/api/v1/deals').set(bearer(adminToken)).send({
      name: 'Admin Created Deal',
      customer: customer.body.data._id,
      assignedTo: String(org.execA._id),
      value: 5000,
      probability: 50,
      expectedClosingDate: '2026-12-31T00:00:00.000Z',
    });
    expect(deal.status).toBe(201);

    const performance = await request(app).get('/api/v1/analytics/team-performance').set(bearer(execToken));
    expect(performance.status).toBe(200);
    const emails = performance.body.data.map((row) => row.email);
    expect(emails).not.toContain('admin@example.com');
    expect(emails).toContain('exec.a@example.com');
  });

  it('rejects malformed JSON and forged activity timestamps', async () => {
    const malformed = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{');
    expect(malformed.status).toBe(400);
    expect(malformed.body.success).toBe(false);

    const token = await accessToken(app, 'exec.a@example.com');
    const lead = await createLead(app, token, { email: 'stamp@example.com' });
    const forged = await request(app).post('/api/v1/activities').set(bearer(token)).send({
      type: 'Note',
      title: 'Forged completion',
      relatedEntityType: 'Lead',
      relatedEntityId: lead.body.data._id,
      status: 'Completed',
      completedAt: '2020-01-01T00:00:00.000Z',
    });
    expect(forged.status).toBe(400);
  });
});
