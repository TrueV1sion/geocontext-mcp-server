/**
 * Quick validation script to test the GeoContext MCP Server
 * Run this after building to verify core functionality
 */

import spatialIndex from '../build/services/spatial/spatial-index.service.js';
import cache from '../build/services/cache/cache.service.js';
import config from '../build/config/config.service.js';
import { generateId } from '../build/utils/helpers.js';

console.log('🔍 GeoContext MCP Server - Validation Script');
console.log('============================================\n');

let testsPassed = 0;
let testsFailed = 0;

function test(name: string, fn: () => boolean | Promise<boolean>) {
  return (async () => {
    try {
      const result = await fn();
      if (result) {
        console.log(`✅ ${name}`);
        testsPassed++;
      } else {
        console.log(`❌ ${name}`);
        testsFailed++;
      }
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
      testsFailed++;
    }
  })();
}

async function runValidation() {
  // Test 1: Configuration Service
  await test('Configuration Service loads', () => {
    const cfg = config.getConfig();
    return cfg !== undefined && cfg.logLevel !== undefined;
  });

  // Test 2: Cache Service
  await test('Cache Service works', () => {
    const key = 'test-key';
    const value = 'test-value';
    cache.set(key, value);
    const retrieved = cache.get(key);
    cache.delete(key);
    return retrieved === value;
  });

  // Test 3: Spatial Index Service
  await test('Spatial Index Service works', () => {
    const testPin = {
      id: generateId('test'),
      location: { lat: 51.5074, lng: -0.1278 },
      radius: 100,
      type: 'poi' as const,
      data: {
        name: 'Test Pin',
        description: 'Test',
        category: ['test'],
      },
      metadata: {
        source: 'test',
        lastUpdated: new Date(),
        verificationStatus: 'verified' as const,
        languages: ['en'],
        tags: ['test'],
      },
    };
    
    spatialIndex.addPin(testPin);
    const pins = spatialIndex.queryByRadius({ lat: 51.5074, lng: -0.1278 }, 200);
    spatialIndex.removePin(testPin.id);
    return pins.length === 1 && pins[0].id === testPin.id;
  });

  // Test 4: Helper Functions
  await test('Helper functions work', () => {
    const id = generateId('test');
    return id.startsWith('test_') && id.length > 10;
  });

  // Test 5: API Configuration
  await test('API configuration check', () => {
    const hasRouting = config.hasRoutingService();
    if (!hasRouting) {
      console.log('  ⚠️  No routing API configured (optional)');
    }
    return true; // This is informational, not a failure
  });

  // Test 6: Cache key generation
  await test('Cache key generation works', () => {
    const key = cache.createKey('service', 'method', 123);
    return key === 'service:method:123';
  });

  // Test 7: Spatial index stats
  await test('Spatial index statistics work', () => {
    const stats = spatialIndex.getStats();
    return stats.totalPins >= 0 && stats.indexSize >= 0;
  });

  // Summary
  console.log('\n============================================');
  console.log(`Tests Passed: ${testsPassed}`);
  console.log(`Tests Failed: ${testsFailed}`);
  
  if (testsFailed === 0) {
    console.log('\n✅ All validation tests passed!');
    console.log('The server is ready to use.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the output above.');
  }
  
  // Check API keys
  console.log('\n📋 Configuration Status:');
  const cfg = config.getConfig();
  console.log(`  Cache Enabled: ${cfg.enableCache}`);
  console.log(`  Cache TTL: ${cfg.cacheTTL}s`);
  console.log(`  Log Level: ${cfg.logLevel}`);
  
  if (cfg.openRouteApiKey && !cfg.openRouteApiKey.includes('your_')) {
    console.log('  ✅ OpenRoute API Key: Configured');
  } else {
    console.log('  ⚠️  OpenRoute API Key: Not configured (routing will use fallback)');
  }
  
  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run validation
runValidation().catch(error => {
  console.error('Validation failed:', error);
  process.exit(1);
});
