import path from 'node:path';
import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { bootstrapAdmin } from './services/bootstrap.service.js';
import { logger } from './utils/logger.js';

const app = createApp();
let server;

export async function startServer() {
  await connectDatabase();
  await bootstrapAdmin();
  if (server) {
    return server;
  }

  server = await new Promise((resolve, reject) => {
    const instance = app.listen(env.PORT, () => resolve(instance));
    instance.on('error', reject);
  });
  logger.info({ port: env.PORT }, 'CRM sales API listening');
  return server;
}

export async function stopServer(signal = 'shutdown') {
  logger.info({ signal }, 'Shutting down');
  if (server) {
    const current = server;
    server = undefined;
    await new Promise((resolve, reject) => {
      current.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await disconnectDatabase();
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

if (isDirectRun()) {
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Unhandled rejection');
    process.exit(1);
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception');
    process.exit(1);
  });

  const exitAfterStop = (signal) => {
    stopServer(signal)
      .then(() => process.exit(0))
      .catch((error) => {
        logger.error({ err: error }, 'Shutdown failed');
        process.exit(1);
      });
  };

  process.on('SIGINT', () => exitAfterStop('SIGINT'));
  process.on('SIGTERM', () => exitAfterStop('SIGTERM'));

  try {
    await startServer();
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start server');
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}
