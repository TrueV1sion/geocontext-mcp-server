import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import logger from '../services/logger.service.js';

// Schema definitions for tool inputs
const LocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const RouteRequestSchema = z.object({
  start: LocationSchema,
  end: LocationSchema,
  waypoints: z.array(LocationSchema).optional(),
  profile: z.enum(['driving', 'walking', 'cycling', 'wheelchair']).default('driving'),
  interests: z.array(z.string()).optional(),
  bufferRadius: z.number().min(50).max(5000).default(500),
});

const NearbyContextSchema = z.object({
  location: LocationSchema,
  radius: z.number().min(10).max(10000).default(1000),
  types: z.array(z.enum(['poi', 'historical', 'landmark', 'event', 'cultural', 'natural'])).optional(),
  maxResults: z.number().min(1).max(200).default(50),
});

const GeoPinSchema = z.object({
  location: LocationSchema,
  radius: z.number().min(10).max(5000).default(100),
  type: z.enum(['poi', 'historical', 'landmark', 'event', 'cultural', 'natural']),
  data: z.object({
    name: z.string().min(1).max(200),
    description: z.string().min(1).max(2000),
    category: z.array(z.string()).optional(),
  }),
});

const EnrichLocationSchema = z.object({
  location: LocationSchema,
  radius: z.number().min(10).max(5000).default(500),
});

// Schema map for different tools
const schemaMap: Record<string, z.ZodSchema> = {
  generate_route: RouteRequestSchema,
  get_nearby_context: NearbyContextSchema,
  create_geopin: GeoPinSchema,
  enrich_location: EnrichLocationSchema,
};

/**
 * Validate tool input arguments against schema
 */
export function validateToolInput(toolName: string, args: any): any {
  const schema = schemaMap[toolName];

  if (!schema) {
    logger.warn(`No validation schema found for tool: ${toolName}`);
    return args;
  }

  try {
    const validated = schema.parse(args);
    logger.debug(`Validation successful for tool: ${toolName}`);
    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err =>
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');

      logger.error(`Validation failed for tool ${toolName}: ${errorMessages}`);

      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters for ${toolName}: ${errorMessages}`
      );
    }
    throw error;
  }
}

/**
 * Middleware wrapper for tool handlers
 */
export function withValidation<T extends (...args: any[]) => any>(
  toolName: string,
  handler: T
): T {
  return (async (...args: any[]) => {
    const validatedArgs = validateToolInput(toolName, args[0]);
    return handler(validatedArgs, ...args.slice(1));
  }) as T;
}
