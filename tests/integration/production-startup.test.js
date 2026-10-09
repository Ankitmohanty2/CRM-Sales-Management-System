import { spawn } from 'node:child_process';
import mongoose from 'mongoose';
import { beforeAll, describe, expect, it } from 'vitest';
import { env } from '../../src/config/env.js';
import { startServer, stopServer } from '../../src/server.js';
import { getTestApp } from '../helpers/app.js';

const PORT = '58741';

function childEnv(overrides) {
  return {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    PATHEXT: process.env.PATHEXT,
    ComSpec: process.env.ComSpec,
    NODE_ENV: 'production',
    JWT_ACCESS_SECRET: 'prod-test-access-secret-32chars-min',
    JWT_REFRESH_SECRET: 'prod-test-refresh-secret-32chars-xx',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    JWT_ISSUER: 'crm-sales-api',
    JWT_AUDIENCE: 'crm-sales-client',
    CORS_ORIGINS: 'http://localhost:3000',
    COOKIE_SECURE: 'true',
    BCRYPT_ROUNDS: '4',
    RATE_LIMIT_WINDOW_MS: '900000',
    RATE_LIMIT_MAX: '100',
    AUTH_RATE_LIMIT_WINDOW_MS: '900000',
    AUTH_RATE_LIMIT_MAX: '10',
    LOG_LEVEL: 'info',
    ALLOW_PUBLIC_REGISTRATION: 'false',
    BOOTSTRAP_ADMIN_EMAIL: '',
    BOOTSTRAP_ADMIN_PASSWORD: '',
    BOOTSTRAP_ADMIN_NAME: 'System Admin',
    ...overrides,
  };
}

function runNode(args, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('close', (code) => resolve({ code, output }));
  });
}

async function waitForHealth() {
  const started = Date.now();
  while (Date.now() - started < 20000) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/api/v1/health`);
      if (response.ok) return response;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Production server did not become healthy');
}

describe('production startup', () => {
  beforeAll(async () => {
    await getTestApp();
  });

  it('rejects invalid production configuration before connecting', async () => {
    const result = await runNode(['src/server.js'], childEnv({ MONGODB_URI: '' }));
    expect(result.code).not.toBe(0);
    expect(result.output).toContain('Invalid environment configuration');
    expect(result.output).toContain('MONGODB_URI');
    expect(result.output).not.toContain('prod-test-access-secret');
  });

  it('serves production health, security headers, and safe errors', async () => {
    const uri = new URL(process.env.MONGODB_URI);
    uri.pathname = '/crm_startup_test';
    const child = spawn(process.execPath, ['src/server.js'], {
      cwd: process.cwd(),
      env: childEnv({ PORT, MONGODB_URI: uri.toString() }),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });

    try {
      const health = await waitForHealth();
      const healthBody = await health.json();
      expect(healthBody.success).toBe(true);
      expect(healthBody.data).toEqual({ status: 'ok', database: 'connected' });
      expect(JSON.stringify(healthBody)).not.toMatch(/mongodb/i);
      expect(health.headers.get('x-content-type-options')).toBe('nosniff');
      expect(health.headers.get('x-frame-options')).toBe('SAMEORIGIN');
      expect(health.headers.get('strict-transport-security')).toContain('max-age');
      expect(health.headers.get('content-security-policy')).toContain("default-src 'self'");

      const missing = await fetch(`http://127.0.0.1:${PORT}/api/v1/does-not-exist`);
      const missingBody = await missing.json();
      expect(missing.status).toBe(404);
      expect(missingBody.success).toBe(false);
      expect(missingBody.stack).toBeUndefined();

      const invalid = await fetch(`http://127.0.0.1:${PORT}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      const invalidBody = await invalid.json();
      expect(invalid.status).toBe(400);
      expect(invalidBody.success).toBe(false);
      expect(invalidBody.stack).toBeUndefined();
      expect(output).toContain('CRM sales API listening');
      expect(output).not.toContain('prod-test-access-secret');
    } finally {
      child.kill();
      await new Promise((resolve) => child.once('close', resolve));
    }
  }, 30000);

  it('closes the HTTP server and MongoDB connection on shutdown', async () => {
    const previousPort = env.PORT;
    env.PORT = 58742;
    try {
      await startServer();
      const health = await fetch('http://127.0.0.1:58742/api/v1/health');
      expect(health.status).toBe(200);
      await stopServer('SIGTERM');
      expect(mongoose.connection.readyState).toBe(0);
      await expect(fetch('http://127.0.0.1:58742/api/v1/health')).rejects.toThrow();
    } finally {
      env.PORT = previousPort;
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
    }
  });
});
