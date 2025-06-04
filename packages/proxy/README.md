# AccountSystem Proxy

A configurable TypeScript proxy server for microservices architectures. Features JSON-based configuration, WebSocket support, flexible routing, and a simple CLI.

## Quick Start

Install globally:

```bash
npm install -g @accountsystem/proxy
```

Create a configuration file `proxy-config.json`:

```json
{
  "port": 8080,
  "services": {
    "backend": {
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

Start the proxy:

```bash
accountsystem-proxy proxy-config.json
```

Your proxy server is now running on `http://localhost:8080`.

## Installation

### Global Installation (Recommended)

```bash
npm install -g @accountsystem/proxy
```

### Local Installation

```bash
npm install @accountsystem/proxy
```

### Use without installation

```bash
npx @accountsystem/proxy proxy-config.json
```

## Features

- Simple command line interface
- JSON-based configuration
- Multiple service support
- Flexible routing (exact, prefix, regex)
- WebSocket proxying
- Cookie path and domain rewriting
- HTTPS/SSL support
- Request and response logging
- CORS handling
- Custom headers
- Production ready

## CLI Usage

```bash
# Start proxy with configuration file
accountsystem-proxy <config-file>

# Short alias
asp <config-file>

# Show help
accountsystem-proxy --help

# Show version
accountsystem-proxy --version
```

## Configuration

For complete configuration options, see [CONFIGURATION.md](CONFIGURATION.md).

## Common Use Cases

- Development Environment - Proxy multiple local services
- Microservices Gateway - Route requests to different backend services
- WebSocket Support - Enable real-time communication proxying

## Documentation

[Configuration Reference](CONFIGURATION.md) - Complete configuration options

## Contributing

Contributions are welcome! Please submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Links

- [Repository](https://github.com/0-kodiya-0/AccountSystem)
- [Issues](https://github.com/0-kodiya-0/AccountSystem/issues)
- [NPM Package](https://www.npmjs.com/package/@accountsystem/proxy)
