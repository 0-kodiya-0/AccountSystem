#!/usr/bin/env node

import { startServer, stopServer } from './index';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { pathToFileURL } from 'url';
import { logger } from './utils/logger';
import processCleanup from './utils/processCleanup';

const VERSION = '1.0.0';

interface CLIOptions {
  // Environment & Basic
  env?: string;
  port?: number;

  // Database
  dbUri?: string;
  dbTimeout?: number;

  // Internal Server
  internalPort?: number;
  disableInternal?: boolean;
  internalSslKey?: string;
  internalSslCert?: string;
  internalSslCa?: string;

  // Logging
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  noRequestLogs?: boolean;
  debug?: boolean;
  quiet?: boolean;

  // Authentication
  jwtSecret?: string;
  sessionSecret?: string;
  disableOauth?: boolean;
  disableLocalAuth?: boolean;
  disableNotifications?: boolean;

  // Help & Info
  help?: boolean;
  version?: boolean;
}

export function showHelp(): void {
  console.log(`
AccountSystem Backend Server v${VERSION}

USAGE:
  accountsystem-backend [options]
  abs [options]

OPTIONS:
  Environment & Basic:
    --env <path>              Path to .env file (default: .env)
    -p, --port <number>       Server port (overrides env)

  Database:
    --db-uri <uri>            MongoDB connection URI
    --db-timeout <ms>         Database connection timeout (default: 30000)

  Internal Server:
    --internal-port <number>  Internal HTTPS server port
    --disable-internal        Disable internal HTTPS server
    --internal-ssl-key <path> Internal server SSL key
    --internal-ssl-cert <path> Internal server SSL cert
    --internal-ssl-ca <path>  Internal server CA cert

  Logging:
    --log-level <level>       Log level (debug, info, warn, error)
    --no-request-logs         Disable HTTP request logging
    --debug                   Enable debug mode
    --quiet                   Disable all logging output

  Authentication:
    --jwt-secret <secret>     JWT secret (overrides env)
    --session-secret <secret> Session secret (overrides env)
    --disable-oauth           Disable OAuth routes
    --disable-local-auth      Disable local authentication routes
    --disable-notifications   Disable notification system

  Help & Info:
    -h, --help               Show help
    -v, --version            Show version

EXAMPLES:
  accountsystem-backend
  accountsystem-backend --port 4000 --debug
  accountsystem-backend --disable-internal --log-level warn
  abs --env .env.production --db-timeout 60000

DOCUMENTATION:
  Repository:    https://github.com/0-kodiya-0/AccountSystem
  Backend Docs:  https://github.com/0-kodiya-0/AccountSystem/blob/main/packages/backend/README.md
`);
}

function showVersion(): void {
  console.log(`AccountSystem Backend Server v${VERSION}`);
}

