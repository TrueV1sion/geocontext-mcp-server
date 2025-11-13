import PQueue from 'p-queue';
import logger from '../logger.service.js';
import config from '../../config/config.service.js';
import routingService from '../routing/routing.service.js';
import osmService from '../enrichment/openstreetmap.service.js';
import spatialIndex from '../spatial/spatial-index.service.js';
import {
  BatchRouteRequest,
  BatchRouteResponse,
  BatchRouteResult,
  BatchEnrichRequest,
  BatchEnrichResponse,
  BatchEnrichResult,
  BatchContextRequest,
  BatchContextResponse,
  BatchContextResult,
} from '../../types/batch.types.js';

class BatchService {
  private static instance: BatchService;

  private constructor() {
    logger.info('Batch service initialized');
  }

  public static getInstance(): BatchService {
    if (!BatchService.instance) {
      BatchService.instance = new BatchService();
    }
    return BatchService.instance;
  }

  /**
   * Process batch route generation requests
   */
  public async generateRouteBatch(request: BatchRouteRequest): Promise<BatchRouteResponse> {
    const startTime = Date.now();
    const concurrency = request.options?.maxConcurrency || Math.min(config.get('maxConcurrentRequests') as number, 3);
    const failFast = request.options?.failFast || false;

    logger.info(`Processing batch route request with ${request.requests.length} routes`, {
      concurrency,
      failFast,
    });

    const queue = new PQueue({ concurrency });
    const results: BatchRouteResult[] = [];
    let shouldStop = false;

    const promises = request.requests.map((routeReq, index) =>
      queue.add(async (): Promise<BatchRouteResult> => {
        if (shouldStop) {
          return {
            index,
            success: false,
            error: 'Batch processing stopped due to previous error',
          };
        }

        try {
          const routeResponse = await routingService.generateRoute(routeReq);
          return {
            index,
            success: true,
            data: routeResponse,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Failed to generate route ${index}`, { error: errorMessage });

          if (failFast) {
            shouldStop = true;
          }

          return {
            index,
            success: false,
            error: errorMessage,
          };
        }
      })
    );

    const batchResults = (await Promise.all(promises)).filter(
      (r): r is BatchRouteResult => r !== undefined
    );
    results.push(...batchResults);

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const duration = Date.now() - startTime;

    logger.info(`Batch route generation completed`, {
      total: request.requests.length,
      successful,
      failed,
      duration,
    });

    return {
      totalRequests: request.requests.length,
      successful,
      failed,
      results,
      duration,
    };
  }

  /**
   * Process batch location enrichment requests
   */
  public async enrichLocationBatch(request: BatchEnrichRequest): Promise<BatchEnrichResponse> {
    const startTime = Date.now();
    const concurrency = request.options?.maxConcurrency || Math.min(config.get('maxConcurrentRequests') as number, 5);
    const failFast = request.options?.failFast || false;

    logger.info(`Processing batch enrichment request with ${request.locations.length} locations`, {
      concurrency,
      failFast,
    });

    const queue = new PQueue({ concurrency });
    const results: BatchEnrichResult[] = [];
    let shouldStop = false;

    const promises = request.locations.map((req, index) =>
      queue.add(async (): Promise<BatchEnrichResult> => {
        if (shouldStop) {
          return {
            index,
            success: false,
            error: 'Batch processing stopped due to previous error',
          };
        }

        try {
          const pins = await osmService.fetchPOIsNearLocation(
            req.location,
            req.radius || 500
          );

          const addressInfo = await osmService.reverseGeocode(req.location);

          // Add pins to spatial index
          pins.forEach(pin => {
            if (!spatialIndex.getPinById(pin.id)) {
              spatialIndex.addPin(pin);
            }
          });

          return {
            index,
            success: true,
            data: {
              location: req.location,
              address: addressInfo,
              poisFound: pins.length,
              pois: pins.slice(0, 20),
            },
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Failed to enrich location ${index}`, { error: errorMessage });

          if (failFast) {
            shouldStop = true;
          }

          return {
            index,
            success: false,
            error: errorMessage,
          };
        }
      })
    );

    const batchResults = (await Promise.all(promises)).filter(
      (r): r is BatchEnrichResult => r !== undefined
    );
    results.push(...batchResults);

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const duration = Date.now() - startTime;

    logger.info(`Batch enrichment completed`, {
      total: request.locations.length,
      successful,
      failed,
      duration,
    });

    return {
      totalRequests: request.locations.length,
      successful,
      failed,
      results,
      duration,
    };
  }

  /**
   * Process batch nearby context requests
   */
  public async getNearbyContextBatch(request: BatchContextRequest): Promise<BatchContextResponse> {
    const startTime = Date.now();
    const concurrency = request.options?.maxConcurrency || Math.min(config.get('maxConcurrentRequests') as number, 5);
    const failFast = request.options?.failFast || false;

    logger.info(`Processing batch context request with ${request.queries.length} queries`, {
      concurrency,
      failFast,
    });

    const queue = new PQueue({ concurrency });
    const results: BatchContextResult[] = [];
    let shouldStop = false;

    const promises = request.queries.map((query, index) =>
      queue.add(async (): Promise<BatchContextResult> => {
        if (shouldStop) {
          return {
            index,
            success: false,
            error: 'Batch processing stopped due to previous error',
          };
        }

        try {
          // Query spatial index first
          let pins = spatialIndex.queryByRadius(query.location, query.radius || 1000);

          // Filter by types if specified
          if (query.types && query.types.length > 0) {
            pins = pins.filter(pin => query.types!.includes(pin.type));
          }

          // If not enough pins, fetch from OSM
          if (pins.length < (query.maxResults || 50)) {
            const osmPins = await osmService.fetchPOIsNearLocation(
              query.location,
              query.radius || 1000,
              query.types
            );

            // Add new pins to spatial index
            osmPins.forEach(pin => {
              if (!spatialIndex.getPinById(pin.id)) {
                spatialIndex.addPin(pin);
                pins.push(pin);
              }
            });
          }

          // Limit results
          pins = pins.slice(0, query.maxResults || 50);

          return {
            index,
            success: true,
            data: {
              location: query.location,
              radius: query.radius || 1000,
              totalPins: pins.length,
              pins,
            },
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Failed to get context for query ${index}`, { error: errorMessage });

          if (failFast) {
            shouldStop = true;
          }

          return {
            index,
            success: false,
            error: errorMessage,
          };
        }
      })
    );

    const batchResults = (await Promise.all(promises)).filter(
      (r): r is BatchContextResult => r !== undefined
    );
    results.push(...batchResults);

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const duration = Date.now() - startTime;

    logger.info(`Batch context query completed`, {
      total: request.queries.length,
      successful,
      failed,
      duration,
    });

    return {
      totalRequests: request.queries.length,
      successful,
      failed,
      results,
      duration,
    };
  }
}

export default BatchService.getInstance();
