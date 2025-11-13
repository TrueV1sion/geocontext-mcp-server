# Getting Started Guide

Welcome to GeoContext MCP Server! This guide will help you set up and start using the server in your AI applications.

## Prerequisites

- Node.js 18 or higher
- npm or yarn package manager
- API keys for external services (optional but recommended)

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/geocontext-mcp-server.git
   cd geocontext-mcp-server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your API keys:
   - `OPENROUTE_API_KEY` - For route generation
   - `MAPBOX_API_KEY` - Alternative routing service
   - Other optional keys for enhanced features

4. **Build the project**
   ```bash
   npm run build
   ```
## Configuration

### MCP Client Setup

Add the server to your MCP client configuration:

```json
{
  "mcpServers": {
    "geocontext": {
      "command": "node",
      "args": ["C:/path/to/geocontext-mcp-server/build/index.js"],
      "env": {
        "OPENROUTE_API_KEY": "your_api_key"
      }
    }
  }
}
```

### Claude Desktop Configuration

For Claude Desktop users:
1. Open Claude Desktop settings
2. Navigate to MCP Servers
3. Add the GeoContext server configuration
4. Restart Claude Desktop

## Basic Usage

### Your First Query

Try these natural language queries:

```
"Show me interesting places within 500 meters of the Eiffel Tower"

"Create a walking tour from the British Museum to Covent Garden"

"What historical events happened near Times Square?"
```