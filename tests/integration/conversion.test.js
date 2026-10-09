import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Customer } from '../../src/models/Customer.js';
import { Deal } from '../../src/models/Deal.js';
import { Lead } from '../../src/models/Lead.js';
import { setConversionGuard } from '../../src/services/conversionGuard.js';
import { getTestApp, resetDatabase } from '../helpers/app.js';
import { accessToken, bearer, convertPayload, createLead, seedOrganization } from '../helpers/factory.js';

let app;
let token;

async function qualifiedLead(email) {
  const created = await createLead(app, token, { email });
  const leadId = created.body.data._id;
  await request(app).patch(`/api/v1/leads/${leadId}/status`).set(bearer(token)).send({ status: 'Contacted' });
  await request(app).patch(`/api/v1/leads/${leadId}/status`).set(bearer(token)).send({ status: 'Qualified' });
  return leadId;
}

beforeAll(async () => {
  app = await getTestApp();
});

beforeEach(async () => {
  setConversionGuard(null);
  await resetDatabase();
  await seedOrganization();
  token = await accessToken(app, 'exec.a@example.com');
});

describe('lead conversion', () => {
  it('rejects leads that are not qualified', async () => {
    const created = await createLead(app, token, { email: 'early@example.com' });
    const response = await request(app)
      .post(`/api/v1/leads/${created.body.data._id}/convert`)
      .set(bearer(token))
      .send(convertPayload);
    expect(response.status).toBe(422);
  });

  it('converts a qualified lead once and links the customer and deal', async () => {
    const leadId = await qualifiedLead('convert@example.com');
    const response = await request(app)
      .post(`/api/v1/leads/${leadId}/convert`)
      .set(bearer(token))
      .send(convertPayload);
    expect(response.status).toBe(201);
    expect(response.body.data.customer.originalLead).toBe(leadId);
    expect(response.body.data.deal.lead).toBe(leadId);
    expect(String(response.body.data.deal.customer._id || response.body.data.deal.customer)).toBe(String(response.body.data.customer._id));
    expect(response.body.data.deal.expectedRevenue).toBe(30000);
    expect(response.body.data.lead.status).toBe('Converted');

    const duplicate = await request(app)
      .post(`/api/v1/leads/${leadId}/convert`)
      .set(bearer(token))
      .send(convertPayload);
    expect(duplicate.status).toBe(409);
    expect(await Customer.countDocuments({ originalLead: leadId })).toBe(1);
    expect(await Deal.countDocuments({ lead: leadId })).toBe(1);
  });

  it('rolls back every conversion write when the transaction fails', async () => {
    const leadId = await qualifiedLead('rollback@example.com');
    setConversionGuard(async () => {
      throw new Error('forced conversion failure');
    });
    const response = await request(app)
      .post(`/api/v1/leads/${leadId}/convert`)
      .set(bearer(token))
      .send(convertPayload);
    expect(response.status).toBe(500);
    expect(response.body.stack).toBeUndefined();
    expect(response.body.message).toBe('Internal server error');
    const lead = await Lead.findById(leadId);
    expect(lead.status).toBe('Qualified');
    expect(lead.convertedCustomer).toBeNull();
    expect(await Customer.countDocuments({ originalLead: leadId })).toBe(0);
    expect(await Deal.countDocuments({ lead: leadId })).toBe(0);
  });
});
