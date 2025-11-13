import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import services
import config from './config/config.service.js';
import logger from './services/logger.service.js';
import routingService from './services/routing/routing.service.js';
import osmService from './services/enrichment/openstreetmap.service.js';
import spatialIndex from './services/spatial/spatial-index.service.js';
import cache from './services/cache/cache.service.js';
import batchService from './services/batch/batch.service.js';
import webhookService from './services/webhooks/webhook.service.js';
import { telemetry } from './telemetry/telemetry.service.js';
import { composeMiddleware, metricsService, rateLimiter } from './middleware/index.js';

// Import types
import { GeoPin, RouteRequest } from './types/index.js';
import { generateId } from './utils/helpers.js';
import { exportRouteAsGeoJSON } from './exporters/geojson.exporter.js';

class GeoContextServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'geocontext-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.setupHandlers();
    this.initializeServices();
  }
  private async initializeServices(): Promise<void> {
    logger.info('Initializing GeoContext MCP Server');

    // Initialize telemetry if enabled
    if (config.isFeatureEnabled('telemetry')) {
      await telemetry.init();
    }

    // Log configuration status
    const configStatus = {
      hasRouting: config.hasRoutingService(),
      cacheEnabled: config.isFeatureEnabled('cache'),
      offlineMode: config.isFeatureEnabled('offlineMode'),
      telemetryEnabled: config.isFeatureEnabled('telemetry'),
    };

    logger.info('Configuration status', configStatus);

    // Initialize spatial index with any pre-existing pins
    // This could load from a database in production
    logger.info('Spatial index initialized');
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'generate_route',
          description: 'Generate a navigation route between points and enrich with contextual data',
          inputSchema: {
            type: 'object',
            properties: {
              start: {
                type: 'object',
                properties: {
                  lat: { type: 'number' },
                  lng: { type: 'number' },
                },
                required: ['lat', 'lng'],
              },
              end: {
                type: 'object',
                properties: {
                  lat: { type: 'number' },
                  lng: { type: 'number' },
                },
                required: ['lat', 'lng'],
              },
              waypoints: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    lat: { type: 'number' },
                    lng: { type: 'number' },
                  },
                },
              },
              profile: {
                type: 'string',
                enum: ['driving', 'walking', 'cycling', 'wheelchair'],
                default: 'driving',
              },
              interests: {
                type: 'array',
                items: { type: 'string' },
                description: 'User interests for POI filtering (e.g., "history", "architecture", "nature")',
              },
              bufferRadius: {
                type: 'number',
                default: 500,
                description: 'Radius in meters around route to search for POIs',
              },
            },
            required: ['start', 'end'],
          },
        },
        {
          name: 'get_nearby_context',
          description: 'Get contextual information for a specific location',
          inputSchema: {
            type: 'object',
            properties: {
              location: {
                type: 'object',
                properties: {
                  lat: { type: 'number' },
                  lng: { type: 'number' },
                },
                required: ['lat', 'lng'],
              },
              radius: {
                type: 'number',
                default: 1000,
                description: 'Search radius in meters',
              },
              types: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['poi', 'historical', 'landmark', 'event', 'cultural', 'natural'],
                },
              },
              maxResults: {
                type: 'number',
                default: 50,
              },
            },
            required: ['location'],
          },
        },
        {
          name: 'create_geopin',
          description: 'Create a custom geo-pin with contextual information',
          inputSchema: {
            type: 'object',
            properties: {
              location: {
                type: 'object',
                properties: {
                  lat: { type: 'number' },
                  lng: { type: 'number' },
                },
                required: ['lat', 'lng'],
              },
              radius: { type: 'number', default: 100 },
              type: {
                type: 'string',
                enum: ['poi', 'historical', 'landmark', 'event', 'cultural', 'natural'],
              },
              data: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  category: { type: 'array', items: { type: 'string' } },
                },
                required: ['name', 'description'],
              },
            },
            required: ['location', 'type', 'data'],
          },
        },
        {
          name: 'enrich_location',
          description: 'Enrich a location with data from OpenStreetMap',
          inputSchema: {
            type: 'object',
            properties: {
              location: {
                type: 'object',
                properties: {
                  lat: { type: 'number' },
                  lng: { type: 'number' },
                },
                required: ['lat', 'lng'],
              },
              radius: {
                type: 'number',
                default: 500,
                description: 'Search radius in meters',
              },
            },
            required: ['location'],
          },
        },
        {
          name: 'batch_generate_routes',
          description: 'Generate multiple routes in a single batch request',
          inputSchema: {
            type: 'object',
            properties: {
              requests: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    start: { type: 'object', properties: { lat: { type: 'number' }, lng: { type: 'number' } } },
                    end: { type: 'object', properties: { lat: { type: 'number' }, lng: { type: 'number' } } },
                    profile: { type: 'string', enum: ['driving', 'walking', 'cycling', 'wheelchair'] },
                  },
                },
              },
              options: {
                type: 'object',
                properties: {
                  failFast: { type: 'boolean', default: false },
                  maxConcurrency: { type: 'number' },
                },
              },
            },
            required: ['requests'],
          },
        },
        {
          name: 'batch_enrich_locations',
          description: 'Enrich multiple locations in a single batch request',
          inputSchema: {
            type: 'object',
            properties: {
              locations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    location: { type: 'object', properties: { lat: { type: 'number' }, lng: { type: 'number' } } },
                    radius: { type: 'number' },
                  },
                },
              },
              options: {
                type: 'object',
                properties: {
                  failFast: { type: 'boolean', default: false },
                  maxConcurrency: { type: 'number' },
                },
              },
            },
            required: ['locations'],
          },
        },
        {
          name: 'export_route_geojson',
          description: 'Export a route as GeoJSON FeatureCollection',
          inputSchema: {
            type: 'object',
            properties: {
              routeData: { type: 'object' },
              includeProperties: { type: 'boolean', default: true },
              simplified: { type: 'boolean', default: false },
            },
            required: ['routeData'],
          },
        },
        {
          name: 'get_metrics',
          description: 'Get server metrics and statistics',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }));
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      logger.info(`Tool called: ${request.params.name}`);
      
      try {
        switch (request.params.name) {
          case 'generate_route':
            return await composeMiddleware('generate_route', this.handleGenerateRoute.bind(this))(request.params.arguments);
          case 'get_nearby_context':
            return await composeMiddleware('get_nearby_context', this.handleGetNearbyContext.bind(this))(request.params.arguments);
          case 'create_geopin':
            return await composeMiddleware('create_geopin', this.handleCreateGeoPin.bind(this))(request.params.arguments);
          case 'enrich_location':
            return await composeMiddleware('enrich_location', this.handleEnrichLocation.bind(this))(request.params.arguments);
          case 'batch_generate_routes':
            return await composeMiddleware('batch_generate_routes', this.handleBatchGenerateRoutes.bind(this))(request.params.arguments);
          case 'batch_enrich_locations':
            return await composeMiddleware('batch_enrich_locations', this.handleBatchEnrichLocations.bind(this))(request.params.arguments);
          case 'export_route_geojson':
            return await this.handleExportRouteGeoJSON(request.params.arguments);
          case 'get_metrics':
            return await this.handleGetMetrics(request.params.arguments);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        logger.error(`Error handling tool ${request.params.name}`, error);
        throw error;
      }
    });

    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'geocontext://pins',
          name: 'Geo Pins',
          description: 'All available geo-pins in the system',
          mimeType: 'application/json',
        },
        {
          uri: 'geocontext://stats',
          name: 'System Statistics',
          description: 'Cache and spatial index statistics',
          mimeType: 'application/json',
        },
      ],
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;
      
      if (uri === 'geocontext://pins') {
        const pins = spatialIndex.getAllPins();
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                totalPins: pins.length,
                pins: pins.slice(0, 100), // Limit to 100 for performance
              }, null, 2),
            },
          ],
        };
      } else if (uri === 'geocontext://stats') {
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                cache: cache.getStats(),
                spatialIndex: spatialIndex.getStats(),
              }, null, 2),
            },
          ],
        };
      }
      
      throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
    });
  }
  private async handleGenerateRoute(args: any) {
    try {
      const routeRequest: RouteRequest = {
        start: args.start,
        end: args.end,
        waypoints: args.waypoints,
        profile: args.profile || 'driving',
        interests: args.interests,
        bufferRadius: args.bufferRadius,
      };

      const routeResponse = await routingService.generateRoute(routeRequest);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(routeResponse, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to generate route: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleGetNearbyContext(args: any) {
    try {
      // Query spatial index first
      let pins = spatialIndex.queryByRadius(args.location, args.radius || 1000);
      
      // Filter by types if specified
      if (args.types && args.types.length > 0) {
        pins = pins.filter(pin => args.types.includes(pin.type));
      }
      
      // If not enough pins, fetch from OSM
      if (pins.length < (args.maxResults || 50)) {
        const osmPins = await osmService.fetchPOIsNearLocation(
          args.location,
          args.radius || 1000,
          args.types
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
      pins = pins.slice(0, args.maxResults || 50);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              location: args.location,
              radius: args.radius || 1000,
              totalPins: pins.length,
              pins,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get nearby context: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  private async handleCreateGeoPin(args: any) {
    try {
      const pin: GeoPin = {
        id: generateId('pin'),
        location: args.location,
        radius: args.radius || 100,
        type: args.type,
        data: {
          ...args.data,
          category: args.data.category || [],
        },
        metadata: {
          source: 'user_created',
          lastUpdated: new Date(),
          verificationStatus: 'unverified',
          languages: ['en'],
          tags: [],
        },
      };
      
      // Add to spatial index
      spatialIndex.addPin(pin);
      
      logger.info(`Created geo-pin: ${pin.id}`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              message: 'Geo-pin created successfully',
              pin,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to create geo-pin: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleEnrichLocation(args: any) {
    try {
      // Fetch POIs from OpenStreetMap
      const pins = await osmService.fetchPOIsNearLocation(
        args.location,
        args.radius || 500
      );
      
      // Also get reverse geocoding information
      const addressInfo = await osmService.reverseGeocode(args.location);
      
      // Add pins to spatial index
      pins.forEach(pin => {
        if (!spatialIndex.getPinById(pin.id)) {
          spatialIndex.addPin(pin);
        }
      });
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              location: args.location,
              address: addressInfo,
              poisFound: pins.length,
              pois: pins.slice(0, 20), // Return first 20 POIs
              message: `Location enriched with ${pins.length} points of interest`,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to enrich location: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleBatchGenerateRoutes(args: any) {
    try {
      const response = await batchService.generateRouteBatch(args);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to process batch routes: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleBatchEnrichLocations(args: any) {
    try {
      const response = await batchService.enrichLocationBatch(args);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to process batch enrichment: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleExportRouteGeoJSON(args: any) {
    try {
      const { routeData, includeProperties, simplified } = args;

      const geojson = exportRouteAsGeoJSON(routeData, {
        includeProperties,
        simplified,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(geojson, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to export route as GeoJSON: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleGetMetrics(_args: any) {
    try {
      const metrics = {
        tools: metricsService.getAllMetrics(),
        summary: metricsService.getSummary(),
        rateLimiter: rateLimiter.getStats(),
        cache: cache.getStats(),
        spatialIndex: spatialIndex.getStats(),
        webhooks: webhookService.getStats(),
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(metrics, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get metrics: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('GeoContext MCP server running on stdio');
  }
}

// Start the server
const server = new GeoContextServer();
server.run().catch(error => {
  logger.error('Failed to start server', error);
  process.exit(1);
});
