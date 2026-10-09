import rateLimit, { MemoryStore } from 'express-rate-limit';
import { env } from '../config/env.js';

function rateLimitHandler(_req, res) {
  res.status(429).json({
    success: false,
    message: 'Too many requests',
    errors: [],
  });
}

export const apiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

const authStore = new MemoryStore();

export const authRateLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: () => env.AUTH_RATE_LIMIT_MAX,
  store: authStore,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

export async function resetAuthRateLimiter() {
  await authStore.resetAll();
}
