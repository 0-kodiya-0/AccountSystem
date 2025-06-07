# CLI Reference

Complete command-line interface documentation for AccountSystem Backend Server.

## Basic Usage

```bash
accountsystem-backend [options]
abs [options]  # Short alias
```

## Command Line Options

### Environment & Basic Configuration

#### `--env <path>`

Specify a custom environment file path.

```bash
accountsystem-backend --env .env.production
accountsystem-backend --env /path/to/custom/.env
```

**Default**: `.env` in current directory

#### `-p, --port <number>`

Override the server port.

```bash
accountsystem-backend --port 4000
accountsystem-backend -p 7000
```

**Default**: 3000 (or PORT environment variable)
**Range**: 1-65535

### Database Configuration

#### `--db-uri <uri>`

Specify MongoDB connection URI.

```bash
accountsystem-backend --db-uri "mongodb://localhost:27017/myapp"
accountsystem-backend --db-uri "mongodb+srv://user:pass@cluster.mongodb.net/db"
```

**Overrides**: `MONGODB_URI` and `ACCOUNTS_DB_URI` environment variables

#### `--db-timeout <ms>`

Set database connection timeout in milliseconds.

```bash
accountsystem-backend --db-timeout 30000
accountsystem-backend --db-timeout 60000
```

**Default**: 30000 (30 seconds)
**Minimum**: 1000 (1 second)

### Internal Server Configuration

The internal server provides secure mTLS endpoints for microservice communication.

#### `--internal-port <number>`

Set the internal HTTPS server port.

```bash
accountsystem-backend --internal-port 4443
accountsystem-backend --internal-port 5443
```

**Default**: 4443
**Range**: 1-65535

#### `--disable-internal`

Completely disable the internal HTTPS server.

```bash
accountsystem-backend --disable-internal
```

**Use case**: When you don't need microservice communication

#### `--internal-ssl-key <path>`

Path to the internal server SSL private key.

```bash
accountsystem-backend --internal-ssl-key ./certs/internal.key
accountsystem-backend --internal-ssl-key /etc/ssl/private/internal.key
```

**Required**: When internal server is enabled

#### `--internal-ssl-cert <path>`

Path to the internal server SSL certificate.

```bash
accountsystem-backend --internal-ssl-cert ./certs/internal.crt
accountsystem-backend --internal-ssl-cert /etc/ssl/certs/internal.crt
```

**Required**: When internal server is enabled

#### `--internal-ssl-ca <path>`

Path to the Certificate Authority (CA) certificate.

```bash
accountsystem-backend --internal-ssl-ca ./certs/ca.crt
accountsystem-backend --internal-ssl-ca /etc/ssl/certs/ca.crt
```

**Required**: When internal server is enabled

### Logging Configuration

#### `--log-level <level>`

Set the logging level.

```bash
accountsystem-backend --log-level debug
accountsystem-backend --log-level warn
accountsystem-backend --log-level error
```

**Options**: `debug`, `info`, `warn`, `error`
**Default**: `info`

#### `--no-request-logs`

Disable HTTP request logging.

```bash
accountsystem-backend --no-request-logs
```

**Use case**: Reduce log noise in production

#### `--debug`

Enable debug mode with verbose logging.

```bash
accountsystem-backend --debug
```

**Effect**: Sets log level to `debug` and enables debug mode

#### `--quiet`

Disable all logging except errors.

```bash
accountsystem-backend --quiet
```

**Effect**:

- Sets log level to `error`
- Disables request logs
- Suppresses startup/shutdown messages
- Only shows critical errors

### Authentication Configuration

#### `--jwt-secret <secret>`

Override JWT secret for token signing.

```bash
accountsystem-backend --jwt-secret "my-super-secret-key"
```

**Security**: Use a strong, random secret in production

#### `--session-secret <secret>`

Override session secret.

```bash
accountsystem-backend --session-secret "my-session-secret"
```

**Security**: Use a strong, random secret in production

#### `--disable-oauth`

Disable OAuth authentication routes.

```bash
accountsystem-backend --disable-oauth
```

**Effect**:

- Disables `/oauth/*` routes
- Removes Google/Microsoft/Facebook sign-in
- Local authentication still works

#### `--disable-local-auth`

Disable local authentication routes.

```bash
accountsystem-backend --disable-local-auth
```

**Effect**:

- Disables `/auth/*` routes
- Removes email/password authentication
- OAuth authentication still works

#### `--disable-notifications`

Disable the notification system.

```bash
accountsystem-backend --disable-notifications
```

**Effect**:

- Disables WebSocket notifications
- Removes notification routes
- Reduces memory usage

### Help & Information

#### `-h, --help`

Show help information.

```bash
accountsystem-backend --help
accountsystem-backend -h
```

