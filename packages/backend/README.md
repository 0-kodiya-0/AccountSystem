# AccountSystem Backend Server

A complete, production-ready authentication microservice with OAuth, local authentication, 2FA, and real-time notifications. Built with Express.js, MongoDB, and Socket.IO.

## Overview

AccountSystem Backend Server provides secure, scalable authentication infrastructure for modern web applications. It supports multiple authentication methods, advanced security features, and real-time capabilities out of the box.

## Key Features

- 🔐 **Multiple Authentication**: Local (email/password) and OAuth (Google, Microsoft, Facebook)
- 🛡️ **Advanced Security**: JWT tokens, 2FA/TOTP, password policies, rate limiting
- 📧 **Email Integration**: Verification, password reset, notifications
- 🔄 **Real-time**: WebSocket notifications and live updates
- 🗄️ **Database**: MongoDB with Mongoose ODM
- 🚀 **Production Ready**: Comprehensive error handling, logging, graceful shutdown
- 🔧 **Internal API**: Secure mTLS server for microservice communication
- ⚙️ **Configurable**: Extensive CLI options and environment variables

## Quick Start

### Installation

```bash
npm install -g @accountsystem/backend-server
```

### Basic Setup

1. **Create environment file** (`.env`):

```bash
# Required
JWT_SECRET=your-super-secret-jwt-key
SESSION_SECRET=your-session-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
API_BASE_PATH=/api
APP_NAME=YourApp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_APP_PASSWORD=your-app-password
SENDER_EMAIL=noreply@yourapp.com
SENDER_NAME=YourApp
MONGODB_USERNAME=your-username
MONGODB_PASSWORD=your-password
```

2. **Start the server**:

```bash
accountsystem-backend
```

Your authentication server is now running at `http://localhost:3000`!

## Usage

### Basic Commands

```bash
# Start with default settings
accountsystem-backend

# Custom port and quiet mode
accountsystem-backend --port 4000 --quiet

# Development mode with debug logging
accountsystem-backend --debug --no-request-logs

# Disable specific features
accountsystem-backend --disable-oauth --disable-notifications
```

### Short Alias

```bash
# Use 'abs' as a shortcut
abs --port 3001 --log-level warn
```

## Architecture

The server consists of two main components:

- **Main HTTP Server**: Handles authentication APIs, user management, and WebSocket connections
- **Internal HTTPS Server**: Secure mTLS endpoint for microservice communication (optional)

## API Endpoints

### Authentication

- `POST /auth/signup` - User registration
- `POST /auth/login` - User login
- `GET /oauth/signin/google` - OAuth sign-in
- `POST /auth/verify-email` - Email verification

### Account Management

- `GET /:accountId/account` - Get account details
- `PATCH /:accountId/account` - Update account
- `POST /:accountId/auth/change-password` - Change password
- `POST /:accountId/auth/setup-two-factor` - Setup 2FA

### Real-time

- WebSocket connections for live notifications
- Account-specific notification channels

## Documentation

- **[CLI Reference](./docs/CLI.md)** - Complete command-line options
- **[Server Configuration](./docs/SERVER.md)** - Detailed server setup and configuration
- **[API Documentation](./docs/API.md)** - Complete API reference
- **[Deployment Guide](./docs/DEPLOYMENT.md)** - Production deployment instructions

## Environment Variables

### Required Variables

- `JWT_SECRET` - Secret for JWT token signing
- `SESSION_SECRET` - Session secret key
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `API_BASE_PATH` - API base URL path
- `APP_NAME` - Application name
- `SMTP_*` - Email configuration
- `MONGODB_USERNAME/PASSWORD` - Database credentials

### Optional Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `PROXY_URL` - Frontend proxy URL
- `INTERNAL_*` - Internal server configuration

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **OAuth Integration**: Google, Microsoft, Facebook support
- **Two-Factor Authentication**: TOTP-based 2FA with backup codes
- **Password Security**: Strength validation, hashing, breach detection
- **Rate Limiting**: Brute force protection
- **Session Management**: Secure cookie-based sessions
- **mTLS Internal API**: Certificate-based authentication for microservices

## Integrations

### Frontend Integration

Works with any frontend framework through REST APIs and WebSocket connections.

### Microservices Integration

Use the Node.js SDK for seamless integration:

```bash
npm install @accountsystem/auth-node-sdk
```

### Proxy Integration

Designed to work behind the AccountSystem Proxy:

```bash
npm install -g @accountsystem/proxy
```

## Development

### Local Development

```bash
git clone https://github.com/0-kodiya-0/AccountSystem.git
cd packages/backend
npm install
npm run dev
```

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

## Support

- **Repository**: [GitHub](https://github.com/0-kodiya-0/AccountSystem)
- **Issues**: [GitHub Issues](https://github.com/0-kodiya-0/AccountSystem/issues)
- **Documentation**: [Full Docs](./docs/)

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Ready to add secure authentication to your application?** Check out the [CLI documentation](./docs/CLI.md) or [server configuration guide](./docs/SERVER.md) to get started.
