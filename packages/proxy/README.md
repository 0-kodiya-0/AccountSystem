# Proxy Server

A powerful, configurable TypeScript proxy server designed for microservices architectures. Features JSON-based configuration, WebSocket support, flexible routing, and comprehensive logging with a clean functional architecture.

## Features

- 🔧 **JSON Configuration** - Simple JSON-based configuration
- 🌐 **Multiple Service Support** - Proxy to multiple backend services
- 🔀 **Flexible Routing** - Exact, prefix, and regex route matching
- 🔌 **WebSocket Support** - Full WebSocket proxying capabilities
- 🍪 **Cookie Management** - Configurable cookie path and domain rewriting
- 🔒 **HTTPS Support** - Optional SSL/TLS termination
- 📝 **Request/Response Logging** - Comprehensive logging and monitoring
- 🎯 **CORS Handling** - Global and per-service CORS configuration
- ⚡ **Development Hot Reload** - Auto-restart with nodemon
- 🏷️ **Custom Headers** - Per-service and per-route header injection
- 🚀 **Functional Architecture** - Clean, maintainable functional programming approach

## Installation

```bash
cd packages/proxy
npm install
```

## Quick Start

### 1. Create Configuration

Copy the example configuration:

```bash
cp example-config.json proxy-config.json
```

### 2. Start the Proxy

Development mode with auto-restart:

```bash
npm run dev
```

Production mode:

```bash
npm run build
npm start
```

### 3. Custom Config File

Specify a custom configuration file:

```bash
npm run dev -- my-custom-config.json
```

## Configuration

### Basic Structure

```json
{
  "port": 8080,
  "ssl": { ... },
  "logging": { ... },
  "cors": { ... },
  "services": { ... },
  "defaultService": "frontend"
}
```

### Service Configuration

```json
{
  "services": {
    "service-name": {
      "target": "http://localhost:3000",
      "pathPrefix": "/api/v1",
      "websocket": true,
      "headers": {
        "X-Service-Name": "my-service"
      },
      "routes": [...],
      "cookieConfig": {...},
      "cors": {...}
    }
  }
}
```

### Route Types

**Exact Match:**

```json
{
  "path": "/api/v1/auth/login",
  "type": "exact"
}
```

**Prefix Match (default):**

```json
{
  "path": "/api/v1/users",
  "type": "prefix"
}
```

**Regex Match:**

```json
{
  "path": "/api/v\\d+/.*",
  "type": "regex"
}
```

### SSL Configuration

```json
{
  "ssl": {
    "enabled": true,
    "key": "./certs/server.key",
    "cert": "./certs/server.crt",
    "ca": "./certs/ca.crt"
  }
}
```

### Cookie Configuration

```json
{
  "cookieConfig": {
    "pathRewrite": {
      "/([^;]*)": "/api/v1/$1"
    },
    "domainRewrite": true
  }
}
```

### CORS Configuration

**Global CORS:**

```json
{
  "cors": {
    "origin": ["http://localhost:5173", "http://localhost:3000"],
    "credentials": true,
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
  }
}
```

**Service-specific CORS:**

```json
{
  "services": {
    "auth-service": {
      "cors": {
        "origin": ["http://localhost:5173"],
        "credentials": true
      }
    }
  }
}
```

### Logging Configuration

```json
{
  "logging": {
    "enabled": true,
    "level": "info",
    "requests": true,
    "responses": false,
    "errors": true
  }
}
```

## Example Configuration

```json
{
  "port": 8080,
  "logging": {
    "enabled": true,
    "level": "info",
    "requests": true,
    "responses": false,
    "errors": true
  },
  "cors": {
    "origin": ["http://localhost:5173"],
    "credentials": true,
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
  },
  "services": {
    "auth-service": {
      "target": "http://localhost:3000",
      "pathPrefix": "/api/v1",
      "websocket": true,
      "headers": {
        "X-Service-Name": "auth-service"
      },
      "routes": [
        {
          "path": "/socket.io",
          "type": "prefix",
          "websocket": true
        },
        {
          "path": "/auth/.*",
          "type": "regex"
        }
      ],
      "cookieConfig": {
        "pathRewrite": {
          "/([^;]*)": "/api/v1/$1"
        },
        "domainRewrite": true
      }
    },
    "frontend": {
      "target": "http://localhost:5173",
      "pathPrefix": "/"
    }
  },
  "defaultService": "frontend"
}
```

## Development

### Hot Reload

The proxy automatically restarts when you change:

- Source files (`.ts` files)
- Configuration files (`.json` files)

This is handled by nodemon, so no manual configuration reloading is needed.

### Scripts

```bash
# Development with auto-restart
npm run dev

# Development with custom config
npm run dev -- my-config.json

# Build TypeScript
npm run build

# Start production server
npm start

# Start with custom config
npm start my-config.json

# Lint code
npm run lint

# Clean dist folder
npm run clean
```

## Architecture

### Functional Design

The proxy uses a **functional programming approach** for:

- **Simplicity**: Easy to understand linear flow
- **Maintainability**: Pure functions with single responsibilities
- **Testability**: Each function can be tested in isolation
- **Reliability**: No complex object state management

### Key Functions

- `startProxy()` - Main entry point to start the server
- `stopProxy()` - Graceful shutdown
- `loadConfig()` - Load and validate configuration
- `setupRoutes()` - Configure all service routes
- `createProxyMiddleware()` - Create proxy for individual services

### State Management

Simple global state object:

```typescript
const state = {
    config: ProxyConfig | null,
    server: Server | null, 
    proxies: Map<string, any>
}
```

## WebSocket Support

WebSocket connections are automatically upgraded for services with:

```json
{
  "websocket": true
}
```

Or specific routes:

```json
{
  "routes": [
    {
      "path": "/socket.io",
      "websocket": true
    }
  ]
}
```

## Production Deployment

### Environment Variables

```bash
# Create production config
cp example-config.json production-config.json

# Edit for production
# - Update service targets
# - Configure SSL if needed
# - Set appropriate logging level
```

### SSL/TLS Setup

```json
{
  "ssl": {
    "enabled": true,
    "key": "/path/to/private.key",
    "cert": "/path/to/certificate.crt",
    "ca": "/path/to/ca-bundle.crt"
  }
}
```

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY production-config.json ./

EXPOSE 8080
CMD ["node", "dist/index.js", "production-config.json"]
```

## Troubleshooting

### Common Issues

**Port already in use:**

```bash
# Check what's using the port
lsof -i :8080

# Kill the process
kill -9 <PID>
```

**SSL Certificate errors:**

- Ensure certificate files exist and are readable
- Check certificate validity
- Verify CA chain is complete

**Service connection errors:**

- Verify target services are running
- Check firewall settings
- Ensure network connectivity

### Debugging

Enable debug logging:

```json
{
  "logging": {
    "enabled": true,
    "level": "debug",
    "requests": true,
    "responses": true,
    "errors": true
  }
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes following functional programming principles
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Perfect for microservices!** This proxy server provides a clean, functional approach to routing requests between your services with comprehensive configuration options and reliable performance.
