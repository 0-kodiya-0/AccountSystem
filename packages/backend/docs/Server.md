# Server Configuration Guide

Comprehensive guide to understanding and configuring the AccountSystem Backend Server functionality.

## Server Architecture

The AccountSystem Backend Server is built with a dual-server architecture to separate public API access from internal microservice communication.

### Main HTTP Server

**Purpose**: Handles all public-facing authentication operations and user interactions.

**Key Responsibilities**:

- User registration and authentication (local and OAuth)
- Session management and token validation
- Account management operations
- Password reset and email verification
- Two-factor authentication setup and verification
- Real-time notifications via WebSocket
- API endpoints for frontend applications

**Default Configuration**:

- **Port**: 3000
- **Protocol**: HTTP
- **Base Path**: Configurable via `BASE_URL` (default: `/api`)
- **WebSocket**: Enabled for real-time features

### Internal HTTPS Server

**Purpose**: Provides secure endpoints for microservice-to-microservice communication.

**Key Responsibilities**:

- Internal service authentication and validation
- User information lookup for other services
- Session validation for distributed architectures
- Google API scope validation
- Secure inter-service communication

**Default Configuration**:

- **Port**: 4443
- **Protocol**: HTTPS with mutual TLS (mTLS)
- **Authentication**: Client certificate validation
- **Base Path**: `/internal`

## Core Features

### Authentication Methods

#### Local Authentication

- **Email/Password**: Traditional username and password authentication
- **Email Verification**: Mandatory email verification for new accounts
- **Password Security**: Bcrypt hashing with salt rounds
- **Password Policies**: Configurable strength requirements
- **Account Lockout**: Protection against brute force attacks

#### OAuth Authentication

- **Google OAuth 2.0**: Primary OAuth provider support
- **Microsoft OAuth**: Optional Microsoft account integration
- **Facebook OAuth**: Optional Facebook account integration
- **Token Management**: Secure OAuth token storage and refresh
- **Scope Management**: Granular permission control

#### Two-Factor Authentication (2FA)

- **TOTP Support**: Time-based one-time password using authenticator apps
- **Backup Codes**: Recovery codes for account access
- **QR Code Generation**: Easy setup with authenticator apps
- **Secure Storage**: Encrypted secret storage

### Session Management

#### JWT Tokens

- **Access Tokens**: Short-lived tokens for API access (default: 1 hour)
- **Refresh Tokens**: Long-lived tokens for token renewal (default: 7 days)
- **Token Wrapping**: OAuth tokens wrapped in JWT for consistency
- **Secure Signing**: Configurable JWT signing algorithms

#### Cookie Management

- **HttpOnly Cookies**: Secure token storage in browser
- **Path-based Cookies**: Account-specific cookie paths
- **SameSite Protection**: CSRF protection via SameSite attribute
- **Secure Flag**: HTTPS-only cookies in production

### Real-time Features

#### WebSocket Notifications

- **Account-specific Channels**: Isolated notification streams
- **Event Types**: Support for various notification types (info, success, warning, error)
- **Real-time Delivery**: Instant notification delivery
- **Persistence**: Database storage for offline users

#### Socket.IO Integration

- **Namespace Support**: Separate namespaces for public and internal use
- **Room Management**: Account-based room joining
- **Fallback Support**: Polling fallback for WebSocket failures

## Environment Configuration

### Required Variables

```env
# Core Security
JWT_SECRET=your-jwt-secret-minimum-32-characters
SESSION_SECRET=your-session-secret-minimum-32-characters

# OAuth Configuration
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret

# Application Settings
BASE_URL=/api
APP_NAME=YourApplicationName

# Email Settings
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_SECURE=false
SMTP_APP_PASSWORD=your-smtp-password
SENDER_EMAIL=noreply@yourdomain.com
SENDER_NAME=YourApp

# Database
MONGODB_USERNAME=your-database-username
MONGODB_PASSWORD=your-database-password
```

### Optional Configuration

```env
# Server Settings
PORT=3000
NODE_ENV=development
PROXY_URL=http://localhost:7000

# Database
ACCOUNTS_DB_URI=mongodb://localhost:27017/accounts

# Token Expiry
ACCESS_TOKEN_EXPIRY=1h
REFRESH_TOKEN_EXPIRY=7d
COOKIE_MAX_AGE=31536000000

# Internal Server
INTERNAL_PORT=4443
INTERNAL_SERVER_ENABLED=true
INTERNAL_SERVER_KEY_PATH=/path/to/server.key
INTERNAL_SERVER_CERT_PATH=/path/to/server.crt
INTERNAL_CA_CERT_PATH=/path/to/ca.crt

# Additional OAuth
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
FACEBOOK_CLIENT_ID=your-facebook-app-id
FACEBOOK_CLIENT_SECRET=your-facebook-app-secret
```

## Feature Controls

### Authentication Features

#### Disable OAuth

```bash
accountsystem-backend --disable-oauth
# or
DISABLE_OAUTH=true
```

**Effect**: Removes all OAuth-related routes and functionality, leaving only local authentication.

#### Disable Local Authentication

```bash
accountsystem-backend --disable-local-auth
# or
DISABLE_LOCAL_AUTH=true
```

**Effect**: Removes email/password authentication, leaving only OAuth methods.

