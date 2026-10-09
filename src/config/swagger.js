import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import swaggerUi from 'swagger-ui-express';
import { load as loadYaml } from 'js-yaml';

const specPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/openapi.yaml');

export function setupSwagger(app) {
  const document = loadYaml(fs.readFileSync(specPath, 'utf8'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(document, { explorer: true }));
}
