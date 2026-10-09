import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ROLES } from '../../src/constants/roles.js';
import { getTestApp, resetDatabase } from '../helpers/app.js';
import { accessToken, bearer, createLead, createUser, seedOrganization } from '../helpers/factory.js';

let app;
let org;
let adminToken;
let managerAToken;
let managerBToken;
let execAToken;
let execBToken;

beforeAll(async () => {
  app = await getTestApp();
});

beforeEach(async () => {
  await resetDatabase();
  org = await seedOrganization();
  adminToken = await accessToken(app, 'admin@example.com');
  managerAToken = await accessToken(app, 'manager.a@example.com');
  managerBToken = await accessToken(app, 'manager.b@example.com');
  execAToken = await accessToken(app, 'exec.a@example.com');
  execBToken = await accessToken(app, 'exec.b@example.com');
});

describe('authorization', () => {
  it('lets admins manage users and blocks other roles', async () => {
    const created = await request(app).post('/api/v1/users').set(bearer(adminToken)).send({
      name: 'Second Admin',
      email: 'admin2@example.com',
      password: 'Password1',
      role: ROLES.ADMIN,
    });
    expect(created.status).toBe(201);
    expect(created.body.data.password).toBeUndefined();

    const forbidden = await request(app).get('/api/v1/users').set(bearer(managerAToken));
    expect(forbidden.status).toBe(403);

    const selfStatus = await request(app)
      .patch(`/api/v1/users/${org.admin._id}/status`)
      .set(bearer(adminToken))
      .send({ isActive: false });
    expect(selfStatus.status).toBe(403);

    const lastAdmin = await request(app)
      .patch(`/api/v1/users/${created.body.data._id}/status`)
      .set(bearer(adminToken))
      .send({ isActive: false });
    expect(lastAdmin.status).toBe(200);

    const lockout = await request(app)
      .patch(`/api/v1/users/${org.admin._id}/status`)
      .set(bearer(adminToken))
      .send({ isActive: false });
    expect(lockout.status).toBe(409);
  });

  it('rejects role changes on the caller and protected registration fields', async () => {
    const ownRole = await request(app)
      .patch(`/api/v1/users/${org.admin._id}`)
      .set(bearer(adminToken))
      .send({ role: ROLES.SALES_EXECUTIVE, teamName: 'Team A' });
    expect(ownRole.status).toBe(409);

    await request(app).post('/api/v1/users').set(bearer(adminToken)).send({
      name: 'Peer Admin',
      email: 'peer.admin@example.com',
      password: 'Password1',
      role: ROLES.ADMIN,
    });
    const ownRoleWithPeer = await request(app)
      .patch(`/api/v1/users/${org.admin._id}`)
      .set(bearer(adminToken))
      .send({ role: ROLES.SALES_EXECUTIVE, teamName: 'Team A' });
    expect(ownRoleWithPeer.status).toBe(403);

    const executiveUpdate = await request(app)
      .patch(`/api/v1/users/${org.execA._id}`)
      .set(bearer(execAToken))
      .send({ role: ROLES.ADMIN });
    expect(executiveUpdate.status).toBe(403);
  });

  it('hides resources outside a manager team and an executive assignment', async () => {
    const created = await createLead(app, execAToken, { email: 'scope@example.com' });
    expect(created.status).toBe(201);
    const leadId = created.body.data._id;

    const owner = await request(app).get(`/api/v1/leads/${leadId}`).set(bearer(execAToken));
    expect(owner.status).toBe(200);
    const otherExec = await request(app).get(`/api/v1/leads/${leadId}`).set(bearer(execBToken));
    expect(otherExec.status).toBe(404);
    const sameTeam = await request(app).get(`/api/v1/leads/${leadId}`).set(bearer(managerAToken));
    expect(sameTeam.status).toBe(200);
    const otherTeam = await request(app).get(`/api/v1/leads/${leadId}`).set(bearer(managerBToken));
    expect(otherTeam.status).toBe(404);

    const assignOtherTeam = await request(app)
      .patch(`/api/v1/leads/${leadId}/assignment`)
      .set(bearer(managerAToken))
      .send({ assignedTo: String(org.execB._id), reason: 'Wrong team' });
    expect(assignOtherTeam.status).toBe(403);

    const executiveAssign = await request(app)
      .patch(`/api/v1/leads/${leadId}/assignment`)
      .set(bearer(execAToken))
      .send({ assignedTo: String(org.execA._id) });
    expect(executiveAssign.status).toBe(403);
  });

  it('refuses to deactivate a user who still owns active leads', async () => {
    await createLead(app, execAToken, { email: 'owned@example.com' });
    const response = await request(app)
      .delete(`/api/v1/users/${org.execA._id}`)
      .set(bearer(adminToken));
    expect(response.status).toBe(409);
  });

  it('rejects assignment to an inactive executive', async () => {
    const inactive = await createUser({
      name: 'Idle Exec',
      email: 'idle@example.com',
      role: ROLES.SALES_EXECUTIVE,
      team: org.teamA._id,
      isActive: false,
    });
    const created = await createLead(app, execAToken, { email: 'assign@example.com' });
    const response = await request(app)
      .patch(`/api/v1/leads/${created.body.data._id}/assignment`)
      .set(bearer(managerAToken))
      .send({ assignedTo: String(inactive._id) });
    expect(response.status).toBe(422);
  });
});
