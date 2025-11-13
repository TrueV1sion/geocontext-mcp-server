import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import * as api from '@opentelemetry/api';
import config from '../config/config.service.js';
import logger from '../services/logger.service.js';

class TelemetryService {
  private static instance: TelemetryService;
  private sdk: NodeSDK | null = null;
  private tracer: api.Tracer | null = null;
  private meter: api.Meter | null = null;
  private isInitialized = false;

  private constructor() {
    // Initialization happens in init()
  }

  public static getInstance(): TelemetryService {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  /**
   * Initialize OpenTelemetry SDK
   */
  public async init(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Telemetry already initialized');
      return;
    }

    const telemetryConfig = config.getConfig();

    // Only initialize if telemetry is enabled
    if (!telemetryConfig.enableTelemetry) {
      logger.info('Telemetry disabled');
      return;
    }

    try {
      this.sdk = new NodeSDK({
        resource: new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]: 'geocontext-mcp-server',
          [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
        }),
        instrumentations: [
          getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-fs': {
              enabled: false, // Disable fs instrumentation for performance
            },
          }),
        ],
      });

      await this.sdk.start();

      // Initialize tracer and meter
      this.tracer = api.trace.getTracer('geocontext-mcp-server', '1.0.0');
      this.meter = api.metrics.getMeter('geocontext-mcp-server', '1.0.0');

      this.isInitialized = true;
      logger.info('OpenTelemetry initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize OpenTelemetry', error);
      // Don't throw - allow app to continue without telemetry
    }
  }

  /**
   * Shutdown OpenTelemetry SDK
   */
  public async shutdown(): Promise<void> {
    if (this.sdk && this.isInitialized) {
      try {
        await this.sdk.shutdown();
        this.isInitialized = false;
        logger.info('OpenTelemetry shutdown successfully');
      } catch (error) {
        logger.error('Error shutting down OpenTelemetry', error);
      }
    }
  }

  /**
   * Create a new span for tracing
   */
  public startSpan(name: string, attributes?: api.Attributes): api.Span {
    if (!this.tracer) {
      return api.trace.getTracer('noop').startSpan(name);
    }

    return this.tracer.startSpan(name, {
      attributes,
    });
  }

  /**
   * Create a child span within a parent context
   */
  public startChildSpan(
    name: string,
    parentSpan: api.Span,
    attributes?: api.Attributes
  ): api.Span {
    if (!this.tracer) {
      return api.trace.getTracer('noop').startSpan(name);
    }

    const ctx = api.trace.setSpan(api.context.active(), parentSpan);
    return this.tracer.startSpan(
      name,
      {
        attributes,
      },
      ctx
    );
  }

  /**
   * Record an exception in a span
   */
  public recordException(span: api.Span, error: Error): void {
    span.recordException(error);
    span.setStatus({
      code: api.SpanStatusCode.ERROR,
      message: error.message,
    });
  }

  /**
   * Execute a function within a traced span
   */
  public async executeInSpan<T>(
    name: string,
    fn: (span: api.Span) => Promise<T>,
    attributes?: api.Attributes
  ): Promise<T> {
    const span = this.startSpan(name, attributes);

    try {
      const result = await fn(span);
      span.setStatus({ code: api.SpanStatusCode.OK });
      return result;
    } catch (error) {
      this.recordException(span, error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Create a counter metric
   */
  public createCounter(name: string, description?: string): api.Counter {
    if (!this.meter) {
      return api.metrics.getMeter('noop').createCounter(name);
    }

    return this.meter.createCounter(name, {
      description: description || name,
    });
  }

  /**
   * Create a histogram metric
   */
  public createHistogram(name: string, description?: string): api.Histogram {
    if (!this.meter) {
      return api.metrics.getMeter('noop').createHistogram(name);
    }

    return this.meter.createHistogram(name, {
      description: description || name,
    });
  }

  /**
   * Create an observable gauge metric
   */
  public createObservableGauge(
    name: string,
    callback: (observableResult: api.ObservableResult) => void,
    description?: string
  ): void {
    if (!this.meter) {
      return;
    }

    this.meter.createObservableGauge(name, {
      description: description || name,
    }, callback);
  }

  /**
   * Check if telemetry is enabled
   */
  public isEnabled(): boolean {
    return this.isInitialized;
  }
}

export const telemetry = TelemetryService.getInstance();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await telemetry.shutdown();
});

process.on('SIGINT', async () => {
  await telemetry.shutdown();
});
