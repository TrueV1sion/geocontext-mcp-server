import PQueue from 'p-queue';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import logger from '../services/logger.service.js';
import config from '../config/config.service.js';

interface RateLimiterConfig {
  concurrency: number;
  intervalCap: number;
  interval: number;
  timeout?: number;
}

class RateLimiterService {
  private static instance: RateLimiterService;
  private queues: Map<string, PQueue>;
  private requestCounts: Map<string, { count: number; resetTime: number }>;

  private constructor() {
    this.queues = new Map();
    this.requestCounts = new Map();
  }

  public static getInstance(): RateLimiterService {
    if (!RateLimiterService.instance) {
      RateLimiterService.instance = new RateLimiterService();
    }
    return RateLimiterService.instance;
  }

  /**
   * Get or create a queue for a specific tool
   */
  private getQueue(toolName: string): PQueue {
    if (!this.queues.has(toolName)) {
      const queueConfig = this.getQueueConfig(toolName);
      const queue = new PQueue({
        concurrency: queueConfig.concurrency,
        intervalCap: queueConfig.intervalCap,
        interval: queueConfig.interval,
        timeout: queueConfig.timeout,
      });

      this.queues.set(toolName, queue);
      logger.debug(`Created rate limiter queue for ${toolName}`, queueConfig);
    }

    return this.queues.get(toolName)!;
  }

  /**
   * Get queue configuration for specific tool
   */
  private getQueueConfig(toolName: string): RateLimiterConfig {
    const maxConcurrent = config.get('maxConcurrentRequests') as number || 10;

    // Tool-specific configurations
    const configs: Record<string, RateLimiterConfig> = {
      generate_route: {
        concurrency: Math.min(maxConcurrent, 3),
        intervalCap: 10,
        interval: 60000, // 10 requests per minute
        timeout: 60000, // 60 second timeout
      },
      get_nearby_context: {
        concurrency: Math.min(maxConcurrent, 5),
        intervalCap: 20,
        interval: 60000, // 20 requests per minute
        timeout: 30000, // 30 second timeout
      },
      enrich_location: {
        concurrency: Math.min(maxConcurrent, 5),
        intervalCap: 20,
        interval: 60000,
        timeout: 30000,
      },
      create_geopin: {
        concurrency: Math.min(maxConcurrent, 10),
        intervalCap: 50,
        interval: 60000,
        timeout: 10000,
      },
    };

    return configs[toolName] || {
      concurrency: maxConcurrent,
      intervalCap: 30,
      interval: 60000,
      timeout: 30000,
    };
  }

  /**
   * Check if request should be rate limited
   */
  private checkRateLimit(toolName: string, userId?: string): void {
    const key = userId ? `${toolName}:${userId}` : toolName;
    const now = Date.now();
    const limits = this.requestCounts.get(key);

    if (!limits || now > limits.resetTime) {
      // Reset or create new limit
      this.requestCounts.set(key, {
        count: 1,
        resetTime: now + 60000, // Reset after 1 minute
      });
      return;
    }

    const config = this.getQueueConfig(toolName);

    if (limits.count >= config.intervalCap) {
      const waitTime = Math.ceil((limits.resetTime - now) / 1000);
      throw new McpError(
        ErrorCode.InternalError,
        `Rate limit exceeded for ${toolName}. Try again in ${waitTime} seconds.`
      );
    }

    limits.count++;
  }

  /**
   * Execute function with rate limiting
   */
  public async execute<T>(
    toolName: string,
    fn: () => Promise<T>,
    userId?: string
  ): Promise<T> {
    this.checkRateLimit(toolName, userId);

    const queue = this.getQueue(toolName);
    const queueSize = queue.size;

    if (queueSize > 50) {
      logger.warn(`Queue size for ${toolName} is ${queueSize}`);
    }

    try {
      const result = await queue.add(fn);
      if (result === undefined) {
        throw new Error('Queue returned undefined result');
      }
      return result as T;
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        throw new McpError(
          ErrorCode.InternalError,
          `Request timeout: ${toolName} took too long to process`
        );
      }
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  public getStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    this.queues.forEach((queue, toolName) => {
      stats[toolName] = {
        size: queue.size,
        pending: queue.pending,
      };
    });

    return stats;
  }
}

export const rateLimiter = RateLimiterService.getInstance();

/**
 * Middleware wrapper for rate limiting
 */
export function withRateLimiting<T extends (...args: any[]) => Promise<any>>(
  toolName: string,
  handler: T
): T {
  return (async (...args: any[]) => {
    return rateLimiter.execute(
      toolName,
      () => handler(...args)
    );
  }) as T;
}
