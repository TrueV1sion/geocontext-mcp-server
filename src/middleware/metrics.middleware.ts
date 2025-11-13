import logger from '../services/logger.service.js';

export interface ToolMetrics {
  toolName: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  lastRequestTime: number;
}

class MetricsService {
  private static instance: MetricsService;
  private metrics: Map<string, ToolMetrics>;

  private constructor() {
    this.metrics = new Map();
  }

  public static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  /**
   * Initialize metrics for a tool if not exists
   */
  private initializeMetrics(toolName: string): ToolMetrics {
    if (!this.metrics.has(toolName)) {
      this.metrics.set(toolName, {
        toolName,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        lastRequestTime: 0,
      });
    }
    return this.metrics.get(toolName)!;
  }

  /**
   * Record a request start
   */
  public recordRequestStart(toolName: string): number {
    const metrics = this.initializeMetrics(toolName);
    metrics.totalRequests++;
    metrics.lastRequestTime = Date.now();
    return metrics.lastRequestTime;
  }

  /**
   * Record a successful request completion
   */
  public recordSuccess(toolName: string, startTime: number): void {
    const metrics = this.initializeMetrics(toolName);
    const duration = Date.now() - startTime;

    metrics.successfulRequests++;
    metrics.totalDuration += duration;
    metrics.avgDuration = metrics.totalDuration / (metrics.successfulRequests + metrics.failedRequests);
    metrics.minDuration = Math.min(metrics.minDuration, duration);
    metrics.maxDuration = Math.max(metrics.maxDuration, duration);

    logger.debug(`Metrics recorded for ${toolName}`, {
      duration,
      success: true,
    });
  }

  /**
   * Record a failed request
   */
  public recordFailure(toolName: string, startTime: number, error?: Error): void {
    const metrics = this.initializeMetrics(toolName);
    const duration = Date.now() - startTime;

    metrics.failedRequests++;
    metrics.totalDuration += duration;
    metrics.avgDuration = metrics.totalDuration / (metrics.successfulRequests + metrics.failedRequests);

    logger.debug(`Metrics recorded for ${toolName}`, {
      duration,
      success: false,
      error: error?.message,
    });
  }

  /**
   * Get metrics for a specific tool
   */
  public getMetrics(toolName: string): ToolMetrics | undefined {
    return this.metrics.get(toolName);
  }

  /**
   * Get all metrics
   */
  public getAllMetrics(): Record<string, ToolMetrics> {
    const result: Record<string, ToolMetrics> = {};
    this.metrics.forEach((metrics, toolName) => {
      result[toolName] = { ...metrics };
    });
    return result;
  }

  /**
   * Get summary statistics
   */
  public getSummary(): {
    totalRequests: number;
    totalSuccessful: number;
    totalFailed: number;
    successRate: number;
    tools: string[];
  } {
    let totalRequests = 0;
    let totalSuccessful = 0;
    let totalFailed = 0;
    const tools: string[] = [];

    this.metrics.forEach((metrics, toolName) => {
      totalRequests += metrics.totalRequests;
      totalSuccessful += metrics.successfulRequests;
      totalFailed += metrics.failedRequests;
      tools.push(toolName);
    });

    return {
      totalRequests,
      totalSuccessful,
      totalFailed,
      successRate: totalRequests > 0 ? (totalSuccessful / totalRequests) * 100 : 0,
      tools,
    };
  }

  /**
   * Reset all metrics
   */
  public reset(): void {
    this.metrics.clear();
    logger.info('Metrics reset');
  }

  /**
   * Reset metrics for a specific tool
   */
  public resetTool(toolName: string): void {
    this.metrics.delete(toolName);
    logger.info(`Metrics reset for tool: ${toolName}`);
  }
}

export const metricsService = MetricsService.getInstance();

/**
 * Middleware wrapper for metrics collection
 */
export function withMetrics<T extends (...args: any[]) => Promise<any>>(
  toolName: string,
  handler: T
): T {
  return (async (...args: any[]) => {
    const startTime = metricsService.recordRequestStart(toolName);

    try {
      const result = await handler(...args);
      metricsService.recordSuccess(toolName, startTime);
      return result;
    } catch (error) {
      metricsService.recordFailure(toolName, startTime, error as Error);
      throw error;
    }
  }) as T;
}
