import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import logger from '../services/logger.service.js';
import { AxiosError } from 'axios';

export interface ErrorContext {
  toolName: string;
  correlationId?: string;
  originalError: Error;
}

/**
 * Map common errors to appropriate MCP error codes
 */
export function mapErrorToMcpError(error: Error, context: ErrorContext): McpError {
  // Already an MCP error
  if (error instanceof McpError) {
    return error;
  }

  // Axios HTTP errors
  if (error instanceof AxiosError) {
    return handleAxiosError(error, context);
  }

  // Validation errors (from Zod)
  if (error.name === 'ZodError') {
    return new McpError(
      ErrorCode.InvalidParams,
      `Validation error in ${context.toolName}: ${error.message}`
    );
  }

  // Timeout errors
  if (error.message.includes('timeout') || error.name === 'TimeoutError') {
    return new McpError(
      ErrorCode.InternalError,
      `Request timeout in ${context.toolName}: Operation took too long to complete`
    );
  }

  // Rate limiting errors
  if (error.message.includes('rate limit') || error.message.includes('429')) {
    return new McpError(
      ErrorCode.InternalError,
      `Rate limit exceeded for ${context.toolName}. Please try again later.`
    );
  }

  // Default to internal error
  return new McpError(
    ErrorCode.InternalError,
    `Error in ${context.toolName}: ${error.message}`
  );
}

/**
 * Handle Axios-specific errors
 */
function handleAxiosError(error: AxiosError, context: ErrorContext): McpError {
  if (!error.response) {
    return new McpError(
      ErrorCode.InternalError,
      `Network error in ${context.toolName}: Unable to reach external service`
    );
  }

  const status = error.response.status;

  switch (status) {
    case 400:
      return new McpError(
        ErrorCode.InvalidParams,
        `Invalid request to external service in ${context.toolName}: ${error.message}`
      );
    case 401:
    case 403:
      return new McpError(
        ErrorCode.InternalError,
        `Authentication error in ${context.toolName}: Check API credentials`
      );
    case 404:
      return new McpError(
        ErrorCode.InvalidParams,
        `Resource not found in ${context.toolName}: ${error.message}`
      );
    case 429:
      return new McpError(
        ErrorCode.InternalError,
        `Rate limit exceeded in ${context.toolName}: Please try again later`
      );
    case 500:
    case 502:
    case 503:
    case 504:
      return new McpError(
        ErrorCode.InternalError,
        `External service error in ${context.toolName}: Service temporarily unavailable`
      );
    default:
      return new McpError(
        ErrorCode.InternalError,
        `HTTP ${status} error in ${context.toolName}: ${error.message}`
      );
  }
}

/**
 * Middleware wrapper for error handling
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<any>>(
  toolName: string,
  handler: T
): T {
  return (async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      const context: ErrorContext = {
        toolName,
        originalError: error as Error,
      };

      const mcpError = mapErrorToMcpError(error as Error, context);

      logger.error(`Error in ${toolName}:`, {
        tool: toolName,
        errorCode: mcpError.code,
        errorMessage: mcpError.message,
        originalError: (error as Error).message,
        stack: (error as Error).stack,
      });

      throw mcpError;
    }
  }) as T;
}
