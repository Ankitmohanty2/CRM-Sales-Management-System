import { describe, expect, it } from 'vitest';
import { swaggerServers } from '../../src/config/swagger.js';

describe('swagger servers', () => {
  it('uses localhost alone when that is the current host and no public URL is configured', () => {
    expect(swaggerServers({
      requestOrigin: 'http://localhost:5000',
      configuredBaseUrl: undefined,
    })).toEqual([
      { url: 'http://localhost:5000', description: 'Current server' },
    ]);
  });

  it('selects the configured public origin first and keeps localhost available', () => {
    expect(swaggerServers({
      requestOrigin: 'http://localhost:5000',
      configuredBaseUrl: 'https://crm-sales-management-system-bo1l.onrender.com/',
    })).toEqual([
      { url: 'https://crm-sales-management-system-bo1l.onrender.com', description: 'Configured server' },
      { url: 'http://localhost:5000', description: 'Local development' },
    ]);
  });

  it('uses the request origin when no public URL is configured', () => {
    expect(swaggerServers({
      requestOrigin: 'https://crm-sales-management-system-bo1l.onrender.com',
      configuredBaseUrl: undefined,
    })[0]).toEqual({
      url: 'https://crm-sales-management-system-bo1l.onrender.com',
      description: 'Current server',
    });
  });
});
