// Type definitions for GeoContext MCP Server

export interface Location {
  lat: number;
  lng: number;
}

export interface GeoPin {
  id: string;
  location: Location;
  radius: number;
  type: PinType;
  data: PinData;
  metadata: PinMetadata;
  temporalData?: TemporalData;
}

export type PinType = 'poi' | 'historical' | 'landmark' | 'event' | 'cultural' | 'natural';

export interface PinData {
  name: string;
  description: string;
  category: string[];
  historicalPeriod?: string;
  significance?: string;
  images?: string[];
  audioGuides?: string[];
  visitingHours?: string;
  accessibility?: string;
  relatedPins?: string[];
}

export interface PinMetadata {
  source: string;
  lastUpdated: Date;
  verificationStatus: 'verified' | 'unverified' | 'crowdsourced';
  languages: string[];
  tags: string[];
}
export interface TemporalData {
  startDate?: Date;
  endDate?: Date;
  recurring?: boolean;
  schedule?: string;
}

export interface RouteRequest {
  start: Location;
  end: Location;
  waypoints?: Location[];
  profile?: TravelProfile;
  interests?: string[];
  bufferRadius?: number;
}

export type TravelProfile = 'driving' | 'walking' | 'cycling' | 'wheelchair';

export interface RouteResponse {
  routeId: string;
  route: {
    distance: number;
    duration: number;
    coordinates: number[][];
  };
  contextualPins: number;
  pins: GeoPin[];
  message: string;
}

export interface NearbyContextRequest {
  location: Location;
  radius?: number;
  types?: PinType[];
  maxResults?: number;
}

export interface EnrichmentSource {
  name: string;
  data: any;
  timestamp: Date;
}