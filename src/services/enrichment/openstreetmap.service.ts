import axios, { AxiosInstance } from 'axios';
import { Location, GeoPin, PinType } from '../../types/index.js';
import logger from '../logger.service.js';
import cache from '../cache/cache.service.js';
import config from '../../config/config.service.js';
import { generateId } from '../../utils/helpers.js';

interface OverpassNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

interface OverpassWay {
  type: 'way';
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
  center?: {
    lat: number;
    lon: number;
  };
}

type OverpassElement = OverpassNode | OverpassWay;

interface OverpassResponse {
  elements: OverpassElement[];
}

class OpenStreetMapService {
  private static instance: OpenStreetMapService;
  private overpassClient: AxiosInstance;
  private nominatimClient: AxiosInstance;

  private constructor() {
    const overpassUrl = config.getConfig().overpassApiUrl;
    const nominatimUrl = config.getConfig().nominatimApiUrl;
    const osmTimeout = config.getTimeout('osmApi');

    this.overpassClient = axios.create({
      baseURL: overpassUrl,
      timeout: osmTimeout,
      headers: {
        'User-Agent': 'GeoContext-MCP-Server/1.0',
      },
    });

    this.nominatimClient = axios.create({
      baseURL: nominatimUrl,
      timeout: Math.min(osmTimeout, 10000), // Nominatim should be faster
      headers: {
        'User-Agent': 'GeoContext-MCP-Server/1.0',
      },
    });

    logger.info('OpenStreetMap service initialized', { timeout: osmTimeout });
  }

  public static getInstance(): OpenStreetMapService {
    if (!OpenStreetMapService.instance) {
      OpenStreetMapService.instance = new OpenStreetMapService();
    }
    return OpenStreetMapService.instance;
  }

  /**
   * Fetch POIs within a radius of a location
   */
  public async fetchPOIsNearLocation(
    location: Location,
    radiusMeters: number,
    interests?: string[]
  ): Promise<GeoPin[]> {
    const cacheKey = cache.createKey(
      'osm',
      'pois',
      location.lat,
      location.lng,
      radiusMeters,
      interests?.join(',') || 'all'
    );
    return cache.wrap(cacheKey, async () => {
      try {
        const query = this.buildOverpassQuery(location, radiusMeters, interests);
        logger.debug('Executing Overpass query', { location, radius: radiusMeters });

        const response = await this.overpassClient.post<OverpassResponse>(
          '',
          `data=${encodeURIComponent(query)}`,
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        );

        const pins = response.data.elements.map(element => 
          this.convertElementToGeoPin(element)
        ).filter(pin => pin !== null) as GeoPin[];

        logger.info(`Fetched ${pins.length} POIs from OpenStreetMap`);
        return pins;
      } catch (error) {
        logger.error('Failed to fetch POIs from OpenStreetMap', error);
        return [];
      }
    });
  }

  /**
   * Build Overpass QL query
   */
  private buildOverpassQuery(
    location: Location,
    radiusMeters: number,
    interests?: string[]
  ): string {
    const tags = this.getTagsForInterests(interests);
    const tagFilters = tags.map(tag => {
      if (tag.includes('=')) {
        const [key, value] = tag.split('=');
        return `["${key}"="${value}"]`;
      }
      return `["${tag}"]`;
    }).join('');
    // Build Overpass QL query
    return `
      [out:json][timeout:25];
      (
        node${tagFilters}(around:${radiusMeters},${location.lat},${location.lng});
        way${tagFilters}(around:${radiusMeters},${location.lat},${location.lng});
      );
      out center;
    `;
  }

