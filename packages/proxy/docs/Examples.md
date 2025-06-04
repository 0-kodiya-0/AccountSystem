# AccountSystem Proxy Examples

This document provides practical examples and use cases for the AccountSystem Proxy server.

## Development Environment

Perfect for local development when you have multiple services running on different ports.

```json
{
  "port": 8080,
  "logging": {
    "enabled": true,
    "level": "info",
    "requests": true
  },
  "services": {
    "api": {
      "target": "http://localhost:3000",
      "pathPrefix": "/api"
    },
    "frontend": {
      "target": "http://localhost:5173",
      "pathPrefix": "/"
    }
  },
  "defaultService": "frontend"
}
```

With this configuration:
- Frontend at `http://localhost:5173` is served at `/`
- Backend API at `http://localhost:3000` is accessible at `/api/*`
- All requests go through `http://localhost:8080`

## Microservices Gateway

Use as an API gateway to route requests to different microservices.

```json
{
  "port": 80,
  "cors": {
    "origin": ["https://your-frontend.com"],
    "credentials": true,
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
  },
  "services": {
    "auth-service": {
      "target": "http://auth-service:3000",
      "pathPrefix": "/auth",
      "headers": {
        "X-Service-Name": "auth-service"
      }
    },
    "user-service": {
      "target": "http://user-service:3001",
      "pathPrefix": "/users",
      "headers": {
        "X-Service-Name": "user-service"
      }
    },
    "order-service": {
      "target": "http://order-service:3002",
      "pathPrefix": "/orders",
      "headers": {
        "X-Service-Name": "order-service"
      }
    },
    "notification-service": {
      "target": "http://notification-service:3003",
      "pathPrefix": "/notifications",
      "headers": {
        "X-Service-Name": "notification-service"
      }
    }
  }
}
```

## WebSocket Support

Enable WebSocket proxying for real-time applications.

```json
{
  "port": 8080,
  "services": {
    "realtime-api": {
      "target": "http://localhost:3000",
      "pathPrefix": "/api",
      "websocket": true,
      "headers": {
        "X-Service-Name": "realtime-api"
      },
      "routes": [
        {
          "path": "/socket.io",
          "type": "prefix",
          "websocket": true
        },
        {
          "path": "/ws",
          "type": "prefix",
          "websocket": true
        }
      ]
    },
    "frontend": {
      "target": "http://localhost:5173",
      "pathPrefix": "/"
    }
  },
  "defaultService": "frontend"
}
```

## Multi-Version API

Support multiple API versions with regex routing.

```json
{
  "port": 8080,
  "services": {
    "api-v1": {
      "target": "http://api-v1-service:3000",
      "routes": [
        {
          "path": "/api/v1/.*",
          "type": "regex"
        }
      ]
    },
    "api-v2": {
      "target": "http://api-v2-service:3001",
      "routes": [
        {
          "path": "/api/v2/.*",
          "type": "regex"
        }
      ]
    },
    "api-latest": {
      "target": "http://api-latest-service:3002",
      "routes": [
        {
          "path": "/api/latest/.*",
          "type": "regex"
        },
        {
          "path": "/api/.*",
          "type": "regex"
        }
      ]
    }
  }
}
```

## Frontend with Multiple APIs

Serve a frontend application with multiple backend APIs.

```json
{
  "port": 8080,
  "cors": {
    "origin": ["http://localhost:5173"],
    "credentials": true
  },
  "services": {
    "auth-api": {
      "target": "http://localhost:3001",
      "pathPrefix": "/auth",
      "cookieConfig": {
        "pathRewrite": {
          "/auth/": "/"
        }
      }
    },
    "data-api": {
      "target": "http://localhost:3002",
      "pathPrefix": "/api/data"
    },
    "upload-api": {
      "target": "http://localhost:3003",
      "pathPrefix": "/api/upload"
    },
    "frontend": {
      "target": "http://localhost:5173",
      "pathPrefix": "/"
    }
  },
  "defaultService": "frontend"
}
```

## Load Balancing (Simple Round Robin)

Distribute requests across multiple instances of the same service.

```json
{
  "port": 8080,
  "services": {
    "api-instance-1": {
      "target": "http://api-server-1:3000",
      "routes": [
        {
          "path": "/api/users/.*",
          "type": "regex"
        }
      ]
    },
    "api-instance-2": {
      "target": "http://api-server-2:3000",
      "routes": [
        {
          "path": "/api/orders/.*",
          "type": "regex"
        }
      ]
    },
    "api-instance-3": {
      "target": "http://api-server-3:3000",
      "routes": [
        {
          "path": "/api/products/.*",
          "type": "regex"
        }
      ]
    }
  }
}
```

## HTTPS/SSL Configuration

