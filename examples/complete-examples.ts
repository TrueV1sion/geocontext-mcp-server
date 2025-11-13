/**
 * Complete usage examples for GeoContext MCP Server
 * This file demonstrates all available tools and their usage patterns
 */

// Example 1: Generate a walking route with historical points of interest
const generateHistoricalRoute = {
  tool: 'generate_route',
  arguments: {
    start: {
      lat: 51.5074,  // London
      lng: -0.1278
    },
    end: {
      lat: 51.5007,  // Big Ben
      lng: -0.1246
    },
    profile: 'walking',
    interests: ['history', 'architecture', 'landmark'],
    bufferRadius: 300  // 300 meters around route
  }
};

// Expected response:
// {
//   "routeId": "route_1234567890_abc123",
//   "route": {
//     "distance": 1250,
//     "duration": 900,
//     "coordinates": [[...], [...], ...]
//   },
//   "contextualPins": 15,
//   "pins": [
//     {
//       "id": "osm_1234567890_xyz",
//       "location": { "lat": 51.5060, "lng": -0.1260 },
//       "type": "historical",
//       "data": {
//         "name": "Westminster Abbey",
//         "description": "Historic church and UNESCO World Heritage Site",
//         "category": ["historic", "church", "landmark"]
//       }
//     },
//     // ... more pins
//   ]
// }

// Example 2: Get nearby restaurants and cafes
const getNearbyFood = {
  tool: 'get_nearby_context',
  arguments: {
    location: {
      lat: 48.8566,  // Paris, Louvre area
      lng: 2.3522
    },
    radius: 500,
    types: ['poi'],
    maxResults: 20
  }
};

// Example 3: Create a custom geo-pin for a hidden gem
const createCustomPin = {
  tool: 'create_geopin',
  arguments: {
    location: {
      lat: 51.5145,
      lng: -0.0756
    },
    radius: 50,
    type: 'cultural',
    data: {
      name: 'Secret Jazz Club',
      description: 'Underground jazz venue with live performances every night',
      category: ['music', 'nightlife', 'entertainment'],
      visitingHours: 'Daily 8PM-2AM',
      accessibility: 'Wheelchair accessible entrance on side street'
    }
  }
};
// Example 4: Enrich a location with OpenStreetMap data
const enrichLocation = {
  tool: 'enrich_location',
  arguments: {
    location: {
      lat: 41.9028,  // Rome, Colosseum area
      lng: 12.4964
    },
    radius: 1000
  }
};

// Expected response:
// {
//   "location": { "lat": 41.9028, "lng": 12.4964 },
//   "address": {
//     "display_name": "Colosseo, Via dei Fori Imperiali, Rome, Italy",
//     "address": {
//       "tourism": "Colosseum",
//       "road": "Via dei Fori Imperiali",
//       "city": "Rome",
//       "country": "Italy"
//     }
//   },
//   "poisFound": 42,
//   "pois": [
//     {
//       "id": "osm_987654321_abc",
//       "location": { "lat": 41.9028, "lng": 12.4964 },
//       "type": "historical",
//       "data": {
//         "name": "Colosseum",
//         "description": "Ancient Roman amphitheatre",
//         "category": ["historic", "monument", "tourism"]
//       }
//     },
//     // ... more POIs
//   ]
// }

// Example 5: Complex route with waypoints
const complexRoute = {
  tool: 'generate_route',
  arguments: {
    start: {
      lat: 48.8566,  // Louvre Museum
      lng: 2.3522
    },
    end: {
      lat: 48.8584,  // Eiffel Tower
      lng: 2.2945
    },
    waypoints: [
      { lat: 48.8606, lng: 2.3376 },  // Place de la Concorde
      { lat: 48.8638, lng: 2.3272 }   // Grand Palais
    ],
    profile: 'cycling',
    interests: ['architecture', 'culture', 'history'],
    bufferRadius: 200
  }
};

// Example 6: Search for natural areas
const findNature = {
  tool: 'get_nearby_context',
  arguments: {
    location: {
      lat: 51.5074,
      lng: -0.1278
    },
    radius: 2000,
    types: ['natural'],
    maxResults: 10
  }
};

// Example 7: Create an event pin
const createEventPin = {
  tool: 'create_geopin',
  arguments: {
    location: {
      lat: 51.5033,
      lng: -0.1195
    },
    radius: 100,
    type: 'event',
    data: {
      name: 'Summer Music Festival',
      description: 'Annual outdoor music festival featuring local and international artists',
      category: ['music', 'festival', 'outdoor'],
      visitingHours: 'July 15-17, 2025, 12PM-11PM',
      temporalData: {
        startDate: '2025-07-15T12:00:00Z',
        endDate: '2025-07-17T23:00:00Z',
        recurring: true,
        schedule: 'Annually in July'
      }
    }
  }
};
// Advanced Usage Patterns

// Pattern 1: Building a city tour
async function buildCityTour(city: string, interests: string[]) {
  // First, search for the city center
  const cityCenter = await searchPlace(city);
  
  // Get major landmarks
  const landmarks = await getNearbyContext({
    location: cityCenter,
    radius: 5000,
    types: ['landmark', 'historical'],
    maxResults: 10
  });
  
  // Create a route connecting top landmarks
  const tourRoute = await generateRoute({
    start: cityCenter,
    end: cityCenter,  // Circular tour
    waypoints: landmarks.slice(0, 5).map(l => l.location),
    profile: 'walking',
    interests: interests,
    bufferRadius: 200
  });
  
  return tourRoute;
}

// Pattern 2: Accessibility-focused navigation
async function accessibleRoute(start: Location, end: Location) {
  const route = await generateRoute({
    start,
    end,
    profile: 'wheelchair',
    interests: ['accessible'],
    bufferRadius: 100
  });
  
  // Filter pins for accessibility features
  const accessiblePins = route.pins.filter(pin => 
    pin.data.accessibility && 
    pin.data.accessibility.includes('wheelchair')
  );
  
  return {
    ...route,
    pins: accessiblePins
  };
}

// Pattern 3: Time-based POI discovery
async function getTimeBasedPOIs(location: Location, timeOfDay: string) {
  const interests = [];
  
  // Adjust interests based on time
  if (timeOfDay === 'morning') {
    interests.push('food', 'cafe');
  } else if (timeOfDay === 'afternoon') {
    interests.push('shopping', 'culture', 'museum');
  } else if (timeOfDay === 'evening') {
    interests.push('restaurant', 'entertainment', 'nightlife');
  }
  
  return await getNearbyContext({
    location,
    radius: 1000,
    types: ['poi', 'cultural'],
    maxResults: 30
  });
}

// Pattern 4: Multi-modal journey planning
async function multiModalJourney(locations: Location[]) {
  const segments = [];
  
  for (let i = 0; i < locations.length - 1; i++) {
    const profile = i === 0 ? 'walking' : 'driving';  // Walk first, then drive
    
    const segment = await generateRoute({
      start: locations[i],
      end: locations[i + 1],
      profile,
      bufferRadius: profile === 'walking' ? 200 : 500
    });
    
    segments.push(segment);
  }
  
  return segments;
}

// Export for use in other modules
export {
  generateHistoricalRoute,
  getNearbyFood,
  createCustomPin,
  enrichLocation,
  complexRoute,
  findNature,
  createEventPin,
  buildCityTour,
  accessibleRoute,
  getTimeBasedPOIs,
  multiModalJourney
};
