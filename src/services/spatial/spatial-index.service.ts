import RBush from 'rbush';
import * as turf from '@turf/turf';
import { GeoPin, Location } from '../../types/index.js';
import logger from '../logger.service.js';

interface SpatialItem extends RBush.BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  pin: GeoPin;
}

class SpatialIndexService {
  private static instance: SpatialIndexService;
  private index: RBush<SpatialItem>;
  private pinMap: Map<string, GeoPin>;

  private constructor() {
    this.index = new RBush<SpatialItem>();
    this.pinMap = new Map();
    logger.info('Spatial index service initialized');
  }

  public static getInstance(): SpatialIndexService {
    if (!SpatialIndexService.instance) {
      SpatialIndexService.instance = new SpatialIndexService();
    }
    return SpatialIndexService.instance;
  }

  /**
   * Add a pin to the spatial index
   */
  public addPin(pin: GeoPin): void {
    try {
      // Calculate bounding box for the pin based on its radius
      const point = turf.point([pin.location.lng, pin.location.lat]);
      const buffered = turf.buffer(point, pin.radius, { units: 'meters' });
      const bbox = turf.bbox(buffered);

      const spatialItem: SpatialItem = {
        minX: bbox[0],
        minY: bbox[1],
        maxX: bbox[2],
        maxY: bbox[3],
        pin,
      };

      this.index.insert(spatialItem);
      this.pinMap.set(pin.id, pin);
      
      logger.debug(`Added pin ${pin.id} to spatial index`, {
        location: pin.location,
        radius: pin.radius,
      });
    } catch (error) {
      logger.error(`Failed to add pin to spatial index: ${pin.id}`, error);
    }
  }

  /**
   * Remove a pin from the spatial index
   */
  public removePin(pinId: string): boolean {
    const pin = this.pinMap.get(pinId);
    if (!pin) {
      return false;
    }

    try {
      const point = turf.point([pin.location.lng, pin.location.lat]);
      const buffered = turf.buffer(point, pin.radius, { units: 'meters' });
      const bbox = turf.bbox(buffered);

      const spatialItem: SpatialItem = {
        minX: bbox[0],
        minY: bbox[1],
        maxX: bbox[2],
        maxY: bbox[3],
        pin,
      };

      this.index.remove(spatialItem, (a, b) => a.pin.id === b.pin.id);
      this.pinMap.delete(pinId);
      
      logger.debug(`Removed pin ${pinId} from spatial index`);
      return true;
    } catch (error) {
      logger.error(`Failed to remove pin from spatial index: ${pinId}`, error);
      return false;
    }
  }

  /**
   * Query pins within a radius of a location
   */
  public queryByRadius(location: Location, radiusMeters: number): GeoPin[] {
    try {
      const point = turf.point([location.lng, location.lat]);
      const searchArea = turf.buffer(point, radiusMeters, { units: 'meters' });
      const bbox = turf.bbox(searchArea);

      const candidates = this.index.search({
        minX: bbox[0],
        minY: bbox[1],
        maxX: bbox[2],
        maxY: bbox[3],
      });

      // Filter candidates by actual distance
      const results = candidates
        .map(item => ({
          pin: item.pin,
          distance: turf.distance(
            point,
            turf.point([item.pin.location.lng, item.pin.location.lat]),
            { units: 'meters' }
          ),
        }))
        .filter(item => item.distance <= radiusMeters)
        .sort((a, b) => a.distance - b.distance)
        .map(item => item.pin);

      logger.debug(`Found ${results.length} pins within ${radiusMeters}m of location`, {
        location,
        resultCount: results.length,
      });

      return results;
    } catch (error) {
      logger.error('Failed to query pins by radius', error);
      return [];
    }
  }

  /**
   * Query pins within a bounding box
   */
  public queryByBoundingBox(west: number, south: number, east: number, north: number): GeoPin[] {
    try {
      const results = this.index.search({
        minX: west,
        minY: south,
        maxX: east,
        maxY: north,
      });

      return results.map(item => item.pin);
    } catch (error) {
      logger.error('Failed to query pins by bounding box', error);
      return [];
    }
  }

  /**
   * Query pins that intersect with a polygon
   */
  public queryByPolygon(polygon: turf.Feature<turf.Polygon>): GeoPin[] {
    try {
      const bbox = turf.bbox(polygon);
      const candidates = this.index.search({
        minX: bbox[0],
        minY: bbox[1],
        maxX: bbox[2],
        maxY: bbox[3],
      });

      // Filter by actual polygon intersection
      const results = candidates
        .filter(item => {
          const pinPoint = turf.point([item.pin.location.lng, item.pin.location.lat]);
          return turf.booleanPointInPolygon(pinPoint, polygon);
        })
        .map(item => item.pin);

      logger.debug(`Found ${results.length} pins within polygon`);
      return results;
    } catch (error) {
      logger.error('Failed to query pins by polygon', error);
      return [];
    }
  }

  /**
   * Get nearest K pins to a location
   */
  public getNearestPins(location: Location, k: number = 10): GeoPin[] {
    const allPins = Array.from(this.pinMap.values());
    const point = turf.point([location.lng, location.lat]);

    const pinsWithDistance = allPins.map(pin => ({
      pin,
      distance: turf.distance(
        point,
        turf.point([pin.location.lng, pin.location.lat]),
        { units: 'meters' }
      ),
    }));

    pinsWithDistance.sort((a, b) => a.distance - b.distance);
    return pinsWithDistance.slice(0, k).map(item => item.pin);
  }

  /**
   * Get all pins
   */
  public getAllPins(): GeoPin[] {
    return Array.from(this.pinMap.values());
  }

  /**
   * Get pin by ID
   */
  public getPinById(id: string): GeoPin | undefined {
    return this.pinMap.get(id);
  }

  /**
   * Clear all pins from the index
   */
  public clear(): void {
    this.index.clear();
    this.pinMap.clear();
    logger.info('Spatial index cleared');
  }

  /**
   * Get statistics about the spatial index
   */
  public getStats(): { totalPins: number; indexSize: number } {
    return {
      totalPins: this.pinMap.size,
      indexSize: this.index.all().length,
    };
  }
}

export default SpatialIndexService.getInstance();
