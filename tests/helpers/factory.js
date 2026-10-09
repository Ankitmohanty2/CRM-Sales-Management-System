import bcrypt from 'bcrypt';
import request from 'supertest';
import { ROLES } from '../../src/constants/roles.js';
import { Team } from '../../src/models/Team.js';
import { User } from '../../src/models/User.js';

export async function createTeam(name) {
  return Team.create({ name });
}

export async function createUser({
  name,
  email,
  password = 'Password1',
  role,
  team = null,
  isActive = true,
}) {
  return User.create({
    name,
    email,
    password: await bcrypt.hash(password, 4),
    role,
    team,
    isActive,
  });
}

export async function seedOrganization() {
  const teamA = await createTeam('Team A');
  const teamB = await createTeam('Team B');
  const admin = await createUser({ name: 'Ada Admin', email: 'admin@example.com', role: ROLES.ADMIN });
  const managerA = await createUser({
    name: 'Mia Manager',
    email: 'manager.a@example.com',
    role: ROLES.SALES_MANAGER,
    team: teamA._id,
  });
  const managerB = await createUser({
    name: 'Max Manager',
    email: 'manager.b@example.com',
    role: ROLES.SALES_MANAGER,
    team: teamB._id,
  });
  const execA = await createUser({
    name: 'Eva Exec',
    email: 'exec.a@example.com',
    role: ROLES.SALES_EXECUTIVE,
    team: teamA._id,
  });
  const execB = await createUser({
    name: 'Eli Exec',
    email: 'exec.b@example.com',
    role: ROLES.SALES_EXECUTIVE,
    team: teamB._id,
  });
  return { teamA, teamB, admin, managerA, managerB, execA, execB };
}

export function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

export async function login(app, email, password = 'Password1') {
  return request(app).post('/api/v1/auth/login').send({ email, password });
}

export async function accessToken(app, email, password = 'Password1') {
  const response = await login(app, email, password);
  if (response.status !== 200) {
    throw new Error(`Login failed for ${email}: ${response.status}`);
  }
  return response.body.data.accessToken;
}

export function cookieHeader(response) {
  const raw = response.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.filter(Boolean).map((item) => item.split(';')[0]).join('; ');
}

export async function createLead(app, token, overrides = {}) {
  const response = await request(app)
    .post('/api/v1/leads')
    .set(bearer(token))
    .send({
      name: 'Northwind Manufacturing',
      email: 'buyer@northwind.example',
      phone: '4155550100',
      company: 'Northwind',
      source: 'Website',
      priority: 'High',
      description: 'Enterprise interest',
      ...overrides,
    });
  return response;
}

export const convertPayload = {
  deal: {
    name: 'Enterprise CRM Subscription',
    value: 100000,
    probability: 30,
    expectedClosingDate: '2026-12-31T00:00:00.000Z',
    stage: 'Qualification',
    description: 'Initial opportunity',
  },
};
