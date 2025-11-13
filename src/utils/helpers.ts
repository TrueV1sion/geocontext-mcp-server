// Utility functions for GeoContext MCP Server

import * as turf from '@turf/turf';
import { Location, GeoPin } from '../types/index.js';

/**
 * Calculate distance between two locations in meters
 */
export function calculateDistance(loc1: Location, loc2: Location): number {
  const point1 = turf.point([loc1.lng, loc1.lat]);
  const point2 = turf.point([loc2.lng, loc2.lat]);
  return turf.distance(point1, point2, { units: 'meters' });
}

/**
 * Check if a location is within a pin's radius
 */
export function isWithinRadius(location: Location, pin: GeoPin): boolean {
  const distance = calculateDistance(location, pin.location);
  return distance <= pin.radius;
}

/**
 * Generate a unique ID
 */
export function generateId(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Validate coordinates
 */
export function isValidCoordinate(location: Location): boolean {
  return (
    typeof location.lat === 'number' &&
    typeof location.lng === 'number' &&
    location.lat >= -90 &&
    location.lat <= 90 &&
    location.lng >= -180 &&
    location.lng <= 180
  );
}