// Real-World Usage Examples for GeoContext MCP Server

import { Client } from '@modelcontextprotocol/sdk/client/index.js';

// Example 1: AI-Powered City Tour Guide
class AITourGuide {
  private mcpClient: Client;
  private currentTour: any;
  
  async createPersonalizedTour(userPreferences: {
    interests: string[];
    duration: number; // hours
    accessibility: string[];
    startLocation: { lat: number; lng: number };
  }) {
    // Generate route based on interests and time constraints
    const route = await this.mcpClient.callTool('generate_route', {
      start: userPreferences.startLocation,
      end: userPreferences.startLocation, // Circular route
      profile: userPreferences.accessibility.includes('wheelchair') ? 'wheelchair' : 'walking',
      interests: userPreferences.interests,
      bufferRadius: 200, // Tighter radius for walking tours
    });
    
    // Get detailed context for each stop
    const stops = await this.enrichTourStops(route.pins);
    
    // Generate AI narrative
    const narrative = await this.generateTourNarrative(stops, userPreferences);    
    return {
      route: route.route,
      stops,
      narrative,
      estimatedDuration: this.calculateDuration(route, stops),
    };
  }
  
  private async enrichTourStops(pins: any[]) {
    const enrichedStops = [];
    
    for (const pin of pins) {
      const enriched = await this.mcpClient.callTool('enrich_location', {
        location: pin.location,
        sources: ['wikipedia', 'wikidata', 'cultural_heritage'],
      });
      
      enrichedStops.push({
        ...pin,
        enrichedData: enriched,
        visitDuration: this.estimateVisitDuration(pin),
      });
    }
    
    return enrichedStops;
  }