  /**
   * Map interests to OSM tags
   */
  private getTagsForInterests(interests?: string[]): string[] {
    if (!interests || interests.length === 0) {
      // Default tags for general POIs
      return ['amenity', 'tourism', 'historic', 'leisure', 'natural'];
    }

    const interestTagMap: Record<string, string[]> = {
      history: ['historic', 'heritage', 'memorial', 'monument'],
      architecture: ['building=church', 'building=cathedral', 'building=castle', 'architect'],
      nature: ['natural', 'leisure=park', 'leisure=garden', 'waterway'],
      food: ['amenity=restaurant', 'amenity=cafe', 'amenity=bar', 'cuisine'],
      shopping: ['shop', 'amenity=marketplace'],
      culture: ['amenity=theatre', 'amenity=museum', 'amenity=gallery', 'amenity=library'],
      transport: ['public_transport', 'railway', 'aeroway', 'highway=bus_stop'],
      accommodation: ['tourism=hotel', 'tourism=hostel', 'tourism=guest_house'],
      entertainment: ['leisure', 'sport', 'amenity=cinema', 'amenity=nightclub'],
      education: ['amenity=school', 'amenity=university', 'amenity=college'],
    };

    const tags = new Set<string>();
    interests.forEach(interest => {
      const mappedTags = interestTagMap[interest.toLowerCase()];
      if (mappedTags) {
        mappedTags.forEach(tag => tags.add(tag));
      }
    });

    return Array.from(tags);
  }
  /**
   * Convert OSM element to GeoPin
   */
  private convertElementToGeoPin(element: OverpassElement): GeoPin | null {
    if (!element.tags || !element.tags.name) {
      return null; // Skip elements without names
    }

    const location: Location = element.type === 'node'
      ? { lat: element.lat, lng: element.lon }
      : element.center 
        ? { lat: element.center.lat, lng: element.center.lon }
        : { lat: 0, lng: 0 }; // Should not happen with 'out center'

    if (location.lat === 0 && location.lng === 0) {
      return null;
    }

    const type = this.determinePinType(element.tags);
    const categories = this.extractCategories(element.tags);

    return {
      id: generateId('osm'),
      location,
      radius: 50, // Default radius for OSM POIs
      type,
      data: {
        name: element.tags.name,
        description: this.generateDescription(element.tags),
        category: categories,
        visitingHours: element.tags.opening_hours,
        accessibility: this.extractAccessibility(element.tags),
      },
      metadata: {
        source: 'openstreetmap',
        lastUpdated: new Date(),
        verificationStatus: 'verified',
        languages: this.extractLanguages(element.tags),
        tags: Object.keys(element.tags),
      },
    };
  }
  /**
   * Determine pin type from OSM tags
   */
  private determinePinType(tags: Record<string, string>): PinType {
    if (tags.historic || tags.heritage || tags.memorial) return 'historical';
    if (tags.tourism === 'attraction' || tags.tourism === 'viewpoint') return 'landmark';
    if (tags.natural || tags.waterway) return 'natural';
    if (tags.amenity === 'theatre' || tags.amenity === 'museum' || tags.amenity === 'gallery') return 'cultural';
    if (tags.event) return 'event';
    return 'poi';
  }

  /**
   * Extract categories from OSM tags
   */
  private extractCategories(tags: Record<string, string>): string[] {
    const categories: string[] = [];
    
    // Primary categories
    if (tags.amenity) categories.push(tags.amenity);
    if (tags.tourism) categories.push(tags.tourism);
    if (tags.historic) categories.push('historic');
    if (tags.leisure) categories.push(tags.leisure);
    if (tags.shop) categories.push(`shop:${tags.shop}`);
    if (tags.cuisine) categories.push(`cuisine:${tags.cuisine}`);
    
    return categories;
  }

  /**
   * Generate description from OSM tags
   */
  private generateDescription(tags: Record<string, string>): string {
    const parts: string[] = [];
    
    if (tags.description) {
      parts.push(tags.description);
    }
    
    if (tags.amenity) {
      parts.push(`Type: ${tags.amenity.replace(/_/g, ' ')}`);
    }
    
    if (tags.cuisine) {
      parts.push(`Cuisine: ${tags.cuisine}`);
    }
    
    if (tags.historic) {
      parts.push(`Historic: ${tags.historic.replace(/_/g, ' ')}`);
    }
    
    if (tags.website) {
      parts.push(`Website: ${tags.website}`);
    }
    
    return parts.join('. ') || 'No description available';
  }
  /**
   * Extract accessibility information
   */
  private extractAccessibility(tags: Record<string, string>): string | undefined {
    const accessInfo: string[] = [];
    
    if (tags.wheelchair) {
      accessInfo.push(`Wheelchair: ${tags.wheelchair}`);
    }
    
    if (tags.toilets_wheelchair) {
      accessInfo.push(`Wheelchair toilets: ${tags.toilets_wheelchair}`);
    }
    
    if (tags.hearing_loop) {
      accessInfo.push('Hearing loop available');
    }
    
    return accessInfo.length > 0 ? accessInfo.join(', ') : undefined;
  }

  /**
   * Extract languages from name tags
   */
  private extractLanguages(tags: Record<string, string>): string[] {
    const languages = new Set<string>(['en']); // Default to English
    
    Object.keys(tags).forEach(key => {
      const match = key.match(/^name:(.+)$/);
      if (match) {
        languages.add(match[1]);
      }
    });
    
    return Array.from(languages);
  }

  /**
   * Reverse geocode a location to get address
   */
  public async reverseGeocode(location: Location): Promise<any> {
    const cacheKey = cache.createKey('nominatim', 'reverse', location.lat, location.lng);
    
    return cache.wrap(cacheKey, async () => {
      try {
        const response = await this.nominatimClient.get('/reverse', {
          params: {
            lat: location.lat,
            lon: location.lng,
            format: 'json',
            addressdetails: 1,
          },
        });
        
        return response.data;
      } catch (error) {
        logger.error('Failed to reverse geocode location', error);
        return null;
      }
    }, 86400); // Cache for 24 hours
  }

  /**
   * Search for a place by name
   */
  public async searchPlace(query: string, limit: number = 5): Promise<any[]> {
    const cacheKey = cache.createKey('nominatim', 'search', query, limit);
    
    return cache.wrap(cacheKey, async () => {
      try {
        const response = await this.nominatimClient.get('/search', {
          params: {
            q: query,
            format: 'json',
            limit,
            addressdetails: 1,
          },
        });
        
        return response.data;
      } catch (error) {
        logger.error('Failed to search place', error);
        return [];
      }
    });
  }
}

export default OpenStreetMapService.getInstance();
