import SpatialIndexService from '../src/services/spatial/spatial-index.service';
import { GeoPin } from '../src/types';

describe('SpatialIndexService', () => {
  let spatialIndex: typeof SpatialIndexService;

  beforeEach(() => {
    spatialIndex = SpatialIndexService;
    spatialIndex.clear(); // Clear index before each test
  });

  const createTestPin = (id: string, lat: number, lng: number): GeoPin => ({
    id,
    location: { lat, lng },
    radius: 100,
    type: 'poi',
    data: {
      name: `Test Pin ${id}`,
      description: 'Test description',
      category: ['test'],
    },
    metadata: {
      source: 'test',
      lastUpdated: new Date(),
      verificationStatus: 'verified',
      languages: ['en'],
      tags: ['test'],
    },
  });

  describe('Pin Management', () => {
    it('should add pins to the index', () => {
      const pin = createTestPin('pin1', 51.5074, -0.1278);
      spatialIndex.addPin(pin);
      
      const stats = spatialIndex.getStats();
      expect(stats.totalPins).toBe(1);
      expect(stats.indexSize).toBe(1);
    });

    it('should retrieve pin by ID', () => {
      const pin = createTestPin('pin1', 51.5074, -0.1278);
      spatialIndex.addPin(pin);
      
      const retrieved = spatialIndex.getPinById('pin1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('pin1');
    });

    it('should remove pins from the index', () => {
      const pin = createTestPin('pin1', 51.5074, -0.1278);
      spatialIndex.addPin(pin);
      
      const removed = spatialIndex.removePin('pin1');
      expect(removed).toBe(true);
      
      const stats = spatialIndex.getStats();
      expect(stats.totalPins).toBe(0);
    });

    it('should handle removing non-existent pins', () => {
      const removed = spatialIndex.removePin('non-existent');
      expect(removed).toBe(false);
    });
  });
  describe('Spatial Queries', () => {
    beforeEach(() => {
      // Add test pins in London area
      spatialIndex.addPin(createTestPin('pin1', 51.5074, -0.1278)); // London
      spatialIndex.addPin(createTestPin('pin2', 51.5033, -0.1195)); // London Eye
      spatialIndex.addPin(createTestPin('pin3', 51.5007, -0.1246)); // Big Ben
      spatialIndex.addPin(createTestPin('pin4', 51.5194, -0.1270)); // British Museum
      spatialIndex.addPin(createTestPin('pin5', 48.8566, 2.3522)); // Paris (far away)
    });

    it('should query pins by radius', () => {
      const location = { lat: 51.5074, lng: -0.1278 }; // London center
      const pins = spatialIndex.queryByRadius(location, 2000); // 2km radius
      
      expect(pins.length).toBe(4); // Should find 4 London pins
      expect(pins.some(p => p.id === 'pin5')).toBe(false); // Should not find Paris
    });

    it('should return pins sorted by distance', () => {
      const location = { lat: 51.5074, lng: -0.1278 };
      const pins = spatialIndex.queryByRadius(location, 5000);
      
      // First pin should be the one at the exact location
      expect(pins[0].id).toBe('pin1');
    });

    it('should query pins by bounding box', () => {
      // Bounding box around London
      const pins = spatialIndex.queryByBoundingBox(-0.2, 51.45, -0.05, 51.55);
      
      expect(pins.length).toBe(4); // Should find London pins
      expect(pins.some(p => p.id === 'pin5')).toBe(false); // Should not find Paris
    });

    it('should get nearest K pins', () => {
      const location = { lat: 51.5074, lng: -0.1278 };
      const pins = spatialIndex.getNearestPins(location, 3);
      
      expect(pins.length).toBe(3);
      expect(pins[0].id).toBe('pin1'); // Closest pin
    });
  });

  describe('Bulk Operations', () => {
    it('should handle multiple pins efficiently', () => {
      // Add 100 pins
      for (let i = 0; i < 100; i++) {
        const lat = 51.5 + (Math.random() - 0.5) * 0.1;
        const lng = -0.12 + (Math.random() - 0.5) * 0.1;
        spatialIndex.addPin(createTestPin(`pin${i}`, lat, lng));
      }
      
      const stats = spatialIndex.getStats();
      expect(stats.totalPins).toBe(100);
      
      // Query should still be fast
      const location = { lat: 51.5074, lng: -0.1278 };
      const pins = spatialIndex.queryByRadius(location, 1000);
      expect(pins).toBeDefined();
    });

    it('should clear all pins', () => {
      spatialIndex.addPin(createTestPin('pin1', 51.5074, -0.1278));
      spatialIndex.addPin(createTestPin('pin2', 51.5033, -0.1195));
      
      spatialIndex.clear();
      
      const stats = spatialIndex.getStats();
      expect(stats.totalPins).toBe(0);
      expect(stats.indexSize).toBe(0);
    });
  });
});
