@echo off
REM Build and test script for GeoContext MCP Server

echo ================================================
echo GeoContext MCP Server - Build and Test Script
echo ================================================
echo.

REM Check Node.js version
echo Checking Node.js version...
node -v
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed or not in PATH
    exit /b 1
)
echo.

REM Install dependencies
echo Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install dependencies
    exit /b 1
)
echo Dependencies installed successfully!
echo.

REM Build TypeScript
echo Building TypeScript...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: TypeScript build failed
    exit /b 1
)
echo TypeScript build complete!
echo.

REM Run tests
echo Running tests...
call npm test
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Some tests failed
    echo Please review the test output above
) else (
    echo All tests passed!
)
echo.

REM Check for .env file
echo Checking configuration...
if exist .env (
    echo .env file exists
    
    REM Check if API key is configured
    findstr /C:"OPENROUTE_API_KEY=your" .env >nul
    if %ERRORLEVEL% EQU 0 (
        echo WARNING: OPENROUTE_API_KEY not configured
        echo Add your API key to .env for full routing functionality
    )
) else (
    echo .env file not found
    echo Creating from template...
    copy .env.example .env
    echo .env file created from template
    echo Please add your API keys to .env
)
echo.

echo ================================
echo Build and test complete!
echo ================================
echo.

echo Next steps:
echo 1. Add API keys to .env file (optional but recommended)
echo 2. Run 'npm run dev' for development mode
echo 3. Run 'npm start' for production mode
echo 4. Configure your MCP client to connect to this server
echo.

echo MCP Client Configuration for Claude Desktop:
echo {
echo   "mcpServers": {
echo     "geocontext": {
echo       "command": "node",
echo       "args": ["%CD%\build\index.js"]
echo     }
echo   }
echo }

pause
