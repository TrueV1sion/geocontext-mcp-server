// Middleware index - export all middleware
export { validateToolInput, withValidation } from './validation.middleware.js';
export {
  withLogging,
  logRequest,
  logResponse,
  logError,
  generateCorrelationId,
} from './logging.middleware.js';
export { withErrorHandler, mapErrorToMcpError } from './error-handler.middleware.js';
export { withRateLimiting, rateLimiter } from './rate-limiter.middleware.js';
export { withMetrics, metricsService } from './metrics.middleware.js';

import { withValidation } from './validation.middleware.js';
import { withLogging } from './logging.middleware.js';
import { withErrorHandler } from './error-handler.middleware.js';
import { withRateLimiting } from './rate-limiter.middleware.js';
import { withMetrics } from './metrics.middleware.js';

/**
 * Compose multiple middleware functions
 */
export function composeMiddleware<T extends (...args: any[]) => Promise<any>>(
  toolName: string,
  handler: T
): T {
  // Apply middleware in order: metrics -> rate limiting -> validation -> logging -> error handling
  let wrapped = handler;

  wrapped = withErrorHandler(toolName, wrapped);
  wrapped = withLogging(toolName, wrapped);
  wrapped = withValidation(toolName, wrapped);
  wrapped = withRateLimiting(toolName, wrapped);
  wrapped = withMetrics(toolName, wrapped);

  return wrapped;
}
