import CacheService from '../src/services/cache/cache.service';

describe('CacheService', () => {
  let cache: typeof CacheService;

  beforeEach(() => {
    cache = CacheService;
    cache.flush(); // Clear cache before each test
  });

  describe('Basic Operations', () => {
    it('should set and get values', () => {
      const key = 'test-key';
      const value = { data: 'test-data' };
      
      cache.set(key, value);
      const retrieved = cache.get(key);
      
      expect(retrieved).toEqual(value);
    });

    it('should return undefined for non-existent keys', () => {
      const value = cache.get('non-existent');
      expect(value).toBeUndefined();
    });

    it('should delete keys', () => {
      const key = 'test-key';
      cache.set(key, 'value');
      
      const deleted = cache.delete(key);
      expect(deleted).toBe(true);
      
      const value = cache.get(key);
      expect(value).toBeUndefined();
    });

    it('should check if key exists', () => {
      const key = 'test-key';
      cache.set(key, 'value');
      
      expect(cache.has(key)).toBe(true);
      expect(cache.has('non-existent')).toBe(false);
    });
  });

  describe('TTL Support', () => {
    it('should respect custom TTL', (done) => {
      const key = 'ttl-key';
      const value = 'test-value';
      
      cache.set(key, value, 1); // 1 second TTL
      
      // Should exist immediately
      expect(cache.get(key)).toBe(value);
      
      // Should expire after 1.5 seconds
      setTimeout(() => {
        expect(cache.get(key)).toBeUndefined();
        done();
      }, 1500);
    });
  });

  describe('Cache Key Generation', () => {
    it('should create composite keys', () => {
      const key = cache.createKey('service', 'method', 123, 'param');
      expect(key).toBe('service:method:123:param');
    });

    it('should handle numeric components', () => {
      const key = cache.createKey('lat', 51.5074, 'lng', -0.1278);
      expect(key).toBe('lat:51.5074:lng:-0.1278');
    });
  });
  describe('Wrap Function', () => {
    it('should cache function results', async () => {
      let callCount = 0;
      const expensiveFunction = async () => {
        callCount++;
        return { result: 'expensive-data' };
      };
      
      const key = 'wrap-test';
      
      // First call should execute the function
      const result1 = await cache.wrap(key, expensiveFunction);
      expect(result1).toEqual({ result: 'expensive-data' });
      expect(callCount).toBe(1);
      
      // Second call should return cached value
      const result2 = await cache.wrap(key, expensiveFunction);
      expect(result2).toEqual({ result: 'expensive-data' });
      expect(callCount).toBe(1); // Function not called again
    });

    it('should handle async errors', async () => {
      const failingFunction = async () => {
        throw new Error('Function failed');
      };
      
      const key = 'error-test';
      
      await expect(cache.wrap(key, failingFunction)).rejects.toThrow('Function failed');
    });
  });

  describe('Statistics', () => {
    it('should track cache hits and misses', () => {
      cache.set('key1', 'value1');
      
      // Reset stats (would need to implement in real service)
      const initialStats = cache.getStats();
      
      cache.get('key1'); // Hit
      cache.get('key2'); // Miss
      cache.get('key1'); // Hit
      
      const stats = cache.getStats();
      expect(stats.hits).toBeGreaterThanOrEqual(2);
      expect(stats.misses).toBeGreaterThanOrEqual(1);
    });

    it('should track sets and deletes', () => {
      const initialStats = cache.getStats();
      
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.delete('key1');
      
      const stats = cache.getStats();
      expect(stats.sets).toBeGreaterThanOrEqual(2);
      expect(stats.deletes).toBeGreaterThanOrEqual(1);
    });

    it('should count total keys', () => {
      cache.flush();
      
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      const stats = cache.getStats();
      expect(stats.keys).toBe(3);
    });
  });

  describe('Bulk Operations', () => {
    it('should list all keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      const keys = cache.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    it('should flush all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      cache.flush();
      
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.keys().length).toBe(0);
    });
  });
});
