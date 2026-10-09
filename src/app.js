import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { corsOrigins, env } from './config/env.js';
import { setupSwagger } from './config/swagger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import { requestLogger } from './middleware/requestLogger.js';
import routes from './routes/index.js';
import { ApiError } from './utils/ApiError.js';

export function createApp() {
  const app = express();
  const allowedOrigins = corsOrigins();

  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.disable('x-powered-by');
  const defaultHelmet = helmet();
  const docsHelmet = helmet({ contentSecurityPolicy: false });
  app.use((req, res, next) => {
    if (req.path === '/api-docs' || req.path.startsWith('/api-docs/')) {
      docsHelmet(req, res, next);
      return;
    }
    defaultHelmet(req, res, next);
  });
  app.use(requestLogger);
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new ApiError(403, 'Origin not allowed'));
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/api', (req, res, next) => {
    if (req.path === '/v1/health') {
      next();
      return;
    }
    apiRateLimiter(req, res, next);
  });

  setupSwagger(app);
  app.get('/', (_req, res) => {
    res.redirect('/api-docs');
  });
  app.get('/favicon.ico', (_req, res) => {
    res.status(204).end();
  });
  app.use('/api/v1', routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
