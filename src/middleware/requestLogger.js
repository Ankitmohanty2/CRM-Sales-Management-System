import pinoHttp from 'pino-http';
import { logger } from '../utils/logger.js';

function requestSummary(req, res, responseTime) {
  return {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    responseTime,
  };
}

export const requestLogger = pinoHttp({
  logger,
  quietReqLogger: true,
  quietResLogger: true,
  autoLogging: {
    ignore: (req) => req.url === '/api/v1/health' || req.url === '/favicon.ico',
  },
  customSuccessMessage(req, res, responseTime) {
    return `${req.method} ${req.url} ${res.statusCode} ${responseTime}ms`;
  },
  customErrorMessage(req, res, error) {
    return `${req.method} ${req.url} ${res.statusCode} ${error.message}`;
  },
  customSuccessObject(req, res, value) {
    return requestSummary(req, res, value.responseTime);
  },
  customErrorObject(req, res, _error, value) {
    return requestSummary(req, res, value.responseTime);
  },
});
