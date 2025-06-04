# Proxy Configuration Reference

This document describes the complete configuration options for the AccountSystem Proxy server. The configuration is defined in a JSON file that you pass to the proxy when starting it.

## Configuration File Structure

```json
{
  "port": 8080,
  "ssl": { ... },
  "logging": { ... },
  "cors": { ... },
  "services": { ... },
  "defaultService": "service-name"
}
```

## Root Level Properties

### `port` (required)

- **Type**: `number`
- **Description**: The port number on which the proxy server will listen
- **Example**: `8080`, `3000`, `80`

```json
{
  "port": 8080
}
```

### `ssl` (optional)

- **Type**: `object`
- **Description**: SSL/TLS configuration for HTTPS support
- **Default**: Disabled (HTTP only)

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

#### SSL Properties

- `enabled` (boolean): Whether to enable HTTPS
- `key` (string): Path to private key file
- `cert` (string): Path to certificate file
- `ca` (string, optional): Path to CA certificate file

### `logging` (optional)

- **Type**: `object`
- **Description**: Logging configuration
- **Default**: Basic logging enabled

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

#### Logging Properties

- `enabled` (boolean): Enable/disable logging
- `level` (string): Log level - `"debug"`, `"info"`, `"warn"`, `"error"`
- `requests` (boolean): Log incoming requests
- `responses` (boolean): Log responses from services
- `errors` (boolean): Log errors

### `cors` (optional)

- **Type**: `object`
- **Description**: Global CORS configuration
- **Default**: No CORS headers

```json
{
  "cors": {
    "origin": ["http://localhost:3000", "http://localhost:5173"],
    "credentials": true,
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
  }
}
```

#### CORS Properties

- `origin` (string|array|boolean): Allowed origins
- `credentials` (boolean): Allow credentials
- `methods` (array): Allowed HTTP methods

### `services` (required)

- **Type**: `object`
- **Description**: Configuration for backend services
- **Format**: `{ "service-name": ServiceConfig, ... }`

### `defaultService` (optional)

- **Type**: `string`
- **Description**: Service name to use for unmatched routes
- **Default**: 404 for unmatched routes

```json
{
  "defaultService": "frontend"
}
```

## Service Configuration

Each service in the `services` object has the following structure:

```json
{
  "services": {
    "service-name": {
      "target": "http://localhost:3000",
      "pathPrefix": "/api",
      "websocket": true,
      "headers": { ... },
      "routes": [ ... ],
      "cookieConfig": { ... },
      "cors": { ... }
    }
  }
}
```

### Service Properties

#### `target` (required)

- **Type**: `string`
- **Description**: The URL of the backend service
- **Format**: Must be a valid URL with protocol

```json
{
  "target": "http://localhost:3000"
}
```

#### `pathPrefix` (optional)

- **Type**: `string`
- **Description**: URL path prefix for this service
- **Default**: No prefix (matches all paths)

```json
{
  "pathPrefix": "/api"
}
```

#### `websocket` (optional)

- **Type**: `boolean`
- **Description**: Enable WebSocket proxying for this service
- **Default**: `false`

```json
{
  "websocket": true
}
```

#### `headers` (optional)

- **Type**: `object`
- **Description**: Custom headers to add to requests sent to this service
- **Format**: `{ "header-name": "header-value", ... }`

```json
{
  "headers": {
    "X-Service-Name": "auth-service",
    "X-Custom-Header": "value"
  }
}
```

#### `routes` (optional)

- **Type**: `array`
- **Description**: Specific route configurations for this service
- **Default**: Uses `pathPrefix` for all routes

#### `cookieConfig` (optional)

- **Type**: `object`
- **Description**: Cookie rewriting configuration

#### `cors` (optional)

- **Type**: `object`
- **Description**: Service-specific CORS configuration (overrides global)

## Route Configuration

Routes allow you to define specific path matching rules within a service:

```json
{
  "routes": [
    {
      "path": "/socket.io",
      "type": "prefix",
      "websocket": true,
      "headers": { ... },
      "target": "http://different-server:3001"
    }
  ]
}
```

### Route Properties

#### `path` (required)

- **Type**: `string`
- **Description**: The path pattern to match
- **Format**: Depends on `type`

#### `type` (optional)

- **Type**: `string`
- **Description**: How to match the path
- **Values**: `"exact"`, `"prefix"`, `"regex"`
- **Default**: `"prefix"`

##### Route Types

**Exact Match:**

```json
{
  "path": "/api/v1/auth/login",
  "type": "exact"
}
```

