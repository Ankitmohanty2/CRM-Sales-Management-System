import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import { ROLES } from '../constants/roles.js';
import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';

export async function bootstrapAdmin() {
  if (!env.BOOTSTRAP_ADMIN_EMAIL || !env.BOOTSTRAP_ADMIN_PASSWORD) {
    return false;
  }

  const existingAdmin = await User.exists({ role: ROLES.ADMIN });
  if (existingAdmin) {
    return false;
  }

  const password = await bcrypt.hash(env.BOOTSTRAP_ADMIN_PASSWORD, env.BCRYPT_ROUNDS);
  await User.create({
    name: env.BOOTSTRAP_ADMIN_NAME,
    email: env.BOOTSTRAP_ADMIN_EMAIL,
    password,
    role: ROLES.ADMIN,
    isActive: true,
  });
  logger.info('Initial admin account created');
  return true;
}
