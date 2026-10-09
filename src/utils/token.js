import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { durationToMs } from './duration.js';

export function signAccessToken(user) {
  return jwt.sign(
    { role: user.role },
    env.JWT_ACCESS_SECRET,
    {
      algorithm: 'HS256',
      subject: String(user._id),
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    },
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });
}

export function generateRefreshToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function newFamilyId() {
  return crypto.randomUUID();
}

export function refreshMaxAgeMs() {
  return durationToMs(env.JWT_REFRESH_EXPIRES_IN);
}

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: refreshMaxAgeMs(),
  };
}

export const REFRESH_COOKIE_NAME = 'refreshToken';
