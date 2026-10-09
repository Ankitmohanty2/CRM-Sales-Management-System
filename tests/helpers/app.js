import mongoose from 'mongoose';

let appPromise;

export async function getTestApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const { connectDatabase } = await import('../../src/config/database.js');
      await connectDatabase();
      const { createApp } = await import('../../src/app.js');
      return createApp();
    })();
  }
  return appPromise;
}

export async function resetDatabase() {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}