Matches only the exact path.

**Prefix Match:**

```json
{
  "path": "/api/v1/users",
  "type": "prefix"
}
```

Matches any path starting with the prefix.

**Regex Match:**

```json
{
  "path": "/api/v\\d+/.*",
  "type": "regex"
}
```

Matches paths using regular expression.

#### `websocket` (optional)

- **Type**: `boolean`
- **Description**: Enable WebSocket for this specific route
- **Default**: Inherits from service

#### `headers` (optional)

- **Type**: `object`
- **Description**: Additional headers for this route
- **Note**: Merged with service headers

#### `target` (optional)

- **Type**: `string`
- **Description**: Override target URL for this route
- **Default**: Uses service target

## Cookie Configuration

Configure how cookies are rewritten when proxying:

```json
{
  "cookieConfig": {
    "pathRewrite": {
      "/api/": "/"
    },
    "domainRewrite": true
  }
}
```

### Cookie Properties

#### `pathRewrite` (optional)

- **Type**: `object`
- **Description**: Rewrite cookie paths
- **Format**: `{ "from-path": "to-path", ... }`

```json
{
  "pathRewrite": {
    "/api/": "/",
    "/admin/": "/dashboard/"
  }
}
```

#### `domainRewrite` (optional)

- **Type**: `boolean|object`
- **Description**: Rewrite cookie domains
- **Values**:
  - `true`: Remove domain from cookies
  - `false`: Keep original domains
  - `object`: Domain mapping

```json
{
  "domainRewrite": {
    "api.example.com": "localhost",
    "auth.example.com": "localhost"
  }
}
```

## Complete Example

```json
{
  "port": 8080,
  "ssl": {
    "enabled": false
  },
  "logging": {
    "enabled": true,
    "level": "info",
    "requests": true,
    "responses": false,
    "errors": true
  },
  "cors": {
    "origin": [
      "http://localhost:3000",
      "http://localhost:5173"
    ],
    "credentials": true,
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
  },
  "services": {
    "auth-backend": {
      "target": "http://localhost:3000",
      "pathPrefix": "/api",
      "websocket": true,
      "headers": {
        "X-Service-Name": "auth-backend"
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
          "/api/": "/"
        },
        "domainRewrite": true
      }
    },
    "frontend": {
      "target": "http://localhost:5173",
      "pathPrefix": "/",
      "headers": {
        "X-Service-Name": "frontend"
      }
    }
  },
  "defaultService": "frontend"
}
```

## Validation Rules

The proxy validates the configuration file before starting:

### Required Fields

- `port` must be a valid port number (1-65535)
- `services` must be an object with at least one service
- Each service must have a valid `target` URL

### Optional Field Validation

- `ssl.key`, `ssl.cert`, `ssl.ca` must be valid file paths if SSL is enabled
- Route `path` with `type: "regex"` must be valid regular expressions
- CORS `origin` values must be valid URLs or `*`
- `pathPrefix` must start with `/`

### Common Errors

- **Invalid target URL**: Service target must include protocol (http:// or https://)
- **Invalid regex**: Route with `type: "regex"` has malformed regular expression
- **Missing SSL files**: SSL enabled but certificate files don't exist
- **Port in use**: Specified port is already in use by another process

## Best Practices

1. **Service Organization**: Group related routes under the same service
2. **Path Specificity**: Put more specific routes before general ones
3. **SSL in Production**: Always enable SSL for production deployments
4. **Logging Levels**: Use `"error"` level in production for performance
5. **CORS Security**: Be specific with allowed origins, avoid using `*` in production
6. **WebSocket Paths**: Explicitly configure WebSocket routes (e.g., `/socket.io`)
7. **Cookie Security**: Use `domainRewrite` to handle cross-domain cookies properly

## Troubleshooting

### Configuration Not Loading

- Verify JSON syntax is valid
- Check file permissions
- Ensure file path is correct

### Service Connection Errors

- Verify target services are running
- Check target URLs are accessible
- Confirm firewall/network settings

### WebSocket Issues

- Enable `websocket: true` for services using WebSocket
- Add specific routes for WebSocket paths
- Check if target service supports WebSocket upgrades

### Cookie Problems

- Configure `cookieConfig` for path/domain mismatches
- Check if cookies are being set with correct paths
- Verify CORS credentials setting

### CORS Errors

- Add your frontend domain to `cors.origin`
- Enable `credentials: true` if using cookies
- Check HTTP methods are allowed
