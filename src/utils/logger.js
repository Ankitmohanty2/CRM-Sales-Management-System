import pino from 'pino';
import { env } from '../config/env.js';

const indianTime = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
  timeZoneName: 'short',
});

function timestamp() {
  return `,"time":${JSON.stringify(indianTime.format(new Date()))}`;
}

export const logger = pino({
  level: env.LOG_LEVEL,
  timestamp,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'password',
      'token',
      'accessToken',
      'refreshToken',
    ],
    remove: true,
  },
});
