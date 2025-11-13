// Default configuration for GeoContext MCP Server

export const defaultConfig = {
  // Server settings
  server: {
    name: 'geocontext-mcp',
    version: '1.0.0',
    port: process.env.PORT || 3000,
    logLevel: process.env.LOG_LEVEL || 'info',
  },

  // API settings
  api: {
    maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '10'),
    requestTimeout: 30000, // 30 seconds
    retryAttempts: 3,
    retryDelay: 1000, // 1 second
  },

  // Cache settings
  cache: {
    ttl: parseInt(process.env.CACHE_TTL || '3600'), // 1 hour
    maxSize: 1000, // Maximum number of cached items
    checkPeriod: 600, // Check for expired cache every 10 minutes
  },

  // External API URLs
  apis: {
    openroute: {
      baseUrl: 'https://api.openrouteservice.org/v2',
      apiKey: process.env.OPENROUTE_API_KEY,
    },
    overpass: {
      baseUrl: 'https://overpass-api.de/api/interpreter',
    },
    wikipedia: {
      baseUrl: 'https://en.wikipedia.org/w/api.php',
    },
    wikidata: {
      baseUrl: 'https://www.wikidata.org/w/api.php',
    },
  },
  // Spatial index settings
  spatialIndex: {
    maxEntries: 9, // Maximum entries in R-tree node
    maxDepth: 40,  // Maximum tree depth
  },

  // Default query parameters
  defaults: {
    searchRadius: 1000, // meters
    maxResults: 50,
    bufferRadius: 500, // meters
    pinRadius: 100, // meters
  },

  // Feature flags
  features: {
    enableCrowdsourcing: process.env.ENABLE_CROWDSOURCING === 'true',
    enableMLPredictions: process.env.ENABLE_ML_PREDICTIONS === 'true',
    enableOfflineMode: process.env.ENABLE_OFFLINE_MODE === 'true',
  },

  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    message: 'Too many requests from this IP',
  },
};

export type Config = typeof defaultConfig;