# GeoContext MCP Server

A sophisticated Model Context Protocol (MCP) server that provides AI systems with rich, location-aware contextual information. It dynamically generates navigation routes, aggregates geographic data from multiple sources, and creates intelligent geo-pins that activate based on proximity.

## Features

- 🗺️ **Dynamic Route Generation** - Create context-rich navigation routes with POI discovery
- 📍 **Intelligent Geo-Pins** - Location-based information triggers with customizable radii
- 🕰️ **Temporal Layers** - Access historical context across different time periods
- 🌍 **Multi-Source Enrichment** - Aggregate data from OpenStreetMap, Wikipedia, Wikidata, and more
- 🎯 **Personalized Context** - Filter and prioritize information based on user interests
- 🔒 **Privacy-First Design** - Anonymous queries and encrypted sensitive locations
- ⚡ **High Performance** - Spatial indexing and intelligent caching for fast queries

## Installation

```bash
# Clone the repository
git clone https://github.com/your-org/geocontext-mcp-server.git
cd geocontext-mcp-server

# Install dependencies
npm install

# Build the TypeScript code
npm run build

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys
```
## Configuration

Create a `.env` file with the following variables:

```env
# Required API Keys
OPENROUTE_API_KEY=your_openroute_api_key
MAPBOX_API_KEY=your_mapbox_api_key  # Alternative to OpenRoute

# Optional API Keys for Enhanced Features
WIKIPEDIA_API_KEY=your_wikipedia_api_key
HISTORIC_MAPS_API_KEY=your_historic_maps_key
WEATHER_API_KEY=your_weather_api_key

# Cache Configuration
REDIS_URL=redis://localhost:6379
CACHE_TTL=3600  # seconds

# Server Configuration
PORT=3000
LOG_LEVEL=info
MAX_CONCURRENT_REQUESTS=10
```

## Usage

### Starting the Server

```bash
# Production
npm start

# Development with hot reload
npm run dev
```
### MCP Client Configuration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "geocontext": {
      "command": "node",
      "args": ["/path/to/geocontext-mcp-server/build/index.js"],
      "env": {
        "OPENROUTE_API_KEY": "your_api_key"
      }
    }
  }
}
```

### Example Usage with Claude Desktop

Once configured, you can use natural language to interact with geographic context:

```
"Generate a walking route from the Eiffel Tower to the Louvre, highlighting historical landmarks and architectural points of interest along the way."

"What historical events happened within 500 meters of my current location?"

"Create a geo-pin for this hidden coffee shop at 123 Main St with its opening hours and specialties."

"Show me how this area looked during the Renaissance period."
```
## API Reference

### Tools

#### `generate_route`
Generate a navigation route with contextual information.

```typescript
{
  start: { lat: number, lng: number },
  end: { lat: number, lng: number },
  waypoints?: Array<{ lat: number, lng: number }>,
  profile?: 'driving' | 'walking' | 'cycling' | 'wheelchair',
  interests?: string[],
  bufferRadius?: number  // meters
}
```

#### `get_nearby_context`
Retrieve contextual information for a specific location.

```typescript
{
  location: { lat: number, lng: number },
  radius?: number,  // meters, default: 1000
  types?: Array<'poi' | 'historical' | 'landmark' | 'event' | 'cultural' | 'natural'>,
  maxResults?: number
}
```
#### `create_geopin`
Create a custom geo-pin with contextual information.

```typescript
{
  location: { lat: number, lng: number },
  radius?: number,  // meters
  type: 'poi' | 'historical' | 'landmark' | 'event' | 'cultural' | 'natural',
  data: {
    name: string,
    description: string,
    category?: string[],
    // ... additional fields
  }
}
```

#### `enrich_location`
Enrich a location with data from multiple sources.

```typescript
{
  location: { lat: number, lng: number },
  sources?: Array<'openstreetmap' | 'wikipedia' | 'wikidata' | 'historic_maps' | 'cultural_heritage'>
}
```

#### `query_historical_layers`
Query historical information for different time periods.

```typescript
{
  location: { lat: number, lng: number },
  timePeriods?: string[]  // e.g., ['ancient', 'medieval', '1800s']
}
```
### Resources

- `geocontext://routes` - List active routes with their context
- `geocontext://pins` - Access all available geo-pins

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│   MCP Client    │────▶│  GeoContext  │────▶│  External   │
│  (AI Assistant) │     │   MCP Server │     │    APIs     │
└─────────────────┘     └──────────────┘     └─────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │   Spatial    │
                        │    Index     │
                        └──────────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
             ┌──────────────┐      ┌──────────────┐
             │    Cache     │      │   Database   │
             │   (Redis)    │      │ (PostgreSQL) │
             └──────────────┘      └──────────────┘
