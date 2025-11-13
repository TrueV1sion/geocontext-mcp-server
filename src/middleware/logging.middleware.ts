import { randomUUID } from 'crypto';
import logger from '../services/logger.service.js';

export interface RequestContext {
  correlationId: string;
  toolName: string;
  startTime: number;
  userId?: string;
  metadata?: Record<string, any>;
}

/**
 * Create a correlation ID for request tracking
 */
export function generateCorrelationId(): string {
  return randomUUID();
}

/**
 * Log incoming request with correlation ID
 */
export function logRequest(toolName: string, args: any, correlationId?: string): RequestContext {
  const ctx: RequestContext = {
    correlationId: correlationId || generateCorrelationId(),
    toolName,
    startTime: Date.now(),
  };

  logger.info(`[${ctx.correlationId}] Request received: ${toolName}`, {
    correlationId: ctx.correlationId,
    tool: toolName,
    args: sanitizeArgs(args),
  });

  return ctx;
}

/**
 * Log successful response
 */
export function logResponse(ctx: RequestContext, result: any): void {
  const duration = Date.now() - ctx.startTime;

  logger.info(`[${ctx.correlationId}] Request completed: ${ctx.toolName}`, {
    correlationId: ctx.correlationId,
    tool: ctx.toolName,
    duration,
    resultSize: JSON.stringify(result).length,
  });
}

/**
 * Log error response
 */
export function logError(ctx: RequestContext, error: Error): void {
  const duration = Date.now() - ctx.startTime;

  logger.error(`[${ctx.correlationId}] Request failed: ${ctx.toolName}`, {
    correlationId: ctx.correlationId,
    tool: ctx.toolName,
    duration,
    error: error.message,
    stack: error.stack,
  });
}

/**
 * Sanitize sensitive data from args before logging
 */
function sanitizeArgs(args: any): any {
  if (!args || typeof args !== 'object') return args;

  const sanitized = { ...args };

  // Remove any potential API keys or sensitive data
  const sensitiveKeys = ['apiKey', 'token', 'password', 'secret'];
  sensitiveKeys.forEach(key => {
    if (key in sanitized) {
      sanitized[key] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Middleware wrapper for logging
 */
export function withLogging<T extends (...args: any[]) => Promise<any>>(
  toolName: string,
  handler: T
): T {
  return (async (...args: any[]) => {
    const ctx = logRequest(toolName, args[0]);

    try {
      const result = await handler(...args);
      logResponse(ctx, result);
      return result;
    } catch (error) {
      logError(ctx, error as Error);
      throw error;
    }
  }) as T;
}