#### Disable Notifications

```bash
accountsystem-backend --disable-notifications
# or
DISABLE_NOTIFICATIONS=true
```

**Effect**: Disables WebSocket notifications and notification storage.

#### Disable Internal Server

```bash
accountsystem-backend --disable-internal
# or
INTERNAL_SERVER_ENABLED=false
```

**Effect**: Completely disables the internal mTLS server.

### Logging Configuration

#### Log Levels

- **debug**: Detailed debugging information
- **info**: General operational messages (default)
- **warn**: Warning messages and potential issues
- **error**: Error messages only

#### Logging Features

- **Request Logging**: HTTP request/response logging
- **Database Logging**: Database operation logging
- **Security Logging**: Authentication and authorization events
- **Performance Logging**: Timing and performance metrics

## Database Schema

### Account Collection

- **User Details**: Name, email, profile information
- **Security Settings**: Password hash, 2FA configuration, session preferences
- **OAuth Data**: Provider information and linked accounts
- **Timestamps**: Account creation and update tracking

### Notification Collection

- **Account Association**: User-specific notifications
- **Message Data**: Title, content, type, and metadata
- **State Management**: Read/unread status and expiration
- **Indexing**: Optimized queries for real-time delivery

### Google Permissions Collection

- **Scope Tracking**: OAuth scope permissions per account
- **Timestamp Management**: Permission grant and update tracking
- **Service Mapping**: Google service access levels

## API Endpoint Categories

### Public Authentication Endpoints

- `/oauth/signin/google` - Google OAuth initiation
- `/oauth/signup/google` - Google OAuth registration
- `/oauth/callback/google` - OAuth callback handling
- `/auth/signup` - Local account registration
- `/auth/login` - Local account authentication
- `/auth/verify-email` - Email verification
- `/auth/reset-password-request` - Password reset initiation
- `/auth/reset-password` - Password reset completion

### Authenticated User Endpoints

- `/:accountId/account` - Account information and updates
- `/:accountId/auth/change-password` - Password modification
- `/:accountId/auth/setup-two-factor` - 2FA configuration
- `/:accountId/google/token` - Google token information
- `/:accountId/notifications` - Notification management

### Internal Service Endpoints

- `/internal/auth/users/:accountId` - User information lookup
- `/internal/auth/session/validate` - Session validation
- `/internal/auth/google/validate` - Google API validation
- `/internal/health` - Service health check

## Security Features

### Password Security

- **Bcrypt Hashing**: Industry-standard password hashing
- **Salt Rounds**: Configurable computational cost
- **Password History**: Prevention of password reuse
- **Strength Validation**: Configurable password requirements

### Token Security

- **JWT Signing**: Asymmetric or symmetric key signing
- **Token Expiration**: Configurable token lifetimes
- **Refresh Mechanism**: Secure token renewal process
- **Revocation Support**: Token blacklisting capabilities

### Session Security

- **Secure Cookies**: HttpOnly and Secure flags
- **CSRF Protection**: SameSite cookie attributes
- **Session Fixation**: Protection against session attacks
- **Concurrent Sessions**: Multiple device support

### Rate Limiting

- **Login Attempts**: Brute force protection
- **Account Lockout**: Temporary account suspension
- **Request Throttling**: API rate limiting
- **IP-based Blocking**: Network-level protection

## Performance Characteristics

### Database Performance

- **Connection Pooling**: Efficient database connections
- **Index Optimization**: Strategic database indexing
- **Query Optimization**: Efficient data retrieval
- **Caching Strategy**: Token and session caching

### Memory Management

- **Token Caching**: LRU cache for active tokens
- **Session Storage**: Efficient session management
- **Event Queuing**: WebSocket event optimization
- **Garbage Collection**: Automatic cleanup processes

### Scalability Features

- **Stateless Design**: Horizontal scaling support
- **Database Sharding**: Account-based data distribution
- **Load Balancing**: Multi-instance deployment
- **Microservice Ready**: Internal API for service integration

## Error Handling

### Error Classification

- **Authentication Errors**: Login and token validation failures
- **Authorization Errors**: Permission and access control issues
- **Validation Errors**: Input validation and data format issues
- **System Errors**: Database and service connectivity problems

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "AUTH_FAILED",
    "message": "Invalid credentials provided"
  }
}
```

### Logging and Monitoring

- **Structured Logging**: JSON-formatted log output
- **Error Tracking**: Comprehensive error information
- **Performance Metrics**: Response time and throughput data
- **Health Monitoring**: Service availability checks

## Integration Points

### Frontend Integration

- **REST API**: Standard HTTP endpoints for web applications
- **WebSocket**: Real-time notification delivery
- **CORS Support**: Cross-origin request handling
- **Authentication Flow**: Complete auth lifecycle support

### Microservice Integration

- **Internal API**: Secure service-to-service communication
- **mTLS Authentication**: Certificate-based service auth
- **User Validation**: Centralized user information
- **Session Sharing**: Distributed session validation

### Third-party Integration

- **OAuth Providers**: Google, Microsoft, Facebook
- **Email Services**: SMTP-compatible email providers
- **Database Systems**: MongoDB with Mongoose ODM
- **Monitoring Tools**: Log aggregation and analysis
