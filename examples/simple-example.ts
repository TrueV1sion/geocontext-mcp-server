// Simple example of using GeoContext MCP Server
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

async function main() {
  // Initialize MCP client
  const client = new Client({
    name: 'geocontext-example',
    version: '1.0.0',
  });

  // Example 1: Find nearby points of interest
  console.log('Example 1: Finding nearby points of interest...');
  const nearbyContext = await client.callTool('get_nearby_context', {
    location: { lat: 51.5074, lng: -0.1278 }, // London
    radius: 500,
    types: ['historical', 'landmark'],
    maxResults: 10
  });
  
  console.log(`Found ${nearbyContext.totalPins} locations:`);
  nearbyContext.pins.forEach(pin => {
    console.log(`- ${pin.data.name} (${pin.distance}m away)`);
  });

  // Example 2: Generate a walking route
  console.log('\nExample 2: Generating a walking route...');
  const route = await client.callTool('generate_route', {
    start: { lat: 51.5074, lng: -0.1278 }, // Big Ben
    end: { lat: 51.5033, lng: -0.1195 },   // London Eye
    profile: 'walking',
    interests: ['historical', 'architecture'],
    bufferRadius: 200
  });  
  console.log(`Route generated: ${route.route.distance}m, ${route.route.duration/60} minutes`);
  console.log(`Found ${route.contextualPins} points of interest along the way`);

  // Example 3: Create a custom geo-pin
  console.log('\nExample 3: Creating a custom geo-pin...');
  const newPin = await client.callTool('create_geopin', {
    location: { lat: 51.5014, lng: -0.1419 },
    type: 'cultural',
    data: {
      name: 'Secret Garden Cafe',
      description: 'A hidden gem with amazing coffee and a beautiful garden',
      category: ['cafe', 'garden', 'hidden_gem']
    }
  });
  
  console.log(`Created pin: ${newPin.pin.id}`);

  // Example 4: Query historical information
  console.log('\nExample 4: Querying historical layers...');
  const history = await client.callTool('query_historical_layers', {
    location: { lat: 51.5074, lng: -0.1278 },
    timePeriods: ['victorian', 'wwii', 'medieval']
  });
  
  console.log('Historical information retrieved for periods:', Object.keys(history.historicalLayers));
}

main().catch(console.error);