#### `-v, --version`

Show version information.

```bash
accountsystem-backend --version
accountsystem-backend -v
```

## Usage Examples

### Development Setup

```bash
# Basic development with debug logging
accountsystem-backend --debug

# Custom port with request logging disabled
accountsystem-backend --port 4000 --no-request-logs

# Load custom environment file
accountsystem-backend --env .env.development --debug
```

### Production Setup

```bash
# Production with minimal logging
accountsystem-backend --quiet --log-level error

# Custom database and port
accountsystem-backend \
  --port 3001 \
  --db-uri "mongodb+srv://user:pass@cluster.mongodb.net/prod" \
  --quiet

# With internal server for microservices
accountsystem-backend \
  --internal-port 4443 \
  --internal-ssl-key /etc/ssl/private/internal.key \
  --internal-ssl-cert /etc/ssl/certs/internal.crt \
  --internal-ssl-ca /etc/ssl/certs/ca.crt \
  --log-level warn
```

### Feature-Specific Deployments

```bash
# OAuth-only authentication
accountsystem-backend --disable-local-auth --disable-notifications

# Local auth only (no OAuth or notifications)
accountsystem-backend --disable-oauth --disable-notifications

# Minimal setup (no internal server, no notifications)
accountsystem-backend --disable-internal --disable-notifications --quiet
```

### Docker/Container Setup

```bash
# Container-friendly setup
accountsystem-backend \
  --quiet \
  --env /app/config/.env \
  --port 3000 \
  --disable-internal \
  --db-timeout 60000
```

## Configuration Priority

Configuration is applied in this order (later overrides earlier):

1. **Default values**
2. **Environment file** (`.env` or `--env`)
3. **Environment variables**
4. **CLI arguments**

## Environment Variable Mapping

| CLI Option | Environment Variable | Description |
|------------|---------------------|-------------|
| `--port` | `PORT` | Server port |
| `--db-uri` | `MONGODB_URI`, `ACCOUNTS_DB_URI` | Database URI |
| `--db-timeout` | `DB_TIMEOUT` | Database timeout |
| `--internal-port` | `INTERNAL_PORT` | Internal server port |
| `--disable-internal` | `INTERNAL_SERVER_ENABLED=false` | Disable internal server |
| `--internal-ssl-key` | `INTERNAL_SERVER_KEY_PATH` | SSL key path |
| `--internal-ssl-cert` | `INTERNAL_SERVER_CERT_PATH` | SSL cert path |
| `--internal-ssl-ca` | `INTERNAL_CA_CERT_PATH` | CA cert path |
| `--log-level` | `LOG_LEVEL` | Logging level |
| `--no-request-logs` | `NO_REQUEST_LOGS=true` | Disable request logs |
| `--debug` | `DEBUG_MODE=true` | Debug mode |
| `--quiet` | `QUIET_MODE=true` | Quiet mode |
| `--jwt-secret` | `JWT_SECRET` | JWT secret |
| `--session-secret` | `SESSION_SECRET` | Session secret |
| `--disable-oauth` | `DISABLE_OAUTH=true` | Disable OAuth |
| `--disable-local-auth` | `DISABLE_LOCAL_AUTH=true` | Disable local auth |
| `--disable-notifications` | `DISABLE_NOTIFICATIONS=true` | Disable notifications |

## Exit Codes

- `0` - Success
- `1` - General error (startup failure, configuration error)

## Signals

The server responds to these signals:

- `SIGTERM` - Graceful shutdown
- `SIGINT` - Graceful shutdown (Ctrl+C)

Both signals trigger:

1. Stop accepting new connections
2. Close existing connections gracefully
3. Close database connections
4. Exit with code 0

## Troubleshooting

### Common Issues

**Port already in use**

```bash
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution**: Use a different port with `--port 3001`

**Database connection failed**

```bash
Error: Failed to connect to MongoDB
```

**Solution**: Check database URI with `--db-uri` or increase timeout with `--db-timeout`

**SSL certificate not found**

```bash
Error: Internal SSL key file not found
```

**Solution**: Provide correct paths or disable internal server with `--disable-internal`

**Permission denied**

```bash
Error: listen EACCES: permission denied 0.0.0.0:80
```

**Solution**: Use a port above 1024 or run with appropriate permissions

### Debug Mode

Use `--debug` to get detailed information about:

- Configuration loading
- Database connections
- Route registration
- SSL certificate loading
- Feature enablement

### Quiet Mode vs Log Levels

- `--quiet`: Shows only critical errors, suppresses all other output
- `--log-level error`: Shows errors through the logging system
- `--log-level warn`: Shows warnings and errors
- `--log-level info`: Shows informational messages (default)
- `--log-level debug`: Shows detailed debug information
