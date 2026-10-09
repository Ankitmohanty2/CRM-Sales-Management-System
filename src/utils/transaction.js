import mongoose from 'mongoose';
import { ApiError } from './ApiError.js';

function isTransactionUnsupported(error) {
  const message = String(error?.message || '');
  return (
    error?.code === 20
    || error?.codeName === 'IllegalOperation'
    || message.includes('Transaction numbers are only allowed')
    || message.includes('replica set')
  );
}

export async function withTransaction(work) {
  let session;
  try {
    session = await mongoose.startSession();
  } catch (error) {
    if (isTransactionUnsupported(error)) {
      throw new ApiError(503, 'Transactions require a MongoDB replica set or sharded cluster');
    }
    throw error;
  }

  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (isTransactionUnsupported(error)) {
      throw new ApiError(503, 'Transactions require a MongoDB replica set or sharded cluster');
    }
    throw error;
  } finally {
    await session.endSession();
  }
}
