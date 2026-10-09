import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { getTestApp, resetDatabase } from '../helpers/app.js';
import { accessToken, bearer, createLead, seedOrganization } from '../helpers/factory.js';

let app;
let execToken;
let otherToken;

beforeAll(async () => {
  app = await getTestApp();
});

beforeEach(async () => {
  await resetDatabase();
  await seedOrganization();
  execToken = await accessToken(app, 'exec.a@example.com');
  otherToken = await accessToken(app, 'exec.b@example.com');
});

describe('activities', () => {
  it('calculates overdue status, sets completion time, and enforces access', async () => {
    const lead = await createLead(app, execToken, { email: 'activity@example.com' });
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const created = await request(app).post('/api/v1/activities').set(bearer(execToken)).send({
      type: 'Call',
      title: 'Intro call',
      dueDate: past,
      relatedEntityType: 'Lead',
      relatedEntityId: lead.body.data._id,
    });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('Overdue');
    expect(created.body.data.completedAt).toBeNull();

    const hidden = await request(app).get(`/api/v1/activities/${created.body.data._id}`).set(bearer(otherToken));
    expect(hidden.status).toBe(404);

    const completed = await request(app)
      .patch(`/api/v1/activities/${created.body.data._id}/complete`)
      .set(bearer(execToken));
    expect(completed.status).toBe(200);
    expect(completed.body.data.status).toBe('Completed');
    expect(completed.body.data.completedAt).toEqual(expect.any(String));

    const stillOverdue = await request(app)
      .get('/api/v1/activities')
      .query({ status: 'Overdue' })
      .set(bearer(execToken));
    expect(stillOverdue.status).toBe(200);
    expect(stillOverdue.body.data).toHaveLength(0);
  });

  it('rejects an unknown related record', async () => {
    const response = await request(app).post('/api/v1/activities').set(bearer(execToken)).send({
      type: 'Note',
      title: 'Missing parent',
      relatedEntityType: 'Lead',
      relatedEntityId: new mongoose.Types.ObjectId().toString(),
    });
    expect(response.status).toBe(422);
  });
});
