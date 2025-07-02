import express from 'express';
import http from 'http';
import https from 'https';
import cors from 'cors';
import { applyErrorHandlers, asyncHandler } from './utils/response';

import { InternalSocketHandler, internalRouter } from './feature/internal';
import { internalHealthRouter } from './feature/health';
import { internalAuthentication } from './middleware/internal.middleware';

import { ApiErrorCode, NotFoundError } from './types/response.types';
import socketConfig from './config/socket.config';
import { logger } from './utils/logger';
import { getInternalServerEnabled, getInternalPort, getNodeEnv, getMockEnabled } from './config/env.config';
import { loadInternalSSLCertificates } from './config/internal-server.config';

let internalServer: http.Server | https.Server | null = null;

/**
 * Determine if we should use HTTPS for internal server
 */
function shouldUseHttps(): boolean {
  const nodeEnv = getNodeEnv();
  const mockEnabled = getMockEnabled();

  // Don't use HTTPS in development, test, or when mocks are enabled
  if (nodeEnv === 'development' || nodeEnv === 'test' || mockEnabled) {
    return false;
  }

  // Use HTTPS in production
  return nodeEnv === 'production';
}

/**
 * Create the internal Express app
 */
function createInternalApp(): express.Application {
  const app = express();

  // Basic middleware for internal server
  app.use(
    express.json({
      limit: '10mb',
      strict: true,
    }),
  );

  // Disable CORS for internal routes (internal services only)
  app.use(
    cors({
      origin: false,
      credentials: false,
    }),
  );

  // Request logging middleware for internal requests
  if (process.env.NO_REQUEST_LOGS !== 'true') {
    app.use((req, res, next) => {
      const timestamp = new Date().toISOString();
      const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
      logger.info(`[INTERNAL] ${timestamp} - ${req.method} ${req.url} - ${clientIP}`);
      next();
    });
  }

  // Health routes (no authentication required)
  app.use('/health', internalHealthRouter);

  // Internal API routes (with authentication)
  app.use('/internal', internalAuthentication, internalRouter);

  // Apply error handlers
  applyErrorHandlers(app);

  // 404 handler for internal routes
  app.use(
    asyncHandler(async (req, res, next) => {
      next(new NotFoundError('Internal endpoint not found', 404, ApiErrorCode.RESOURCE_NOT_FOUND));
    }),
  );

  return app;
}

/**
 * Start the internal server (HTTP or HTTPS based on environment)
 */
