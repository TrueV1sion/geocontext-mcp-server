#!/bin/bash

# Build and test script for GeoContext MCP Server

echo "🚀 GeoContext MCP Server - Build & Test Script"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
        exit 1
    fi
}

# Check Node.js version
echo -e "\n${YELLOW}Checking Node.js version...${NC}"
node_version=$(node -v)
echo "Node.js version: $node_version"

# Install dependencies
echo -e "\n${YELLOW}Installing dependencies...${NC}"
npm install
print_status $? "Dependencies installed"

# Build TypeScript
echo -e "\n${YELLOW}Building TypeScript...${NC}"
npm run build
print_status $? "TypeScript build complete"

# Run tests
echo -e "\n${YELLOW}Running tests...${NC}"
npm test
print_status $? "All tests passed"

# Check for .env file
echo -e "\n${YELLOW}Checking configuration...${NC}"
if [ -f .env ]; then
    echo -e "${GREEN}✓${NC} .env file exists"
    
    # Check for API keys
    if grep -q "OPENROUTE_API_KEY=your" .env; then
        echo -e "${YELLOW}⚠${NC} Warning: OPENROUTE_API_KEY not configured"
        echo "  Add your API key to .env for full routing functionality"
    fi
else
    echo -e "${YELLOW}⚠${NC} .env file not found"
    echo "  Creating from template..."
    cp .env.example .env
    echo -e "${GREEN}✓${NC} .env file created from template"
    echo "  Please add your API keys to .env"
fi

echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}Build and test complete!${NC}"
echo -e "${GREEN}================================${NC}"

echo -e "\nNext steps:"
echo "1. Add API keys to .env file (optional but recommended)"
echo "2. Run 'npm run dev' for development mode"
echo "3. Run 'npm start' for production mode"
echo "4. Configure your MCP client to connect to this server"

echo -e "\nMCP Client Configuration:"
echo '{'
echo '  "mcpServers": {'
echo '    "geocontext": {'
echo '      "command": "node",'
echo '      "args": ["'$(pwd)'/build/index.js"]'
echo '    }'
echo '  }'
echo '}'
