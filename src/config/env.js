import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const durationSchema = z.string().regex(/^\d+(ms|s|m|h|d)$/);

const booleanFromString = z.enum(['true', 'false']).transform((value) => value === 'true');

function envBoolean(defaultValue) {
  return z.preprocess(
    (value) => (value === undefined || value === '' ? defaultValue : value),
    booleanFromString,
  );
}

const emptyToUndefined = (value) => (value === '' || value === undefined ? undefined : value);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: durationSchema.default('15m'),
  JWT_REFRESH_EXPIRES_IN: durationSchema.default('7d'),
  JWT_ISSUER: z.string().min(1).default('crm-sales-api'),
  JWT_AUDIENCE: z.string().min(1).default('crm-sales-client'),
  CORS_ORIGINS: z.string().min(1).default('http://localhost:3000'),
  COOKIE_SECURE: envBoolean('false'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  ALLOW_PUBLIC_REGISTRATION: envBoolean('false'),
  API_BASE_URL: z.preprocess((value) => {
    if (value === undefined || value === '') return undefined;
    return String(value).trim().replace(/\/$/, '');
  }, z.string().url().optional()),
  BOOTSTRAP_ADMIN_EMAIL: z.preprocess(emptyToUndefined, z.string().email().optional()),
  BOOTSTRAP_ADMIN_PASSWORD: z.preprocess(emptyToUndefined, z.string().min(8).optional()),
  BOOTSTRAP_ADMIN_NAME: z.string().min(1).max(100).default('System Admin'),
}).superRefine((value, ctx) => {
  if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different',
      path: ['JWT_REFRESH_SECRET'],
    });
  }
  const hasEmail = Boolean(value.BOOTSTRAP_ADMIN_EMAIL);
  const hasPassword = Boolean(value.BOOTSTRAP_ADMIN_PASSWORD);
  if (hasEmail !== hasPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD must both be set or both be omitted',
      path: ['BOOTSTRAP_ADMIN_EMAIL'],
    });
  }
  if (value.API_BASE_URL) {
    const url = new URL(value.API_BASE_URL);
    if (url.username || url.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'API_BASE_URL must not include credentials',
        path: ['API_BASE_URL'],
      });
    }
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = parsed.data;

export function corsOrigins() {
  return env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);
}
