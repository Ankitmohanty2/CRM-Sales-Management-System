import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { getTestApp, resetDatabase } from '../helpers/app.js';
import { accessToken, bearer, createLead, seedOrganization } from '../helpers/factory.js';

let app;
let token;
let managerToken;
let org;

beforeAll(async () => {
  app = await getTestApp();
});

beforeEach(async () => {
  await resetDatabase();
  org = await seedOrganization();
  token = await accessToken(app, 'exec.a@example.com');
  managerToken = await accessToken(app, 'manager.a@example.com');
});

describe('leads', () => {
  it('creates, filters, paginates, and validates leads', async () => {
    const created = await createLead(app, token);
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('New');
    expect(created.body.data.assignedTo.email).toBe('exec.a@example.com');

    await createLead(app, token, {
      name: 'Contoso Retail',
      email: 'buyer@contoso.example',
      company: 'Contoso',
      priority: 'Low',
      source: 'Referral',
    });

    const invalid = await createLead(app, token, { email: 'not-an-email', name: 'X' });
    expect(invalid.status).toBe(400);

    const filtered = await request(app)
      .get('/api/v1/leads')
      .query({ search: 'contoso', priority: 'Low', source: 'Referral', page: 1, limit: 10 })
      .set(bearer(token));
    expect(filtered.status).toBe(200);
    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.meta.totalRecords).toBe(1);

    const page = await request(app)
      .get('/api/v1/leads')
      .query({ limit: 1, page: 1, sortBy: 'name', sortOrder: 'asc' })
      .set(bearer(token));
    expect(page.status).toBe(200);
    expect(page.body.data).toHaveLength(1);
    expect(page.body.meta).toMatchObject({ page: 1, limit: 1, totalRecords: 2, totalPages: 2 });

    const badSort = await request(app).get('/api/v1/leads').query({ sortBy: '$where' }).set(bearer(token));
    expect(badSort.status).toBe(400);
  });

  it('enforces status transitions and records assignment', async () => {
    const execToken = token;
    const lead = await createLead(app, execToken, { email: 'flow@example.com' });
    const leadId = lead.body.data._id;

    const skip = await request(app)
      .patch(`/api/v1/leads/${leadId}/status`)
      .set(bearer(execToken))
      .send({ status: 'Qualified' });
    expect(skip.status).toBe(422);

    const contacted = await request(app)
      .patch(`/api/v1/leads/${leadId}/status`)
      .set(bearer(execToken))
      .send({ status: 'Contacted' });
    expect(contacted.status).toBe(200);

    const qualified = await request(app)
      .patch(`/api/v1/leads/${leadId}/status`)
      .set(bearer(managerToken))
      .send({ status: 'Qualified' });
    expect(qualified.status).toBe(200);

    const assigned = await request(app)
      .patch(`/api/v1/leads/${leadId}/assignment`)
      .set(bearer(managerToken))
      .send({ assignedTo: String(org.execA._id), reason: 'Coverage' });
    expect(assigned.status).toBe(200);

    const timeline = await request(app)
      .get(`/api/v1/timeline/leads/${leadId}`)
      .set(bearer(execToken));
    expect(timeline.status).toBe(200);
    expect(timeline.body.data.map((entry) => entry.action)).toEqual(expect.arrayContaining([
      'lead.created',
      'lead.status_changed',
      'lead.assigned',
    ]));
  });
});
