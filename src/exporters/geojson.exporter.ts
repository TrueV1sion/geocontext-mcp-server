import * as turf from '@turf/turf';
import { GeoPin, RouteResponse, Location } from '../types/index.js';

export interface GeoJSONExportOptions {
  includeProperties?: boolean;
  simplified?: boolean;
}

/**
 * Export a route as GeoJSON FeatureCollection
 */
export function exportRouteAsGeoJSON(
  route: RouteResponse,
  options: GeoJSONExportOptions = {}
): GeoJSON.FeatureCollection {
  const { includeProperties = true, simplified = false } = options;

  const features: GeoJSON.Feature[] = [];

  // Add route line as LineString feature
  const routeLine = turf.lineString(route.route.coordinates, {
    name: `Route ${route.routeId}`,
    distance: route.route.distance,
    duration: route.route.duration,
    type: 'route',
  });

  features.push(routeLine);

  // Add POIs along the route as Point features
  if (!simplified && route.pins) {
    route.pins.forEach((pin, index) => {
      const point = turf.point(
        [pin.location.lng, pin.location.lat],
        includeProperties
          ? {
              id: pin.id,
              name: pin.data.name,
              description: pin.data.description,
              type: pin.type,
              category: pin.data.category,
              radius: pin.radius,
              source: pin.metadata.source,
              index,
            }
          : { id: pin.id, name: pin.data.name }
      );
      features.push(point);
    });
  }

  return turf.featureCollection(features);
}

/**
 * Export pins as GeoJSON FeatureCollection
 */
export function exportPinsAsGeoJSON(
  pins: GeoPin[],
  options: GeoJSONExportOptions = {}
): GeoJSON.FeatureCollection {
  const { includeProperties = true } = options;

  const features: GeoJSON.Feature[] = pins.map(pin => {
    const properties = includeProperties
      ? {
          id: pin.id,
          name: pin.data.name,
          description: pin.data.description,
          type: pin.type,
          category: pin.data.category,
          radius: pin.radius,
          source: pin.metadata.source,
          verificationStatus: pin.metadata.verificationStatus,
          tags: pin.metadata.tags,
        }
      : { id: pin.id, name: pin.data.name };

    // Create circle/buffer around pin location if radius > 0
    if (pin.radius > 0 && includeProperties) {
      return turf.circle(
        [pin.location.lng, pin.location.lat],
        pin.radius,
        {
          units: 'meters',
          properties,
        }
      );
    }

    return turf.point([pin.location.lng, pin.location.lat], properties);
  });

  return turf.featureCollection(features);
}

/**
 * Export route with pins as layered GeoJSON
 */
export function exportCombinedGeoJSON(
  route: RouteResponse,
  options: GeoJSONExportOptions = {}
): GeoJSON.FeatureCollection {
  const { includeProperties = true } = options;

  const features: GeoJSON.Feature[] = [];

  // Add route line
  const routeLine = turf.lineString(route.route.coordinates, {
    name: `Route ${route.routeId}`,
    distance: route.route.distance,
    duration: route.route.duration,
    type: 'route',
    layer: 'route',
  });
  features.push(routeLine);

  // Add start point
  const startCoords = route.route.coordinates[0];
  const startPoint = turf.point(startCoords, {
    name: 'Start',
    type: 'waypoint',
    layer: 'waypoints',
    markerSymbol: 'start',
    markerColor: '#00ff00',
  });
  features.push(startPoint);

  // Add end point
  const endCoords = route.route.coordinates[route.route.coordinates.length - 1];
  const endPoint = turf.point(endCoords, {
    name: 'End',
    type: 'waypoint',
    layer: 'waypoints',
    markerSymbol: 'end',
    markerColor: '#ff0000',
  });
  features.push(endPoint);

  // Add POIs
  if (route.pins) {
    route.pins.forEach((pin, index) => {
      const properties = includeProperties
        ? {
            id: pin.id,
            name: pin.data.name,
            description: pin.data.description,
            type: pin.type,
            category: pin.data.category,
            layer: 'pois',
            markerSymbol: getMarkerSymbol(pin.type),
            markerColor: getMarkerColor(pin.type),
            index,
          }
        : {
            id: pin.id,
            name: pin.data.name,
            layer: 'pois',
          };

      const point = turf.point([pin.location.lng, pin.location.lat], properties);
      features.push(point);
    });
  }

  return turf.featureCollection(features);
}

/**
 * Export a location with nearby context as GeoJSON
 */
export function exportLocationContextAsGeoJSON(
  location: Location,
  radius: number,
  pins: GeoPin[],
  options: GeoJSONExportOptions = {}
): GeoJSON.FeatureCollection {
  const { includeProperties = true } = options;

  const features: GeoJSON.Feature[] = [];

  // Add center point
  const centerPoint = turf.point([location.lng, location.lat], {
    name: 'Center',
    type: 'center',
    layer: 'center',
  });
  features.push(centerPoint);

  // Add search radius circle
  const radiusCircle = turf.circle([location.lng, location.lat], radius, {
    units: 'meters',
    properties: {
      name: 'Search Radius',
      type: 'search-radius',
      layer: 'radius',
      radiusMeters: radius,
    },
  });
  features.push(radiusCircle);

  // Add POIs
  pins.forEach(pin => {
    const properties = includeProperties
      ? {
          id: pin.id,
          name: pin.data.name,
          description: pin.data.description,
          type: pin.type,
          category: pin.data.category,
          layer: 'pois',
          markerSymbol: getMarkerSymbol(pin.type),
          markerColor: getMarkerColor(pin.type),
        }
      : { id: pin.id, name: pin.data.name, layer: 'pois' };

    const point = turf.point([pin.location.lng, pin.location.lat], properties);
    features.push(point);
  });

  return turf.featureCollection(features);
}

/**
 * Get marker symbol based on pin type
 */
function getMarkerSymbol(type: string): string {
  const symbolMap: Record<string, string> = {
    poi: 'marker',
    historical: 'monument',
    landmark: 'star',
    event: 'calendar',
    cultural: 'theatre',
    natural: 'park',
  };
  return symbolMap[type] || 'marker';
}

/**
 * Get marker color based on pin type
 */
function getMarkerColor(type: string): string {
  const colorMap: Record<string, string> = {
    poi: '#3388ff',
    historical: '#8b4513',
    landmark: '#ffd700',
    event: '#ff69b4',
    cultural: '#9370db',
    natural: '#228b22',
  };
  return colorMap[type] || '#3388ff';
}

/**
 * Simplify GeoJSON by reducing precision and removing unnecessary properties
 */
export function simplifyGeoJSON(
  geojson: GeoJSON.FeatureCollection,
  precision: number = 6
): GeoJSON.FeatureCollection {
  // Round coordinates to specified precision
  const simplified = JSON.parse(JSON.stringify(geojson));

  const roundCoordinates = (coords: any): any => {
    if (Array.isArray(coords[0])) {
      return coords.map(roundCoordinates);
    }
    return coords.map((c: number) => Number(c.toFixed(precision)));
  };

  simplified.features.forEach((feature: any) => {
    if (feature.geometry && feature.geometry.coordinates) {
      feature.geometry.coordinates = roundCoordinates(feature.geometry.coordinates);
    }
  });

  return simplified;
}
