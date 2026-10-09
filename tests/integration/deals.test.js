import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { getTestApp, resetDatabase } from '../helpers/app.js';
import { accessToken, bearer, seedOrganization } from '../helpers/factory.js';

let app;
let execToken;
let adminToken;

beforeAll(async () => {
  app = await getTestApp();
});

beforeEach(async () => {
  await resetDatabase();
  await seedOrganization();
  execToken = await accessToken(app, 'exec.a@example.com');
  adminToken = await accessToken(app, 'admin@example.com');
});

async function createCustomerAndDeal() {
  const customer = await request(app).post('/api/v1/customers').set(bearer(execToken)).send({
    name: 'Converted Buyer',
    email: 'buyer@deals.example',
    company: 'Deals Co',
  });
  expect(customer.status).toBe(201);
  const deal = await request(app).post('/api/v1/deals').set(bearer(execToken)).send({
    name: 'Platform License',
    customer: customer.body.data._id,
    value: 100000,
    probability: 30,
    expectedClosingDate: '2026-12-31T00:00:00.000Z',
    stage: 'Qualification',
  });
  return { customer: customer.body.data, deal };
}

describe('deals', () => {
  it('rejects invalid value and probability and calculates expected revenue', async () => {
    const customer = await request(app).post('/api/v1/customers').set(bearer(execToken)).send({
      name: 'Buyer',
      email: 'buyer@money.example',
    });
    const invalidValue = await request(app).post('/api/v1/deals').set(bearer(execToken)).send({
      name: 'Bad Value',
      customer: customer.body.data._id,
      value: 0,
      probability: 30,
      expectedClosingDate: '2026-12-31T00:00:00.000Z',
    });
    expect(invalidValue.status).toBe(400);

    const invalidProbability = await request(app).post('/api/v1/deals').set(bearer(execToken)).send({
      name: 'Bad Probability',
      customer: customer.body.data._id,
      value: 5000,
      probability: 140,
      expectedClosingDate: '2026-12-31T00:00:00.000Z',
    });
    expect(invalidProbability.status).toBe(400);

    const created = await request(app).post('/api/v1/deals').set(bearer(execToken)).send({
      name: 'Good Deal',
      customer: customer.body.data._id,
      value: 100000,
      probability: 30,
      expectedClosingDate: '2026-12-31T00:00:00.000Z',
      expectedRevenue: 1,
    });
    expect(created.status).toBe(400);

    const valid = await request(app).post('/api/v1/deals').set(bearer(execToken)).send({
      name: 'Good Deal',
      customer: customer.body.data._id,
      value: 100000,
      probability: 30,
      expectedClosingDate: '2026-12-31T00:00:00.000Z',
    });
    expect(valid.status).toBe(201);
    expect(valid.body.data.expectedRevenue).toBe(30000);
  });

  it('validates stage changes, lost reasons, and closed-deal restrictions', async () => {
    const { deal } = await createCustomerAndDeal();
    expect(deal.status).toBe(201);
    const dealId = deal.body.data._id;

    const lost = await request(app)
      .patch(`/api/v1/deals/${dealId}/stage`)
      .set(bearer(execToken))
      .send({ stage: 'Lost' });
    expect(lost.status).toBe(422);

    const won = await request(app)
      .patch(`/api/v1/deals/${dealId}/stage`)
      .set(bearer(execToken))
      .send({ stage: 'Won' });
    expect(won.status).toBe(200);
    expect(won.body.data.probability).toBe(100);
    expect(won.body.data.closedAt).toEqual(expect.any(String));
    expect(won.body.data.expectedRevenue).toBe(100000);

    const back = await request(app)
      .patch(`/api/v1/deals/${dealId}/stage`)
      .set(bearer(execToken))
      .send({ stage: 'Proposal' });
    expect(back.status).toBe(422);

    const edit = await request(app)
      .patch(`/api/v1/deals/${dealId}`)
      .set(bearer(execToken))
      .send({ probability: 10 });
    expect(edit.status).toBe(409);

    const reopenForbidden = await request(app)
      .post(`/api/v1/deals/${dealId}/reopen`)
      .set(bearer(execToken))
      .send({ reason: 'Customer returned', stage: 'Negotiation', probability: 40 });
    expect(reopenForbidden.status).toBe(403);

    const reopened = await request(app)
      .post(`/api/v1/deals/${dealId}/reopen`)
      .set(bearer(adminToken))
      .send({ reason: 'Customer returned', stage: 'Negotiation', probability: 40 });
    expect(reopened.status).toBe(200);
    expect(reopened.body.data.stage).toBe('Negotiation');
    expect(reopened.body.data.closedAt).toBeNull();
    expect(reopened.body.data.expectedRevenue).toBe(40000);

    const lostAgain = await request(app)
      .patch(`/api/v1/deals/${dealId}/stage`)
      .set(bearer(adminToken))
      .send({ stage: 'Lost', lostReason: 'Budget cut' });
    expect(lostAgain.status).toBe(200);
    expect(lostAgain.body.data.probability).toBe(0);
    expect(lostAgain.body.data.lostReason).toBe('Budget cut');
  });
});
