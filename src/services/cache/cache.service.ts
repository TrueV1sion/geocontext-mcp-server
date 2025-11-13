import NodeCache from 'node-cache';
import logger from '../logger.service.js';
import config from '../../config/config.service.js';

interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  hits: number;
}

class CacheService {
  private static instance: CacheService;
  private cache: NodeCache;
  private stats: {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
  };

  private constructor() {
    const ttl = config.get('cacheTTL');
    this.cache = new NodeCache({
      stdTTL: ttl,
      checkperiod: ttl * 0.2,
      useClones: false,
    });

    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
    };

    this.setupEventHandlers();
    logger.info('Cache service initialized', { ttl });
  }
  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  private setupEventHandlers(): void {
    this.cache.on('expired', (key) => {
      logger.debug(`Cache key expired: ${key}`);
    });

    this.cache.on('flush', () => {
      logger.info('Cache flushed');
    });
  }

  /**
   * Get a value from cache
   */
  public get<T>(key: string): T | undefined {
    if (!config.isFeatureEnabled('cache')) {
      return undefined;
    }

    const entry = this.cache.get<CacheEntry<T>>(key);
    if (entry) {
      this.stats.hits++;
      entry.hits++;
      this.cache.set(key, entry);
      logger.debug(`Cache hit: ${key}`);
      return entry.data;
    } else {
      this.stats.misses++;
      logger.debug(`Cache miss: ${key}`);
      return undefined;
    }
  }
  /**
   * Set a value in cache
   */
  public set<T>(key: string, value: T, ttl?: number): boolean {
    if (!config.isFeatureEnabled('cache')) {
      return false;
    }

    try {
      const entry: CacheEntry<T> = {
        data: value,
        timestamp: new Date(),
        hits: 0,
      };

      const success = ttl 
        ? this.cache.set(key, entry, ttl)
        : this.cache.set(key, entry);

      if (success) {
        this.stats.sets++;
        logger.debug(`Cache set: ${key}`);
      }
      return success;
    } catch (error) {
      logger.error(`Failed to set cache key: ${key}`, error);
      return false;
    }
  }

  /**
   * Delete a key from cache
   */
  public delete(key: string): boolean {
    const deleted = this.cache.del(key) > 0;
    if (deleted) {
      this.stats.deletes++;
      logger.debug(`Cache deleted: ${key}`);
    }
    return deleted;
  }
  /**
   * Clear all cache entries
   */
  public flush(): void {
    this.cache.flushAll();
    logger.info('Cache flushed');
  }

  /**
   * Get cache statistics
   */
  public getStats(): typeof this.stats & { keys: number } {
    return {
      ...this.stats,
      keys: this.cache.keys().length,
    };
  }

  /**
   * Check if a key exists
   */
  public has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Get all keys
   */
  public keys(): string[] {
    return this.cache.keys();
  }

  /**
   * Create a cache key from components
   */
  public createKey(...components: (string | number)[]): string {
    return components.join(':');
  }

  /**
   * Wrap a function with caching
   */
  public async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const result = await fn();
    this.set(key, result, ttl);
    return result;
  }
}

export default CacheService.getInstance();
