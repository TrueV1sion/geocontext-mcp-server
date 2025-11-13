import { Location, RouteRequest, RouteResponse, GeoPin } from './index.js';

// Batch operation types

export interface BatchRouteRequest {
  requests: RouteRequest[];
  options?: {
    failFast?: boolean; // Stop on first error
    maxConcurrency?: number; // Override default concurrency
  };
}

export interface BatchRouteResult {
  index: number;
  success: boolean;
  data?: RouteResponse;
  error?: string;
}

export interface BatchRouteResponse {
  totalRequests: number;
  successful: number;
  failed: number;
  results: BatchRouteResult[];
  duration: number;
}

export interface BatchEnrichRequest {
  locations: Array<{
    location: Location;
    radius?: number;
  }>;
  options?: {
    failFast?: boolean;
    maxConcurrency?: number;
  };
}

export interface BatchEnrichResult {
  index: number;
  success: boolean;
  data?: {
    location: Location;
    address: any;
    poisFound: number;
    pois: GeoPin[];
  };
  error?: string;
}

export interface BatchEnrichResponse {
  totalRequests: number;
  successful: number;
  failed: number;
  results: BatchEnrichResult[];
  duration: number;
}

export interface BatchContextRequest {
  queries: Array<{
    location: Location;
    radius?: number;
    types?: string[];
    maxResults?: number;
  }>;
  options?: {
    failFast?: boolean;
    maxConcurrency?: number;
  };
}

export interface BatchContextResult {
  index: number;
  success: boolean;
  data?: {
    location: Location;
    radius: number;
    totalPins: number;
    pins: GeoPin[];
  };
  error?: string;
}

export interface BatchContextResponse {
  totalRequests: number;
  successful: number;
  failed: number;
  results: BatchContextResult[];
  duration: number;
}
