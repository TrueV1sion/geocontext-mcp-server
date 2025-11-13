# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GeoContext MCP Server is a Model Context Protocol (MCP) server that provides location-aware contextual information to AI systems. It integrates with routing APIs, OpenStreetMap, and spatial indexing to offer geographic intelligence through dynamic route generation, POI discovery, and location enrichment.

**New in v1.1:**
- ✅ Middleware layer for validation, logging, error handling, rate limiting, and metrics
- ✅ OpenTelemetry integration for observability
- ✅ Configurable request timeouts
- ✅ Batch operation support for processing multiple requests
- ✅ Webhook support for async operations
- ✅ GeoJSON export functionality

## Essential Commands

### Development
```bash
# Install dependencies
npm install

# Build TypeScript to JavaScript
npm run build

# Start production server
npm start

# Development with hot reload (using tsx)
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run single test file
npm test -- tests/spatial-index.test.ts

# Lint TypeScript code
npm run lint

# Validate configuration and API connections
npm run validate

# Initial setup (install, build, validate)
npm run setup
```

## Architecture

### Service Layer Pattern
The codebase follows a modular service architecture with clear separation of concerns:

- **Entry Point**: `src/index.ts` - MCP server implementation handling tool registration and request routing
- **Middleware**: Located in `src/middleware/`, provides cross-cutting concerns:
  - `validation.middleware.ts` - Zod-based request validation
  - `logging.middleware.ts` - Request/response logging with correlation IDs
  - `error-handler.middleware.ts` - Centralized error handling and MCP error mapping
  - `rate-limiter.middleware.ts` - Per-tool rate limiting with p-queue
  - `metrics.middleware.ts` - Request metrics collection and reporting
- **Services**: Located in `src/services/`, each service is a singleton with specific responsibilities:
  - `routing/routing.service.ts` - Handles route generation with configurable timeouts
  - `enrichment/openstreetmap.service.ts` - Fetches POIs and reverse geocoding from OSM
  - `spatial/spatial-index.service.ts` - R-tree based spatial indexing for efficient geo queries
  - `cache/cache.service.ts` - In-memory caching with TTL support
  - `batch/batch.service.ts` - Batch processing for multiple requests
  - `webhooks/webhook.service.ts` - Webhook registration and delivery
  - `logger.service.ts` - Winston-based logging with context
- **Telemetry**: `src/telemetry/telemetry.service.ts` - OpenTelemetry integration for distributed tracing
- **Exporters**: `src/exporters/geojson.exporter.ts` - GeoJSON export utilities
- **Configuration**: `src/config/config.service.ts` - Centralized config with timeout settings
- **Types**: `src/types/` - TypeScript interfaces organized by domain

### MCP Protocol Integration
The server implements multiple tools exposed via MCP:

**Core Tools:**
1. `generate_route` - Creates navigation routes with contextual POI discovery
2. `get_nearby_context` - Retrieves nearby points of interest
3. `create_geopin` - Creates custom location markers
4. `enrich_location` - Enriches locations with OSM data

**Batch Operations:**
5. `batch_generate_routes` - Process multiple route requests in parallel
6. `batch_enrich_locations` - Enrich multiple locations in one request

**Export Tools:**
7. `export_route_geojson` - Export routes and pins as GeoJSON

**Observability:**
8. `get_metrics` - Retrieve server metrics, cache stats, and performance data

### Data Flow
1. MCP client request → `index.ts` handler
2. Request passes through middleware chain:
   - Metrics recording starts
   - Rate limiting check
   - Input validation (Zod schemas)
   - Logging with correlation ID
   - Error handling wrapper
3. Handler calls appropriate service(s)
4. Services may check cache → query spatial index → fetch from external APIs
5. Results aggregated and formatted
6. Response logged and metrics recorded → returned to MCP client

### Key Design Patterns
- **Singleton Services**: All services export singleton instances
- **Middleware Composition**: Middleware functions are composed in a specific order
- **Async/Await**: All API calls and I/O operations are async
- **Error Boundaries**: Centralized error handling with proper MCP error mapping
- **Caching Strategy**: Multi-level with memory cache first, then external APIs
- **Rate Limiting**: Per-tool concurrency limits with exponential backoff
- **Observability**: OpenTelemetry spans for distributed tracing

## Testing Strategy

Tests use Jest with ts-jest for TypeScript support. Test files are in `tests/` directory:
- Unit tests mock external dependencies using Jest mocks
- Integration tests (`integration.test.ts`) test actual service interactions
- Use `nock` for mocking HTTP requests in tests

## Environment Configuration

See `.env.example` for all configuration options. Key variables:

**Required:**
- `OPENROUTE_API_KEY` - OpenRouteService API key for routing

**Timeouts (milliseconds):**
- `TIMEOUT_ROUTING_API` - Routing API timeout (default: 60000)
- `TIMEOUT_OSM_API` - OSM API timeout (default: 30000)
- `TIMEOUT_DEFAULT_HTTP` - Default HTTP timeout (default: 30000)
- `TIMEOUT_TOOL_EXECUTION` - Tool execution timeout (default: 120000)

**Server:**
- `LOG_LEVEL` - Logging level (default: 'info')
- `CACHE_TTL` - Cache TTL in seconds (default: 3600)
- `MAX_CONCURRENT_REQUESTS` - Max concurrent requests (default: 10)

**Feature Flags:**
- `ENABLE_CACHE` - Enable caching (default: true)
- `ENABLE_TELEMETRY` - Enable OpenTelemetry (default: false)

## MCP Server Deployment

The server runs as a stdio-based MCP server. When integrated with Claude Desktop:
1. Built JavaScript files are executed from `build/` directory
2. Server communicates via stdio transport
3. Configuration is in Claude Desktop's `claude_desktop_config.json`

## Development Notes

- **ESM Modules**: Project uses ES modules (`"type": "module"` in package.json)
- **TypeScript Config**: Targets ES2022 with strict mode enabled
- **Import Extensions**: All local imports must use `.js` extension (even for `.ts` files)
- **Spatial Indexing**: Uses `rbush` R-tree for O(log n) geographic queries
- **External APIs**: Configurable timeouts and retry logic for API calls
- **Middleware**: Middleware functions compose via higher-order function pattern
- **Validation**: Zod schemas validate all tool inputs before processing
- **Observability**: OpenTelemetry spans track operation performance
- **Batch Processing**: Uses p-queue for controlled concurrency in batch operations

## New Features Guide

### Middleware Layer
All tool handlers automatically pass through the middleware chain:
```typescript
composeMiddleware(toolName, handler)
// Applies: metrics → rate limiting → validation → logging → error handling
```

### Batch Operations
Process multiple requests efficiently:
```typescript
// Batch route generation
{
  "requests": [
    { "start": {...}, "end": {...} },
    { "start": {...}, "end": {...} }
  ],
  "options": {
    "failFast": false,
    "maxConcurrency": 3
  }
}
```

### GeoJSON Export
Export routes and pins as GeoJSON for mapping libraries:
```typescript
exportRouteAsGeoJSON(route, {
  includeProperties: true,
  simplified: false
})
```

### Metrics and Monitoring
Access comprehensive metrics via `get_metrics` tool:
- Per-tool request counts and durations
- Success/failure rates
- Rate limiter queue stats
- Cache hit/miss ratios
- Webhook delivery statistics