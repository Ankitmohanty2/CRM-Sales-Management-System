import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

function validationErrors(error) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

export function errorHandler(err, req, res, _next) {
  let error = err;

  if (error instanceof ZodError) {
    error = new ApiError(400, 'Validation failed', validationErrors(error));
  } else if (error instanceof SyntaxError && error.status === 400) {
    error = new ApiError(400, 'Malformed JSON');
  } else if (error?.type === 'entity.too.large') {
    error = new ApiError(413, 'Request body is too large');
  } else if (error instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(error.errors).map((item) => ({
      path: item.path,
      message: item.message,
    }));
    error = new ApiError(400, 'Validation failed', errors);
  } else if (error instanceof mongoose.Error.CastError) {
    error = new ApiError(400, 'Invalid identifier');
  } else if (error?.code === 11000) {
    const field = Object.keys(error.keyPattern || error.keyValue || {})[0] || 'value';
    error = new ApiError(409, `Duplicate value for ${field}`);
  }

  const statusCode = error instanceof ApiError ? error.statusCode : 500;
  const message = error instanceof ApiError ? error.message : 'Internal server error';
  const errors = error instanceof ApiError ? error.errors : [];

  if (statusCode >= 500) {
    logger.error({ err, path: req.originalUrl, method: req.method }, 'request failed');
  }

  const body = {
    success: false,
    message: env.NODE_ENV === 'production' && statusCode >= 500 ? 'Internal server error' : message,
    errors,
  };

  return res.status(statusCode).json(body);
}