export function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-v':
      case '--version':
        options.version = true;
        break;

      // Environment & Basic
      case '--env':
        if (nextArg && !nextArg.startsWith('-')) {
          options.env = nextArg;
          i++;
        } else {
          logger.error('Error: --env requires a path');
          process.exit(1);
        }
        break;
      case '-p':
      case '--port':
        if (nextArg && !nextArg.startsWith('-')) {
          const port = parseInt(nextArg);
          if (isNaN(port) || port < 1 || port > 65535) {
            logger.error('Error: --port must be a valid port number (1-65535)');
            process.exit(1);
          }
          options.port = port;
          i++;
        } else {
          logger.error('Error: --port requires a number');
          process.exit(1);
        }
        break;

      // Database
      case '--db-uri':
        if (nextArg && !nextArg.startsWith('-')) {
          options.dbUri = nextArg;
          i++;
        } else {
          logger.error('Error: --db-uri requires a URI');
          process.exit(1);
        }
        break;
      case '--db-timeout':
        if (nextArg && !nextArg.startsWith('-')) {
          const timeout = parseInt(nextArg);
          if (isNaN(timeout) || timeout < 1000) {
            logger.error('Error: --db-timeout must be a number >= 1000');
            process.exit(1);
          }
          options.dbTimeout = timeout;
          i++;
        } else {
          logger.error('Error: --db-timeout requires a number');
          process.exit(1);
        }
        break;

      // Internal Server
      case '--internal-port':
        if (nextArg && !nextArg.startsWith('-')) {
          const port = parseInt(nextArg);
          if (isNaN(port) || port < 1 || port > 65535) {
            logger.error('Error: --internal-port must be a valid port number (1-65535)');
            process.exit(1);
          }
          options.internalPort = port;
          i++;
        } else {
          logger.error('Error: --internal-port requires a number');
          process.exit(1);
        }
        break;
      case '--disable-internal':
        options.disableInternal = true;
        break;
      case '--internal-ssl-key':
        if (nextArg && !nextArg.startsWith('-')) {
          options.internalSslKey = nextArg;
          i++;
        } else {
          logger.error('Error: --internal-ssl-key requires a path');
          process.exit(1);
        }
        break;
      case '--internal-ssl-cert':
        if (nextArg && !nextArg.startsWith('-')) {
          options.internalSslCert = nextArg;
          i++;
        } else {
          logger.error('Error: --internal-ssl-cert requires a path');
          process.exit(1);
        }
        break;
      case '--internal-ssl-ca':
        if (nextArg && !nextArg.startsWith('-')) {
          options.internalSslCa = nextArg;
          i++;
        } else {
          logger.error('Error: --internal-ssl-ca requires a path');
          process.exit(1);
        }
        break;

      // Logging
      case '--log-level':
        if (nextArg && !nextArg.startsWith('-')) {
          const validLevels = ['debug', 'info', 'warn', 'error'];
          if (!validLevels.includes(nextArg)) {
            logger.error(`Error: --log-level must be one of: ${validLevels.join(', ')}`);
            process.exit(1);
          }
          options.logLevel = nextArg as 'debug' | 'info' | 'warn' | 'error';
          i++;
        } else {
          logger.error('Error: --log-level requires a level (debug, info, warn, error)');
          process.exit(1);
        }
        break;
      case '--no-request-logs':
        options.noRequestLogs = true;
        break;
      case '--debug':
        options.debug = true;
        break;
      case '--quiet':
        options.quiet = true;
        break;

      // Authentication
      case '--jwt-secret':
        if (nextArg && !nextArg.startsWith('-')) {
          options.jwtSecret = nextArg;
          i++;
        } else {
          logger.error('Error: --jwt-secret requires a secret');
          process.exit(1);
        }
        break;
      case '--session-secret':
        if (nextArg && !nextArg.startsWith('-')) {
          options.sessionSecret = nextArg;
          i++;
        } else {
          logger.error('Error: --session-secret requires a secret');
          process.exit(1);
        }
        break;
      case '--disable-oauth':
        options.disableOauth = true;
        break;
      case '--disable-local-auth':
        options.disableLocalAuth = true;
        break;
      case '--disable-notifications':
        options.disableNotifications = true;
        break;

      default:
        if (arg.startsWith('-')) {
          logger.error(`Error: Unknown option: ${arg}`);
          logger.info('Use --help for available options');
          process.exit(1);
        }
        break;
    }
  }

  return options;
}

export function validateOptions(options: CLIOptions): void {
  // Validate file paths exist
  if (options.env && !fs.existsSync(options.env)) {
    logger.error(`Error: Environment file not found: ${options.env}`);
    process.exit(1);
  }

  if (options.internalSslKey && !fs.existsSync(options.internalSslKey)) {
    logger.error(`Error: Internal SSL key file not found: ${options.internalSslKey}`);
    process.exit(1);
  }

  if (options.internalSslCert && !fs.existsSync(options.internalSslCert)) {
    logger.error(`Error: Internal SSL cert file not found: ${options.internalSslCert}`);
    process.exit(1);
  }

  if (options.internalSslCa && !fs.existsSync(options.internalSslCa)) {
    logger.error(`Error: Internal SSL CA file not found: ${options.internalSslCa}`);
    process.exit(1);
  }

  // Validate secrets are not empty
  if (options.jwtSecret && options.jwtSecret.trim().length === 0) {
    logger.error('Error: JWT secret cannot be empty');
    process.exit(1);
  }

  if (options.sessionSecret && options.sessionSecret.trim().length === 0) {
    logger.error('Error: Session secret cannot be empty');
    process.exit(1);
  }
}

