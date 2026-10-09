import { databaseHealth } from '../config/database.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';

export const health = asyncHandler(async (_req, res) => {
  const database = databaseHealth();
  const healthy = database.status === 'connected';
  if (!healthy) {
    return res.status(503).json({
      success: false,
      message: 'Service is degraded',
      errors: [],
      data: { status: 'degraded', database: database.status },
    });
  }
  return sendSuccess(res, {
    message: 'Service is healthy',
    data: { status: 'ok', database: database.status },
  });
});
