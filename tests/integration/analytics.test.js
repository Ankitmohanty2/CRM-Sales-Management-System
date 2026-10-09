import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { getTestApp, resetDatabase } from '../helpers/app.js';
import { accessToken, bearer, convertPayload, createLead, seedOrganization } from '../helpers/factory.js';

let app;

beforeAll(async () => {
  app = await getTestApp();
});

beforeEach(async () => {
  await resetDatabase();
  await seedOrganization();
});

describe('analytics', () => {
  it('returns zeros for an empty scope', async () => {
    const token = await accessToken(app, 'admin@example.com');
    const response = await request(app).get('/api/v1/analytics/overview').set(bearer(token));
    expect(response.status).toBe(200);
    expect(response.body.data.totalLeads).toBe(0);
    expect(response.body.data.conversionRate).toBe(0);
    expect(response.body.data.totalRevenue).toBe(0);

    const pipeline = await request(app).get('/api/v1/analytics/pipeline').set(bearer(token));
    expect(pipeline.status).toBe(200);
    expect(pipeline.body.data.every((stage) => stage.count === 0)).toBe(true);

    const team = await request(app).get('/api/v1/analytics/team-performance').set(bearer(token));
    expect(team.status).toBe(200);
    expect(team.body.data).toEqual([]);
  });

  it('aggregates won revenue once and limits executives to their own records', async () => {
    const execA = await accessToken(app, 'exec.a@example.com');
    const execB = await accessToken(app, 'exec.b@example.com');
    const lead = await createLead(app, execA, { email: 'analytics@example.com' });
    const leadId = lead.body.data._id;
    await request(app).patch(`/api/v1/leads/${leadId}/status`).set(bearer(execA)).send({ status: 'Contacted' });
    await request(app).patch(`/api/v1/leads/${leadId}/status`).set(bearer(execA)).send({ status: 'Qualified' });
    const converted = await request(app).post(`/api/v1/leads/${leadId}/convert`).set(bearer(execA)).send(convertPayload);
    expect(converted.status).toBe(201);
    const dealId = converted.body.data.deal._id;
    await request(app).patch(`/api/v1/deals/${dealId}/stage`).set(bearer(execA)).send({ stage: 'Won' });
    await createLead(app, execB, { email: 'other-analytics@example.com' });

    const own = await request(app).get('/api/v1/analytics/overview').set(bearer(execA));
    expect(own.body.data.totalLeads).toBe(1);
    expect(own.body.data.convertedLeads).toBe(1);
    expect(own.body.data.conversionRate).toBe(100);
    expect(own.body.data.wonDeals).toBe(1);
    expect(own.body.data.totalRevenue).toBe(100000);
    expect(own.body.data.openDeals).toBe(0);

    const other = await request(app).get('/api/v1/analytics/overview').set(bearer(execB));
    expect(other.body.data.totalLeads).toBe(1);
    expect(other.body.data.totalRevenue).toBe(0);

    const admin = await accessToken(app, 'admin@example.com');
    const global = await request(app).get('/api/v1/analytics/overview').set(bearer(admin));
    expect(global.body.data.totalLeads).toBe(2);
    expect(global.body.data.totalRevenue).toBe(100000);

    const manager = await accessToken(app, 'manager.b@example.com');
    const otherTeam = await request(app).get('/api/v1/analytics/overview').set(bearer(manager));
    expect(otherTeam.body.data.totalRevenue).toBe(0);
    expect(otherTeam.body.data.totalLeads).toBe(1);
  });
});