export function applyEnvironmentOverrides(options: CLIOptions): void {
  // Load custom env file if specified
  if (options.env) {
    const envPath = path.resolve(options.env);
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: true });
      logger.info(`Loaded environment from: ${envPath}`);
    }
  }

  // Override environment variables with CLI options
  if (options.port) {
    process.env.PORT = options.port.toString();
  }

  if (options.dbUri) {
    process.env.MONGODB_URI = options.dbUri;
    // Also set the accounts DB URI since that's what the code uses
    process.env.ACCOUNTS_DB_URI = options.dbUri;
  }

  if (options.dbTimeout) {
    process.env.DB_TIMEOUT = options.dbTimeout.toString();
  }

  if (options.internalPort) {
    process.env.INTERNAL_PORT = options.internalPort.toString();
  }

  if (options.disableInternal) {
    process.env.INTERNAL_SERVER_ENABLED = 'false';
  }

  if (options.internalSslKey) {
    process.env.INTERNAL_SERVER_KEY_PATH = path.resolve(options.internalSslKey);
  }

  if (options.internalSslCert) {
    process.env.INTERNAL_SERVER_CERT_PATH = path.resolve(options.internalSslCert);
  }

  if (options.internalSslCa) {
    process.env.INTERNAL_CA_CERT_PATH = path.resolve(options.internalSslCa);
  }

  if (options.jwtSecret) {
    process.env.JWT_SECRET = options.jwtSecret;
  }

  if (options.sessionSecret) {
    process.env.SESSION_SECRET = options.sessionSecret;
  }

  // Set logging options
  if (options.logLevel) {
    process.env.LOG_LEVEL = options.logLevel;
  }

  if (options.noRequestLogs) {
    process.env.NO_REQUEST_LOGS = 'true';
  }

  if (options.debug) {
    process.env.DEBUG_MODE = 'true';
    process.env.LOG_LEVEL = 'debug';
  }

  if (options.quiet) {
    process.env.LOG_LEVEL = 'error'; // Only show errors
    process.env.NO_REQUEST_LOGS = 'true';
    process.env.QUIET_MODE = 'true';
  }

  // Set feature disable flags
  if (options.disableOauth) {
    process.env.DISABLE_OAUTH = 'true';
  }

  if (options.disableLocalAuth) {
    process.env.DISABLE_LOCAL_AUTH = 'true';
  }

  if (options.disableNotifications) {
    process.env.DISABLE_NOTIFICATIONS = 'true';
  }
}

async function main(): Promise<void> {
  const options = parseArgs();

  // Handle help and version first
  if (options.help) {
    showHelp();
    return;
  }

  if (options.version) {
    showVersion();
    return;
  }

  // Validate options
  validateOptions(options);

  // Apply environment overrides
  applyEnvironmentOverrides(options);

  // Enhanced graceful shutdown handling with cleanup system
  const shutdown = async (signal: string) => {
    if (!options.quiet) {
      logger.info(`🛑 Received ${signal}, initiating graceful shutdown...`);
    }

    try {
      // Stop the server first
      await stopServer();

      if (!options.quiet) {
        logger.info('✅ Backend server stopped');
      }

      // Let the cleanup system handle the rest
      await processCleanup.cleanup(`CLI shutdown via ${signal}`);

      if (!options.quiet) {
        logger.info('✅ Cleanup completed');
      }

      process.exit(0);
    } catch (error) {
      logger.error(`❌ Error during shutdown: ${error instanceof Error ? error.message : 'Unknown error'}`);

      // Force cleanup if normal cleanup fails
      try {
        processCleanup.forceCleanup();
      } catch (forceError) {
        logger.error('Force cleanup also failed:', forceError);
      }

      process.exit(1);
    }
  };

  // Register signal handlers - these will work with the cleanup system
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGQUIT', () => shutdown('SIGQUIT'));

  // Windows-specific signal
  if (process.platform === 'win32') {
    process.on('SIGBREAK', () => shutdown('SIGBREAK'));
  }

  // Start the server
  logger.info(`🚀 Starting AccountSystem Backend Server v${VERSION}...`);

  if (options.debug || options.logLevel === 'debug') {
    logger.info('🐛 Debug mode enabled');
  }

  // Log cleanup system status
  const cleanupStatus = processCleanup.getStatus();
  logger.info(`🛡️  Process cleanup system active (${cleanupStatus.registeredResources} resources monitored)`);

  // Start the server
  try {
    await startServer();

    if (!options.quiet) {
      logger.info('🎉 Server started successfully');
      logger.info('💡 Press Ctrl+C to gracefully shutdown');
    }
  } catch (error) {
    // Always show critical errors, even in quiet mode
    logger.error(`❌ Failed to start backend server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

// Run the CLI
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    logger.error(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  });
}