export async function startInternalServer(): Promise<void> {
  if (internalServer) {
    logger.warn('Internal server is already running');
    return;
  }

  // Check if internal server is enabled
  if (!getInternalServerEnabled()) {
    logger.info('Internal server is disabled');
    return;
  }

  // Create the Express app
  const app = createInternalApp();
  const port = getInternalPort();
  const useHttps = shouldUseHttps();

  try {
    // Create server based on environment
    if (useHttps) {
      // Production mode: Use HTTPS with certificates
      logger.info('Starting internal HTTPS server with certificate authentication...');

      const httpsOptions = loadInternalSSLCertificates();
      internalServer = https.createServer(httpsOptions, app);

      logger.info('Internal HTTPS server configured with mTLS authentication');
    } else {
      // Development/Mock mode: Use HTTP
      logger.info('Starting internal HTTP server (development/mock mode)...');

      internalServer = http.createServer(app);

      logger.info('Internal HTTP server configured for development (no certificates required)');
    }

    // Initialize Socket.IO for internal services
    const io = socketConfig.initializeSocketIO(internalServer, 'internal');

    // Initialize internal socket handler
    const socketHandler = new InternalSocketHandler(io);

    // Store socket handler reference for health checks and management
    app.set('internalSocketHandler', socketHandler);

    // Error handling for the server
    internalServer.on('error', (error: NodeJS.ErrnoException) => {
      logger.error('Internal server error:', error);
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${port} is already in use for internal server`);
      } else if (error.code === 'ENOENT') {
        logger.error('SSL certificate files not found. Please check certificate paths.');
      }
    });

    internalServer.on('clientError', (error: Error, socket) => {
      logger.error('Internal client error:', error);
      try {
        const response = useHttps ? 'HTTP/1.1 400 Bad Request\r\n\r\n' : 'HTTP/1.1 400 Bad Request\r\n\r\n';
        socket.end(response);
      } catch {
        // Socket might already be closed
      }
    });

    // HTTPS-specific events
    if (useHttps && internalServer instanceof https.Server) {
      internalServer.on('secureConnection', (tlsSocket) => {
        logger.debug('Secure TLS connection established', {
          authorized: tlsSocket.authorized,
          authorizationError: tlsSocket.authorizationError,
          peerCertificate: tlsSocket.getPeerCertificate() ? 'Available' : 'Not Available',
        });
      });

      internalServer.on('tlsClientError', (err) => {
        logger.warn('TLS client error:', {
          error: err.message,
          code: (err as NodeJS.ErrnoException).code || 'UNKNOWN',
        });
      });
    }

    // Start the server
    await new Promise<void>((resolve, reject) => {
      internalServer!.listen(port, () => {
        const protocol = useHttps ? 'HTTPS' : 'HTTP';
        const authMethod = useHttps ? 'mTLS certificates + service headers' : 'service headers only';

        logger.info(`🔌 Internal ${protocol} server running on port ${port}`);
        logger.info(`   ✅ ${protocol} REST API endpoints available`);
        logger.info('   ✅ Socket.IO real-time API available');
        logger.info('   ✅ TypeScript type-safe event interfaces');
        logger.info('   ✅ Token verification & user information services');
        logger.info('   ✅ Session management & validation services');
        logger.info('   ✅ Activity tracking & health monitoring');
        logger.info(`   📡 Health check: ${protocol.toLowerCase()}://localhost:${port}/health`);
        logger.info(`   📡 ${protocol} API base: ${protocol.toLowerCase()}://localhost:${port}/internal`);
        logger.info(`   📡 Socket.IO namespace: /internal-socket`);
        logger.info(`   🔐 Authentication: ${authMethod}`);

        if (useHttps) {
          logger.info('   🔐 Client certificates: Required and validated');
          logger.info('   🔐 Service headers: Required for identification');
        } else {
          logger.info('   🔐 Client certificates: Not required (development mode)');
          logger.info('   🔐 Service headers: Required with secret validation');
        }

        logger.info('   📊 Features: Notifications, Activity Tracking, Service Management');

        resolve();
      });

      internalServer!.on('error', (error) => {
        reject(error);
      });
    });
  } catch (error) {
    logger.error('Failed to start internal server:', error);

    if (useHttps && error instanceof Error && error.message.includes('certificate')) {
      logger.error('Certificate loading failed. You can:');
      logger.error('1. Set NODE_ENV=development to use HTTP mode');
      logger.error('2. Set MOCK_ENABLED=true to use HTTP mode');
      logger.error('3. Provide valid SSL certificates for production');
    }

    throw error;
  }
}

/**
 * Stop the internal server
 */
export async function stopInternalServer(): Promise<void> {
  if (!internalServer) {
    logger.warn('Internal server is not running');
    return;
  }

  const protocol = internalServer instanceof https.Server ? 'HTTPS' : 'HTTP';
  logger.info(`Stopping internal ${protocol} server...`);

  await new Promise<void>((resolve) => {
    internalServer!.close(() => {
      logger.info(`Internal ${protocol} server stopped`);
      internalServer = null;
      resolve();
    });
  });
}

/**
 * Get internal server status
 */
export function getInternalServerStatus(): {
  running: boolean;
  protocol: 'HTTP' | 'HTTPS' | null;
  port: number;
  authMode: 'production' | 'development';
  requiresCertificates: boolean;
} {
  const isRunning = !!internalServer;
  const protocol =
    internalServer instanceof https.Server ? 'HTTPS' : internalServer instanceof http.Server ? 'HTTP' : null;
  const useHttps = shouldUseHttps();

  return {
    running: isRunning,
    protocol,
    port: getInternalPort(),
    authMode: useHttps ? 'production' : 'development',
    requiresCertificates: useHttps,
  };
}
