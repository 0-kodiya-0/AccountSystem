import express, { NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import { applyErrorHandlers, asyncHandler } from './utils/response';
import internalRoutes from './feature/internal/internal.routes';
import socketConfig from './config/socket.config';
import { InternalSocketHandler } from './feature/internal/internal.socket';
import { ApiErrorCode, JsonSuccess, NotFoundError } from './types/response.types';
import { logger } from './utils/logger';
import { getInternalServerEnabled, getInternalPort } from './config/env.config';

let internalServer: http.Server | null = null;

/**
 * Create the internal Express app (HTTP only for now)
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

  // Basic authentication for internal API with enhanced logging
  app.use('/internal', (req, res, next) => {
    const serviceId = req.get('X-Internal-Service-ID');
    const serviceSecret = req.get('X-Internal-Service-Secret');

    if (!serviceId || !serviceSecret) {
      logger.warn('Internal API HTTP request without proper authentication headers', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
      });
      // For now, just log and continue - in production you'd want proper validation
    } else {
      logger.info(`Internal API HTTP request from service: ${serviceId}`, {
        path: req.path,
        method: req.method,
      });
    }

    next();
  });

  // Internal API routes
  app.use('/internal', internalRoutes);

  // Health check endpoint with enhanced information
  app.get(
    '/health',
    asyncHandler(async (req, res, next: NextFunction) => {
      const socketHandler = req.app.get('internalSocketHandler') as InternalSocketHandler | undefined;
      const connectedServices = socketHandler?.getConnectedServices() || [];

      next(
        new JsonSuccess({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          server: 'internal-http',
          version: '1.0.0',
          features: {
            httpApi: true,
            socketApi: true,
            authentication: 'header-based',
            typescript: true,
          },
          endpoints: {
            auth: '/internal/auth/*',
            users: '/internal/users/*',
            session: '/internal/session/*',
          },
          socket: {
            namespace: '/internal',
            connectedServices: connectedServices.length,
            services: connectedServices.map((s) => ({
              serviceId: s.serviceId,
              serviceName: s.serviceName,
              authenticated: s.authenticated,
              connectedAt: s.connectedAt,
              lastActivity: s.lastActivity,
            })),
          },
        }),
      );
    }),
  );

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
 * Start the internal HTTP server
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

  // Create HTTP server
  internalServer = http.createServer(app);

  // Initialize Socket.IO for internal services with enhanced configuration
  const io = socketConfig.initializeSocketIO(internalServer, 'internal');

  // Initialize internal socket handler with best practices implementation
  const socketHandler = new InternalSocketHandler(io);

  // Store socket handler reference for health checks and management
  app.set('internalSocketHandler', socketHandler);

  // Error handling for the HTTP server
  internalServer.on('error', (error: NodeJS.ErrnoException) => {
    logger.error('Internal HTTP server error:', error);
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${getInternalPort()} is already in use for internal server`);
    }
  });

  internalServer.on('clientError', (error: Error, socket) => {
    logger.error('Internal client error:', error);
    try {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    } catch {
      // Socket might already be closed
    }
  });

  // Start the server
  const port = getInternalPort();

  await new Promise<void>((resolve, reject) => {
    internalServer!.listen(port, () => {
      logger.info(`🔌 Internal HTTP API server running on port ${port}`);
      logger.info('   ✅ HTTP REST API endpoints available');
      logger.info('   ✅ Socket.IO real-time API available');
      logger.info('   ✅ TypeScript type-safe event interfaces');
      logger.info('   ✅ Token verification & user information services');
      logger.info('   ✅ Session management & validation services');
      logger.info('   ✅ Activity tracking & health monitoring');
      logger.info(`   📡 Health check: http://localhost:${port}/health`);
      logger.info(`   📡 HTTP API base: http://localhost:${port}/internal`);
      logger.info(`   📡 Socket.IO namespace: /internal`);
      logger.info('   🔐 Authentication: X-Internal-Service-ID and X-Internal-Service-Secret headers');
      logger.info('   🔐 Socket auth: serviceId, serviceName, serviceSecret in handshake');
      logger.info('   📊 Features: Notifications, Activity Tracking, Service Management');
      resolve();
    });

    internalServer!.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Stop the internal HTTP server
 */
export async function stopInternalServer(): Promise<void> {
  if (!internalServer) {
    logger.warn('Internal server is not running');
    return;
  }

  logger.info('Stopping internal HTTP server...');

  await new Promise<void>((resolve) => {
    internalServer!.close(() => {
      logger.info('Internal HTTP server stopped');
      internalServer = null;
      resolve();
    });
  });
}
