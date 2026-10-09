import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Customer } from '../../src/models/Customer.js';
import { getTestApp, resetDatabase } from '../helpers/app.js';
import { accessToken, bearer, convertPayload, createLead, seedOrganization } from '../helpers/factory.js';

let app;
let token;

beforeAll(async () => {
  app = await getTestApp();
});

beforeEach(async () => {
  await resetDatabase();
  await seedOrganization();
  token = await accessToken(app, 'exec.a@example.com');
});

describe('customer deletion', () => {
  it('deletes a customer that has no deals and rejects deletion when a deal exists', async () => {
    const created = await request(app).post('/api/v1/customers').set(bearer(token)).send({
      name: 'Manual Buyer',
      email: 'manual.buyer@example.com',
    });
    expect(created.status).toBe(201);
    const customerId = created.body.data._id;

    const removed = await request(app).delete(`/api/v1/customers/${customerId}`).set(bearer(token));
    expect(removed.status).toBe(200);
    expect(await Customer.findById(customerId)).toBeNull();

    const again = await request(app).post('/api/v1/customers').set(bearer(token)).send({
      name: 'Manual Buyer',
      email: 'manual.buyer@example.com',
    });
    const deal = await request(app).post('/api/v1/deals').set(bearer(token)).send({
      name: 'Retainer',
      customer: again.body.data._id,
      value: 2500,
      probability: 40,
      expectedClosingDate: '2026-12-31T00:00:00.000Z',
    });
    expect(deal.status).toBe(201);

    const blocked = await request(app).delete(`/api/v1/customers/${again.body.data._id}`).set(bearer(token));
    expect(blocked.status).toBe(409);
    expect(await Customer.findById(again.body.data._id)).not.toBeNull();
  });

  it('rejects deletion of a customer created by lead conversion', async () => {
    const lead = await createLead(app, token, { email: 'convert-delete@example.com' });
    const leadId = lead.body.data._id;
    await request(app).patch(`/api/v1/leads/${leadId}/status`).set(bearer(token)).send({ status: 'Contacted' });
    await request(app).patch(`/api/v1/leads/${leadId}/status`).set(bearer(token)).send({ status: 'Qualified' });
    const converted = await request(app)
      .post(`/api/v1/leads/${leadId}/convert`)
      .set(bearer(token))
      .send(convertPayload);
    expect(converted.status).toBe(201);

    const blocked = await request(app)
      .delete(`/api/v1/customers/${converted.body.data.customer._id}`)
      .set(bearer(token));
    expect(blocked.status).toBe(409);
    expect(await Customer.findById(converted.body.data.customer._id)).not.toBeNull();
  });
});
