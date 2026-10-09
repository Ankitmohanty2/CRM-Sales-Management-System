import fs from 'node:fs';
import path from 'node:path';

const uri = fs.readFileSync(path.resolve('tests/.mongo-uri'), 'utf8').trim();

process.env.NODE_ENV = 'test';
process.env.PORT = '5000';
process.env.MONGODB_URI = uri;
process.env.JWT_ACCESS_SECRET = 'test-access-secret-should-be-32chars-min';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-should-be-32charsx';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.JWT_ISSUER = 'crm-sales-api';
process.env.JWT_AUDIENCE = 'crm-sales-client';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.COOKIE_SECURE = 'false';
process.env.BCRYPT_ROUNDS = '4';
process.env.RATE_LIMIT_WINDOW_MS = '900000';
process.env.RATE_LIMIT_MAX = '10000';
process.env.AUTH_RATE_LIMIT_WINDOW_MS = '900000';
process.env.AUTH_RATE_LIMIT_MAX = '10000';
process.env.LOG_LEVEL = 'silent';
process.env.ALLOW_PUBLIC_REGISTRATION = 'true';
process.env.BOOTSTRAP_ADMIN_EMAIL = '';
process.env.BOOTSTRAP_ADMIN_PASSWORD = '';
process.env.BOOTSTRAP_ADMIN_NAME = 'System Admin';
