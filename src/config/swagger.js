import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import swaggerUi from 'swagger-ui-express';
import { load as loadYaml } from 'js-yaml';
import { env } from './env.js';

const LOCAL_SERVER = 'http://localhost:5000';
const specPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/openapi.yaml');

export function swaggerServers({ requestOrigin, configuredBaseUrl = env.API_BASE_URL } = {}) {
  const primary = (configuredBaseUrl || requestOrigin || LOCAL_SERVER).replace(/\/$/, '');
  const servers = [{
    url: primary,
    description: configuredBaseUrl ? 'Configured server' : 'Current server',
  }];
  if (primary !== LOCAL_SERVER) {
    servers.push({ url: LOCAL_SERVER, description: 'Local development' });
  }
  return servers;
}

export function requestOrigin(req) {
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}`;
}

export function setupSwagger(app) {
  const document = loadYaml(fs.readFileSync(specPath, 'utf8'));
  const options = { explorer: true };

  app.use('/api-docs', swaggerUi.serve, (req, res, next) => {
    const spec = {
      ...document,
      servers: swaggerServers({ requestOrigin: requestOrigin(req) }),
    };
    return swaggerUi.setup(spec, options)(req, res, next);
  });
}
