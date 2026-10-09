const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'tokenHash',
  'refreshToken',
  'accessToken',
  'authorization',
  'cookie',
]);

export function stripSensitive(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stripSensitive(item));
  }
  if (!value || typeof value !== 'object' || value instanceof Date) {
    return value;
  }
  const output = {};
  for (const [key, nested] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(key)) {
      continue;
    }
    output[key] = stripSensitive(nested);
  }
  return output;
}