```
## Data Sources

### Primary Sources
- **OpenStreetMap** - POIs, roads, buildings, geographic features
- **Wikipedia** - Historical and cultural information
- **Wikidata** - Structured data and relationships

### Enhanced Sources (Optional)
- **Historic Map APIs** - Time-period specific geography
- **Cultural Heritage Databases** - UNESCO sites, monuments
- **Event APIs** - Real-time events and temporary installations
- **Weather Services** - Current conditions affecting locations

## Performance Considerations

### Spatial Indexing
The server uses R-tree spatial indexing for efficient geographic queries:
- O(log n) lookup time for nearby pins
- Automatic rebalancing for optimal performance
- Support for complex polygon queries

### Caching Strategy
Multi-level caching for optimal performance:
1. **Memory Cache** - Hot data (< 1ms)
2. **Redis Cache** - Frequent queries (< 10ms)
3. **Database** - Persistent storage (< 100ms)
4. **External APIs** - Fresh data (> 100ms)

### Rate Limiting
- Configurable rate limits per API
- Automatic retry with exponential backoff
- Request queuing for burst handling
## Development

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Contributing
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Advanced Usage

### Custom Pin Types
Extend the GeoPin interface to add custom pin types:

```typescript
interface CustomGeoPin extends GeoPin {
  type: 'restaurant';
  data: {
    cuisine: string[];
    priceRange: '$' | '$$' | '$$$';
    michelin_stars?: number;
    dietary_options: string[];
  };
}
```
### Spatial Queries
Use complex spatial relationships:

```typescript
// Find all historic landmarks visible from a viewpoint
const visible = await mcp.query({
  type: 'visible_from',
  geometry: viewpointLocation,
  filters: {
    categories: ['landmark', 'monument'],
    minRating: 4.0
  }
});
```

### Batch Operations
Process multiple locations efficiently:

```typescript
const enrichedLocations = await mcp.batchEnrich([
  { lat: 51.5074, lng: -0.1278 },
  { lat: 48.8566, lng: 2.3522 },
  { lat: 41.9028, lng: 12.4964 }
]);
```

## Troubleshooting

### Common Issues

1. **Rate Limit Errors**
   - Check API quotas
   - Implement caching
   - Use batch requests
2. **Timeout Errors**
   - Increase timeout values
   - Check network connectivity
   - Verify API endpoints

3. **Invalid Coordinates**
   - Validate lat/lng ranges
   - Check coordinate order (lng, lat for GeoJSON)

### Debug Mode
Enable detailed logging:
```bash
LOG_LEVEL=debug npm run dev
```

## License

MIT License - see LICENSE file for details

## Support

- Documentation: https://docs.geocontext-mcp.dev
- Issues: https://github.com/your-org/geocontext-mcp-server/issues
- Discord: https://discord.gg/geocontext

## Roadmap

- [ ] Real-time collaboration features
- [ ] AR/VR integration APIs
- [ ] Machine learning for interest prediction
- [ ] Offline mode with local database
- [ ] GraphQL API endpoint
- [ ] WebSocket support for live updates