import axios, { AxiosInstance } from 'axios';
import * as turf from '@turf/turf';
import { RouteRequest, RouteResponse, GeoPin } from '../../types/index.js';
import logger from '../logger.service.js';
import cache from '../cache/cache.service.js';
import config from '../../config/config.service.js';
import osmService from '../enrichment/openstreetmap.service.js';
import spatialIndex from '../spatial/spatial-index.service.js';
import { generateId } from '../../utils/helpers.js';

interface OpenRouteResponse {
  features: Array<{
    geometry: {
      coordinates: number[][];
      type: string;
    };
    properties: {
      segments: Array<{
        distance: number;
        duration: number;
        steps: Array<{
          distance: number;
          duration: number;
          type: number;
          instruction: string;
          name: string;
          way_points: number[];
        }>;
      }>;
      summary: {
        distance: number;
        duration: number;
      };
    };
  }>;
}

class RoutingService {
  private static instance: RoutingService;
  private client: AxiosInstance | null = null;
  private readonly profileMap = {
    driving: 'driving-car',
    walking: 'foot-walking',
    cycling: 'cycling-regular',
    wheelchair: 'wheelchair',
  };
  private constructor() {
    const apiKey = config.getConfig().openRouteApiKey;
    const timeout = config.getTimeout('routingApi');

    if (apiKey) {
      this.client = axios.create({
        baseURL: 'https://api.openrouteservice.org/v2',
        timeout,
        headers: {
          'Authorization': apiKey,
          'Accept': 'application/json, application/geo+json',
          'Content-Type': 'application/json',
        },
      });
      logger.info('Routing service initialized with OpenRouteService', { timeout });
    } else {
      logger.warn('No routing API key configured. Routing features will be limited.');
    }
  }

  public static getInstance(): RoutingService {
    if (!RoutingService.instance) {
      RoutingService.instance = new RoutingService();
    }
    return RoutingService.instance;
  }

  /**
   * Generate a route with contextual enrichment
   */
  public async generateRoute(request: RouteRequest): Promise<RouteResponse> {
    const routeId = generateId('route');
    
    try {
      // Get the basic route
      const routeData = await this.fetchRoute(request);
      
      if (!routeData) {
        throw new Error('Failed to generate route');
      }
      
      // Create route LineString
      const routeLineString = turf.lineString(routeData.coordinates);
      
      // Create buffer around route for POI discovery
      const bufferRadius = request.bufferRadius || 500;
      // turf.buffer is only used for documentation purposes
      // const routeBuffer = turf.buffer(routeLineString, bufferRadius, { units: 'meters' });
      // Fetch POIs along the route
      const pins = await this.discoverPOIsAlongRoute(
        routeLineString,
        bufferRadius,
        request.interests
      );
      
      // Add pins to spatial index for future queries
      pins.forEach(pin => spatialIndex.addPin(pin));
      
      logger.info(`Generated route ${routeId} with ${pins.length} POIs`);
      
      return {
        routeId,
        route: {
          distance: routeData.distance,
          duration: routeData.duration,
          coordinates: routeData.coordinates,
        },
        contextualPins: pins.length,
        pins: pins.slice(0, 20), // Return first 20 pins as preview
        message: `Route generated successfully with ${pins.length} points of interest`,
      };
    } catch (error) {
      logger.error('Failed to generate route', error);
      throw error;
    }
  }

  /**
   * Fetch route from OpenRouteService
   */
  private async fetchRoute(request: RouteRequest): Promise<{
    distance: number;
    duration: number;
    coordinates: number[][];
  } | null> {
    if (!this.client) {
      // Fallback to simple straight line if no API configured
      return this.generateFallbackRoute(request);
    }

    const cacheKey = cache.createKey(
      'route',
      request.start.lat,
      request.start.lng,
      request.end.lat,
      request.end.lng,
      request.profile || 'driving'
    );
    return cache.wrap(cacheKey, async () => {
      try {
        const coordinates: number[][] = [
          [request.start.lng, request.start.lat],
        ];
        
        if (request.waypoints) {
          request.waypoints.forEach(wp => {
            coordinates.push([wp.lng, wp.lat]);
          });
        }
        
        coordinates.push([request.end.lng, request.end.lat]);
        
        const response = await this.client!.post<OpenRouteResponse>(
          `/directions/${this.profileMap[request.profile || 'driving']}/geojson`,
          {
            coordinates,
            preference: 'recommended',
          }
        );
        
        if (response.data.features.length > 0) {
          const feature = response.data.features[0];
          return {
            distance: feature.properties.summary.distance,
            duration: feature.properties.summary.duration,
            coordinates: feature.geometry.coordinates,
          };
        }
        
        return null;
      } catch (error) {
        logger.error('Failed to fetch route from OpenRouteService', error);
        return null;
      }
    });
  }

  /**
   * Generate fallback route when no API is available
   */
  private generateFallbackRoute(request: RouteRequest): {
    distance: number;
    duration: number;
    coordinates: number[][];
  } {
    const coordinates: number[][] = [
      [request.start.lng, request.start.lat],
    ];
    
    if (request.waypoints) {
      request.waypoints.forEach(wp => {
        coordinates.push([wp.lng, wp.lat]);
      });
    }
    
    coordinates.push([request.end.lng, request.end.lat]);
    
    // Calculate distance using Turf
    const line = turf.lineString(coordinates);
    const distance = turf.length(line, { units: 'meters' });
    
    // Estimate duration (assuming 50 km/h average speed)
    const duration = (distance / 1000) * 72; // seconds
    
    logger.warn('Using fallback route generation (straight line)');
    
    return {
      distance,
      duration,
      coordinates,
    };
  }
  /**
   * Discover POIs along a route
   */
  private async discoverPOIsAlongRoute(
    route: turf.Feature<turf.LineString>,
    bufferRadius: number,
    interests?: string[]
  ): Promise<GeoPin[]> {
    // Sample points along the route for POI discovery
    const routeLength = turf.length(route, { units: 'meters' });
    const sampleInterval = Math.min(1000, routeLength / 10); // Sample every 1km or 10 points
    const numSamples = Math.floor(routeLength / sampleInterval);
    
    const samplePromises: Promise<GeoPin[]>[] = [];
    
    for (let i = 0; i <= numSamples; i++) {
      const distance = i * sampleInterval;
      const point = turf.along(route, distance, { units: 'meters' });
      const coords = point.geometry.coordinates;
      
      samplePromises.push(
        osmService.fetchPOIsNearLocation(
          { lat: coords[1], lng: coords[0] },
          bufferRadius,
          interests
        )
      );
    }
    
    try {
      const results = await Promise.all(samplePromises);
      const allPins = results.flat();
      
      // Deduplicate pins by location
      const uniquePins = new Map<string, GeoPin>();
      allPins.forEach(pin => {
        const key = `${pin.location.lat.toFixed(5)},${pin.location.lng.toFixed(5)}`;
        if (!uniquePins.has(key)) {
          uniquePins.set(key, pin);
        }
      });
      
      return Array.from(uniquePins.values());
    } catch (error) {
      logger.error('Failed to discover POIs along route', error);
      return [];
    }
  }

  /**
   * Get alternative routes
   */
  public async getAlternativeRoutes(
    request: RouteRequest,
    _numAlternatives: number = 2
  ): Promise<RouteResponse[]> {
    // This would implement alternative route calculation
    // For now, just return the main route
    const mainRoute = await this.generateRoute(request);
    return [mainRoute];
  }

  /**
   * Check if routing service is available
   */
  public isAvailable(): boolean {
    return this.client !== null;
  }
}

export default RoutingService.getInstance();
