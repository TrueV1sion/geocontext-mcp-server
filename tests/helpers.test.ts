// Basic tests for utility functions

import { calculateDistance, isValidCoordinate, generateId } from '../src/utils/helpers';

describe('Helper Functions', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two points correctly', () => {
      const loc1 = { lat: 51.5074, lng: -0.1278 }; // London
      const loc2 = { lat: 51.5033, lng: -0.1195 }; // Near London Eye
      
      const distance = calculateDistance(loc1, loc2);
      expect(distance).toBeGreaterThan(500);
      expect(distance).toBeLessThan(1000);
    });

    it('should return 0 for same location', () => {
      const loc = { lat: 51.5074, lng: -0.1278 };
      const distance = calculateDistance(loc, loc);
      expect(distance).toBe(0);
    });
  });

  describe('isValidCoordinate', () => {
    it('should validate correct coordinates', () => {
      expect(isValidCoordinate({ lat: 51.5074, lng: -0.1278 })).toBe(true);
      expect(isValidCoordinate({ lat: -90, lng: 180 })).toBe(true);
      expect(isValidCoordinate({ lat: 90, lng: -180 })).toBe(true);
    });

    it('should reject invalid coordinates', () => {
      expect(isValidCoordinate({ lat: 91, lng: 0 })).toBe(false);
      expect(isValidCoordinate({ lat: 0, lng: 181 })).toBe(false);
      expect(isValidCoordinate({ lat: -91, lng: 0 })).toBe(false);
    });
  });
  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId('test');
      const id2 = generateId('test');
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^test_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^test_\d+_[a-z0-9]+$/);
    });

    it('should include the correct prefix', () => {
      const id = generateId('pin');
      expect(id).toMatch(/^pin_/);
    });
  });
});