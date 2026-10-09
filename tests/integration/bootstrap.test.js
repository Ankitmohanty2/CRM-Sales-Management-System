import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../../src/config/env.js';
import { ROLES } from '../../src/constants/roles.js';
import { User } from '../../src/models/User.js';
import { bootstrapAdmin } from '../../src/services/bootstrap.service.js';
import { getTestApp, resetDatabase } from '../helpers/app.js';
import { seedOrganization } from '../helpers/factory.js';

const originalEmail = env.BOOTSTRAP_ADMIN_EMAIL;
const originalPassword = env.BOOTSTRAP_ADMIN_PASSWORD;
const originalName = env.BOOTSTRAP_ADMIN_NAME;

beforeAll(async () => {
  await getTestApp();
});

beforeEach(async () => {
  await resetDatabase();
});

afterEach(() => {
  env.BOOTSTRAP_ADMIN_EMAIL = originalEmail;
  env.BOOTSTRAP_ADMIN_PASSWORD = originalPassword;
  env.BOOTSTRAP_ADMIN_NAME = originalName;
});

describe('initial admin bootstrap', () => {
  it('creates one admin and does not create another on the next startup', async () => {
    env.BOOTSTRAP_ADMIN_EMAIL = 'bootstrap.admin@example.com';
    env.BOOTSTRAP_ADMIN_PASSWORD = 'Password1';
    env.BOOTSTRAP_ADMIN_NAME = 'Bootstrap Admin';

    expect(await bootstrapAdmin()).toBe(true);
    const admin = await User.findOne({ email: 'bootstrap.admin@example.com' }).select('+password');
    expect(admin.role).toBe(ROLES.ADMIN);
    expect(admin.name).toBe('Bootstrap Admin');
    expect(admin.password).not.toBe('Password1');
    expect(admin.password.startsWith('$2')).toBe(true);

    expect(await bootstrapAdmin()).toBe(false);
    expect(await User.countDocuments({ role: ROLES.ADMIN })).toBe(1);
  });

  it('does not replace an admin that already exists', async () => {
    await seedOrganization();
    env.BOOTSTRAP_ADMIN_EMAIL = 'other.admin@example.com';
    env.BOOTSTRAP_ADMIN_PASSWORD = 'Password1';
    env.BOOTSTRAP_ADMIN_NAME = 'Other Admin';

    expect(await bootstrapAdmin()).toBe(false);
    expect(await User.findOne({ email: 'other.admin@example.com' })).toBeNull();
    const existing = await User.findOne({ email: 'admin@example.com' });
    expect(existing.role).toBe(ROLES.ADMIN);
    expect(existing.name).toBe('Ada Admin');
  });

  it('does nothing when bootstrap credentials are unset', async () => {
    env.BOOTSTRAP_ADMIN_EMAIL = undefined;
    env.BOOTSTRAP_ADMIN_PASSWORD = undefined;
    expect(await bootstrapAdmin()).toBe(false);
    expect(await User.countDocuments({ role: ROLES.ADMIN })).toBe(0);
  });
});