Enable HTTPS with SSL certificates.

```json
{
  "port": 443,
  "ssl": {
    "enabled": true,
    "key": "/etc/ssl/private/server.key",
    "cert": "/etc/ssl/certs/server.crt",
    "ca": "/etc/ssl/certs/ca.crt"
  },
  "logging": {
    "enabled": true,
    "level": "warn",
    "errors": true
  },
  "services": {
    "secure-api": {
      "target": "http://localhost:3000",
      "pathPrefix": "/api",
      "headers": {
        "X-Forwarded-Proto": "https"
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

## Complex Routing with Headers

Advanced routing with custom headers and cookie handling.

```json
{
  "port": 8080,
  "cors": {
    "origin": ["http://localhost:3000", "https://app.example.com"],
    "credentials": true,
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
  },
  "services": {
    "admin-api": {
      "target": "http://admin-service:3000",
      "routes": [
        {
          "path": "/admin/.*",
          "type": "regex",
          "headers": {
            "X-Admin-Request": "true",
            "X-Service-Route": "admin"
          }
        }
      ],
      "cookieConfig": {
        "pathRewrite": {
          "/admin/": "/"
        },
        "domainRewrite": true
      }
    },
    "public-api": {
      "target": "http://public-service:3001",
      "pathPrefix": "/api",
      "headers": {
        "X-Public-Request": "true",
        "X-Service-Route": "public"
      },
      "routes": [
        {
          "path": "/api/public/.*",
          "type": "regex"
        },
        {
          "path": "/api/health",
          "type": "exact"
        }
      ]
    },
    "websocket-service": {
      "target": "http://ws-service:3002",
      "websocket": true,
      "routes": [
        {
          "path": "/ws",
          "type": "prefix",
          "websocket": true
        },
        {
          "path": "/socket.io",
          "type": "prefix",
          "websocket": true
        }
      ]
    },
    "spa": {
      "target": "http://frontend:5173",
      "pathPrefix": "/"
    }
  },
  "defaultService": "spa"
}
```

## Docker Environment

Configuration for Docker containerized services.

```json
{
  "port": 8080,
  "logging": {
    "enabled": true,
    "level": "info",
    "requests": true,
    "errors": true
  },
  "cors": {
    "origin": ["http://localhost:3000"],
    "credentials": true
  },
  "services": {
    "backend": {
      "target": "http://backend:3000",
      "pathPrefix": "/api",
      "headers": {
        "X-Forwarded-Host": "localhost:8080",
        "X-Service-Name": "backend"
      }
    },
    "database-admin": {
      "target": "http://db-admin:8080",
      "pathPrefix": "/admin"
    },
    "monitoring": {
      "target": "http://monitoring:3001",
      "pathPrefix": "/metrics"
    },
    "frontend": {
      "target": "http://frontend:5173",
      "pathPrefix": "/"
    }
  },
  "defaultService": "frontend"
}
```

## Testing Environment

Configuration for testing with multiple environments.

```json
{
  "port": 8080,
  "logging": {
    "enabled": true,
    "level": "debug",
    "requests": true,
    "responses": true,
    "errors": true
  },
  "services": {
    "test-api": {
      "target": "http://localhost:3001",
      "pathPrefix": "/api/test",
      "headers": {
        "X-Environment": "test",
        "X-Test-Mode": "true"
      }
    },
    "staging-api": {
      "target": "http://staging-server:3000",
      "pathPrefix": "/api/staging",
      "headers": {
        "X-Environment": "staging"
      }
    },
    "mock-api": {
      "target": "http://localhost:3002",
      "pathPrefix": "/api/mock",
      "headers": {
        "X-Environment": "mock",
        "X-Mock-Data": "true"
      }
    },
    "test-frontend": {
      "target": "http://localhost:5173",
      "pathPrefix": "/"
    }
  },
  "defaultService": "test-frontend"
}
```

## Common Patterns

### Health Check Route

```json
{
  "routes": [
    {
      "path": "/health",
      "type": "exact",
      "target": "http://health-service:3000"
    }
  ]
}
```

### API Versioning

```json
{
  "routes": [
    {
      "path": "/api/v\\d+/.*",
      "type": "regex"
    }
  ]
}
```

### Static Files

```json
{
  "routes": [
    {
      "path": "/static/.*",
      "type": "regex",
      "target": "http://cdn-server:3000"
    }
  ]
}
```

### Authentication Bypass

```json
{
  "routes": [
    {
      "path": "/api/public/.*",
      "type": "regex",
      "headers": {
        "X-Public-Route": "true"
      }
    }
  ]
}
```

These examples demonstrate the flexibility and power of the AccountSystem Proxy for various use cases and deployment scenarios.