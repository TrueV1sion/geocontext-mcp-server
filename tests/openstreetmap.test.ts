import OpenStreetMapService from '../src/services/enrichment/openstreetmap.service';
import { Location } from '../src/types';
import nock from 'nock';

describe('OpenStreetMapService', () => {
  let osmService: typeof OpenStreetMapService;

  beforeAll(() => {
    osmService = OpenStreetMapService;
  });

  beforeEach(() => {
    // Clear any previous mocks
    nock.cleanAll();
  });

  describe('POI Fetching', () => {
    it('should fetch POIs near a location', async () => {
      // Mock Overpass API response
      const mockResponse = {
        elements: [
          {
            type: 'node',
            id: 123456,
            lat: 51.5074,
            lon: -0.1278,
            tags: {
              name: 'Test Restaurant',
              amenity: 'restaurant',
              cuisine: 'italian',
              opening_hours: 'Mo-Fr 10:00-22:00',
            },
          },
          {
            type: 'node',
            id: 123457,
            lat: 51.5080,
            lon: -0.1280,
            tags: {
              name: 'Test Museum',
              tourism: 'museum',
              description: 'A test museum',
            },
          },
        ],
      };

      nock('https://overpass-api.de')
        .post('/api/interpreter')
        .reply(200, mockResponse);

      const location: Location = { lat: 51.5074, lng: -0.1278 };
      const pins = await osmService.fetchPOIsNearLocation(location, 500);

      expect(pins).toHaveLength(2);
      expect(pins[0].data.name).toBe('Test Restaurant');
      expect(pins[0].type).toBe('poi');
      expect(pins[1].data.name).toBe('Test Museum');
      expect(pins[1].type).toBe('cultural');
    });

    it('should filter POIs by interests', async () => {
      const mockResponse = {
        elements: [
          {
            type: 'node',
            id: 123456,
            lat: 51.5074,
            lon: -0.1278,
            tags: {
              name: 'Historical Monument',
              historic: 'monument',
            },
          },
        ],
      };

      nock('https://overpass-api.de')
        .post('/api/interpreter')
        .reply(200, mockResponse);

      const location: Location = { lat: 51.5074, lng: -0.1278 };
      const pins = await osmService.fetchPOIsNearLocation(location, 500, ['history']);

      expect(pins).toHaveLength(1);
      expect(pins[0].type).toBe('historical');
    });
    it('should handle empty responses gracefully', async () => {
      nock('https://overpass-api.de')
        .post('/api/interpreter')
        .reply(200, { elements: [] });

      const location: Location = { lat: 51.5074, lng: -0.1278 };
      const pins = await osmService.fetchPOIsNearLocation(location, 500);

      expect(pins).toHaveLength(0);
    });

    it('should handle API errors gracefully', async () => {
      nock('https://overpass-api.de')
        .post('/api/interpreter')
        .reply(500, 'Internal Server Error');

      const location: Location = { lat: 51.5074, lng: -0.1278 };
      const pins = await osmService.fetchPOIsNearLocation(location, 500);

      expect(pins).toHaveLength(0); // Should return empty array on error
    });

    it('should skip elements without names', async () => {
      const mockResponse = {
        elements: [
          {
            type: 'node',
            id: 123456,
            lat: 51.5074,
            lon: -0.1278,
            tags: {
              amenity: 'bench', // No name tag
            },
          },
          {
            type: 'node',
            id: 123457,
            lat: 51.5080,
            lon: -0.1280,
            tags: {
              name: 'Named Place',
              amenity: 'cafe',
            },
          },
        ],
      };

      nock('https://overpass-api.de')
        .post('/api/interpreter')
        .reply(200, mockResponse);

      const location: Location = { lat: 51.5074, lng: -0.1278 };
      const pins = await osmService.fetchPOIsNearLocation(location, 500);

      expect(pins).toHaveLength(1);
      expect(pins[0].data.name).toBe('Named Place');
    });
  });

  describe('Reverse Geocoding', () => {
    it('should reverse geocode a location', async () => {
      const mockResponse = {
        display_name: '10 Downing Street, Westminster, London, SW1A 2AA, UK',
        address: {
          house_number: '10',
          road: 'Downing Street',
          suburb: 'Westminster',
          city: 'London',
          postcode: 'SW1A 2AA',
          country: 'United Kingdom',
        },
      };

      nock('https://nominatim.openstreetmap.org')
        .get('/reverse')
        .query(true)
        .reply(200, mockResponse);

      const location: Location = { lat: 51.5034, lng: -0.1276 };
      const result = await osmService.reverseGeocode(location);

      expect(result).toBeDefined();
      expect(result.display_name).toContain('Downing Street');
      expect(result.address.city).toBe('London');
    });

    it('should handle reverse geocoding errors', async () => {
      nock('https://nominatim.openstreetmap.org')
        .get('/reverse')
        .query(true)
        .reply(404, 'Not Found');

      const location: Location = { lat: 0, lng: 0 };
      const result = await osmService.reverseGeocode(location);

      expect(result).toBeNull();
    });
  });
  describe('Place Search', () => {
    it('should search for places by name', async () => {
      const mockResponse = [
        {
          place_id: 123456,
          display_name: 'Big Ben, Westminster, London',
          lat: '51.5007',
          lon: '-0.1246',
          type: 'attraction',
        },
        {
          place_id: 123457,
          display_name: 'Big Ben Cafe, London',
          lat: '51.5010',
          lon: '-0.1250',
          type: 'cafe',
        },
      ];

      nock('https://nominatim.openstreetmap.org')
        .get('/search')
        .query(true)
        .reply(200, mockResponse);

      const results = await osmService.searchPlace('Big Ben', 5);

      expect(results).toHaveLength(2);
      expect(results[0].display_name).toContain('Big Ben');
      expect(results[1].type).toBe('cafe');
    });

    it('should handle empty search results', async () => {
      nock('https://nominatim.openstreetmap.org')
        .get('/search')
        .query(true)
        .reply(200, []);

      const results = await osmService.searchPlace('NonExistentPlace12345');

      expect(results).toHaveLength(0);
    });

    it('should respect result limit', async () => {
      const mockResponse = Array(10).fill(null).map((_, i) => ({
        place_id: i,
        display_name: `Place ${i}`,
        lat: '51.5',
        lon: '-0.12',
      }));

      nock('https://nominatim.openstreetmap.org')
        .get('/search')
        .query((query) => query.limit === '3')
        .reply(200, mockResponse.slice(0, 3));

      const results = await osmService.searchPlace('Place', 3);

      expect(results).toHaveLength(3);
    });
  });
});
