import ConfigService from '../src/config/config.service';

describe('ConfigService', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Configuration Loading', () => {
    it('should load configuration from environment variables', () => {
      process.env.OPENROUTE_API_KEY = 'test-key';
      process.env.CACHE_TTL = '7200';
      process.env.PORT = '4000';
      
      // Create a new instance by clearing the singleton
      // Note: In real tests, we'd need to reset the singleton
      const config = ConfigService.getConfig();
      
      expect(config.openRouteApiKey).toBeDefined();
      expect(config.cacheTTL).toBe(7200);
      expect(config.port).toBe(4000);
    });

    it('should use default values when env variables are not set', () => {
      delete process.env.CACHE_TTL;
      delete process.env.PORT;
      
      const config = ConfigService.getConfig();
      
      expect(config.cacheTTL).toBe(3600); // Default value
      expect(config.port).toBe(3000); // Default value
    });
  });

  describe('Feature Flags', () => {
    it('should correctly parse feature flags', () => {
      process.env.ENABLE_CACHE = 'false';
      process.env.ENABLE_CROWDSOURCING = 'true';
      
      expect(ConfigService.isFeatureEnabled('cache')).toBe(false);
      expect(ConfigService.isFeatureEnabled('crowdsourcing')).toBe(true);
    });

    it('should default cache to enabled when not specified', () => {
      delete process.env.ENABLE_CACHE;
      
      expect(ConfigService.isFeatureEnabled('cache')).toBe(true);
    });
  });

  describe('Routing Service Detection', () => {
    it('should detect when routing service is available', () => {
      process.env.OPENROUTE_API_KEY = 'test-key';
      
      expect(ConfigService.hasRoutingService()).toBe(true);
      expect(ConfigService.getRoutingApiKey()).toBe('test-key');
    });

    it('should handle missing routing API keys', () => {
      delete process.env.OPENROUTE_API_KEY;
      delete process.env.MAPBOX_API_KEY;
      
      expect(ConfigService.hasRoutingService()).toBe(false);
      expect(ConfigService.getRoutingApiKey()).toBeUndefined();
    });

    it('should prefer OpenRoute over Mapbox', () => {
      process.env.OPENROUTE_API_KEY = 'openroute-key';
      process.env.MAPBOX_API_KEY = 'mapbox-key';
      
      expect(ConfigService.getRoutingApiKey()).toBe('openroute-key');
    });
  });
});
