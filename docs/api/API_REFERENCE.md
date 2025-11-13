# API Reference

## Tools

### generate_route

Generate a context-rich navigation route between two points.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start` | `{lat: number, lng: number}` | Yes | Starting location |
| `end` | `{lat: number, lng: number}` | Yes | Destination |
| `waypoints` | `Array<{lat: number, lng: number}>` | No | Intermediate stops |
| `profile` | `string` | No | Travel mode: `driving`, `walking`, `cycling`, `wheelchair` |
| `interests` | `string[]` | No | Filter POIs by interests |
| `bufferRadius` | `number` | No | Search radius in meters (default: 500) |

#### Response

```json
{
  "routeId": "route_1234567_abc",
  "route": {
    "distance": 5000,
    "duration": 600,
    "coordinates": [[lng, lat], ...]
  },
  "contextualPins": 42,
  "pins": [...],
  "message": "Generated route with 42 contextual points of interest"
}
```
### get_nearby_context

Retrieve contextual information for a specific location.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `location` | `{lat: number, lng: number}` | Yes | Center point |
| `radius` | `number` | No | Search radius in meters (default: 1000) |
| `types` | `string[]` | No | Filter by pin types |
| `maxResults` | `number` | No | Maximum pins to return (default: 50) |

#### Pin Types
- `poi` - Points of Interest
- `historical` - Historical sites
- `landmark` - Notable landmarks
- `event` - Temporary events
- `cultural` - Cultural locations
- `natural` - Natural features

#### Response

```json
{
  "location": {"lat": 51.5074, "lng": -0.1278},
  "radius": 1000,
  "totalPins": 25,
  "pins": [
    {
      "id": "pin_123_abc",
      "location": {"lat": 51.5080, "lng": -0.1281},
      "distance": 120,
      "type": "historical",
      "data": {...}
    }
  ]
}
```
### create_geopin

Create a custom geo-pin with contextual information.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `location` | `{lat: number, lng: number}` | Yes | Pin location |
| `radius` | `number` | No | Activation radius (default: 100m) |
| `type` | `string` | Yes | Pin type (see types above) |
| `data` | `object` | Yes | Pin information |
| `data.name` | `string` | Yes | Pin name |
| `data.description` | `string` | Yes | Pin description |
| `data.category` | `string[]` | No | Categories |

#### Response

```json
{
  "message": "Geo-pin created successfully",
  "pin": {
    "id": "pin_456_def",
    "location": {"lat": 51.5074, "lng": -0.1278},
    "radius": 100,
    "type": "cultural",
    "data": {...},
    "metadata": {...}
  }
}
```