import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

export interface AppConfig {
  // API Keys
  openRouteApiKey?: string;
  mapboxApiKey?: string;
  wikipediaApiKey?: string;
  historicMapsApiKey?: string;
  weatherApiKey?: string;
  overpassApiUrl: string;
  nominatimApiUrl: string;

  // Cache Configuration
  redisUrl?: string;
  cacheTTL: number;

  // Server Configuration
  port: number;
  logLevel: string;
  maxConcurrentRequests: number;

  // Timeout Configuration (in milliseconds)
  timeouts: {
    routingApi: number;
    osmApi: number;
    defaultHttp: number;
    toolExecution: number;
  };

  // Database Configuration
  databaseUrl?: string;

  // Feature Flags
  enableCrowdsourcing: boolean;
  enableMLPredictions: boolean;
  enableOfflineMode: boolean;
  enableCache: boolean;
  enableTelemetry: boolean;
}

class ConfigService {
  private static instance: ConfigService;
  private config: AppConfig;

  private constructor() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  private loadConfiguration(): AppConfig {
    return {
      // API Keys
      openRouteApiKey: process.env.OPENROUTE_API_KEY,
      mapboxApiKey: process.env.MAPBOX_API_KEY,
      wikipediaApiKey: process.env.WIKIPEDIA_API_KEY,
      historicMapsApiKey: process.env.HISTORIC_MAPS_API_KEY,
      weatherApiKey: process.env.WEATHER_API_KEY,
      overpassApiUrl: process.env.OVERPASS_API_URL || 'https://overpass-api.de/api/interpreter',
      nominatimApiUrl: process.env.NOMINATIM_API_URL || 'https://nominatim.openstreetmap.org',

      // Cache Configuration
      redisUrl: process.env.REDIS_URL,
      cacheTTL: parseInt(process.env.CACHE_TTL || '3600', 10),

      // Server Configuration
      port: parseInt(process.env.PORT || '3000', 10),
      logLevel: process.env.LOG_LEVEL || 'info',
      maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '10', 10),

      // Timeout Configuration
      timeouts: {
        routingApi: parseInt(process.env.TIMEOUT_ROUTING_API || '60000', 10),
        osmApi: parseInt(process.env.TIMEOUT_OSM_API || '30000', 10),
        defaultHttp: parseInt(process.env.TIMEOUT_DEFAULT_HTTP || '30000', 10),
        toolExecution: parseInt(process.env.TIMEOUT_TOOL_EXECUTION || '120000', 10),
      },

      // Database Configuration
      databaseUrl: process.env.DATABASE_URL,

      // Feature Flags
      enableCrowdsourcing: process.env.ENABLE_CROWDSOURCING === 'true',
      enableMLPredictions: process.env.ENABLE_ML_PREDICTIONS === 'true',
      enableOfflineMode: process.env.ENABLE_OFFLINE_MODE === 'true',
      enableCache: process.env.ENABLE_CACHE !== 'false', // Default to true
      enableTelemetry: process.env.ENABLE_TELEMETRY === 'true',
    };
  }

  private validateConfiguration(): void {
    const warnings: string[] = [];
    
    // Check for routing service availability
    if (!this.config.openRouteApiKey && !this.config.mapboxApiKey) {
      warnings.push('No routing API key configured (OpenRoute or Mapbox). Routing features will be limited.');
    }
    
    // Check cache configuration
    if (this.config.enableCache && !this.config.redisUrl) {
      warnings.push('Cache enabled but Redis URL not configured. Using in-memory cache.');
    }
    
    // Log warnings
    warnings.forEach(warning => {
      console.warn(`[CONFIG WARNING] ${warning}`);
    });
  }

  public getConfig(): AppConfig {
    return { ...this.config };
  }

  public get(key: keyof AppConfig): any {
    return this.config[key];
  }

  public hasRoutingService(): boolean {
    return !!(this.config.openRouteApiKey || this.config.mapboxApiKey);
  }

  public getRoutingApiKey(): string | undefined {
    return this.config.openRouteApiKey || this.config.mapboxApiKey;
  }

  public isFeatureEnabled(feature: 'crowdsourcing' | 'mlPredictions' | 'offlineMode' | 'cache' | 'telemetry'): boolean {
    const featureMap = {
      crowdsourcing: this.config.enableCrowdsourcing,
      mlPredictions: this.config.enableMLPredictions,
      offlineMode: this.config.enableOfflineMode,
      cache: this.config.enableCache,
      telemetry: this.config.enableTelemetry,
    };
    return featureMap[feature] || false;
  }

  public getTimeout(type: 'routingApi' | 'osmApi' | 'defaultHttp' | 'toolExecution'): number {
    return this.config.timeouts[type];
  }
}

export default ConfigService.getInstance();
