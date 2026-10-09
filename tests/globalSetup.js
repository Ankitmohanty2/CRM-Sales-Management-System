import fs from 'node:fs';
import path from 'node:path';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const uriFile = path.resolve('tests/.mongo-uri');

export async function setup() {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
  });
  fs.writeFileSync(uriFile, replSet.getUri());
  globalThis.__CRM_MONGO__ = replSet;
}

export async function teardown() {
  if (globalThis.__CRM_MONGO__) {
    await globalThis.__CRM_MONGO__.stop();
  }
  fs.rmSync(uriFile, { force: true });
}
