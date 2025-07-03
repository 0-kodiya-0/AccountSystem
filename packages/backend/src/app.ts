// src/app.ts
import { getPort } from './config/env.config';

import http, { Server } from 'http';
import express, { Express } from 'express';
import cookieParser from 'cookie-parser';

import { initializeDB } from './config/db.config';
import socketConfig from './config/socket.config';
import { registerServer, registerCustomCleanup } from './utils/processCleanup';

import * as oauthRouter from './feature/oauth';
import * as accountRouter from './feature/account';
import * as sessionRouter from './feature/session/session.routes';
import * as localAuthRouter from './feature/local_auth';
import * as twoFARouter from './feature/twofa';
import * as tokenRouter from './feature/tokens';
import * as healthRouter from './feature/health/Health.routes';

import { emailMockRouter } from './feature/email/__mocks__/Email.mock.routes';
import { oauthMockRouter } from './feature/oauth/__mocks__/OAuth.mock.routes';
import { sessionMockRouter } from './feature/session/__mocks__/Session.mock.routes';
import { tokenMockRouter } from './feature/tokens/__mocks__/Token.mock.routes';

import notificationRouter, { NotificationSocketHandler } from './feature/notifications';

import { authenticateSession, validateAccountAccess, validateTokenAccess } from './middleware';
import { autoTrackParentUrl } from './middleware/path-track';

import { ApiErrorCode, NotFoundError } from './types/response.types';
import { logger } from './utils/logger';
import { applyErrorHandlers, asyncHandler } from './utils/response';

let httpServer: Server | null = null;
let app: Express | null = null;

/**
 * Create the main Express app
 */
function createMainApp(): Express {
  const app = express();

  app.set('trust proxy', true);

  // Middleware
  app.use(express.json());
  app.use(cookieParser());

  // Request logging middleware (configurable)
  if (process.env.NO_REQUEST_LOGS !== 'true') {
    app.use((req, res, next) => {
      logger.info(`[BACKEND] ${req.method} ${req.url}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      next();
    });
  }

  app.use('/health', healthRouter.healthRouter);

  if (process.env.NODE_ENV !== 'production') {
    if (process.env.MOCK_ENABLED === 'true') {
      // Email mock routes
      app.use('/mock/email', emailMockRouter);
      logger.info('Email mock routes enabled');

      // OAuth mock routes
      app.use('/mock/oauth', oauthMockRouter);
      logger.info('OAuth mock routes enabled');

      // Session mock routes
      app.use('/mock/session', sessionMockRouter);
      logger.info('Session mock routes enabled');

      // Token mock routes
      app.use('/mock/token', tokenMockRouter);
      logger.info('Token mock routes enabled');
    }
  }

  // Routes - Using API paths that match the proxy configuration

  // OAuth routes (enabled unless specifically disabled)
  if (process.env.DISABLE_OAUTH !== 'true') {
    app.use('/oauth', autoTrackParentUrl(), oauthRouter.authNotRequiredRouter);
    logger.info('OAuth routes enabled');
  } else {
    logger.info('OAuth routes disabled');
  }

  // Account routes (always enabled)
  app.use('/account', autoTrackParentUrl(), accountRouter.authNotRequiredRouter);
  app.use('/session', autoTrackParentUrl(), sessionRouter.sessionRouter);

  // Local auth routes (enabled unless specifically disabled)
  if (process.env.DISABLE_LOCAL_AUTH !== 'true') {
    app.use('/auth', autoTrackParentUrl(), localAuthRouter.authNotRequiredRouter);
    logger.info('Local authentication routes enabled');
  } else {
    logger.info('Local authentication routes disabled');
  }

  // 2FA public routes (enabled unless specifically disabled)
  if (process.env.DISABLE_LOCAL_AUTH !== 'true' || process.env.DISABLE_OAUTH !== 'true') {
    app.use('/twofa', autoTrackParentUrl(), twoFARouter.twoFAPublicRouter);
    logger.info('2FA public routes enabled');
  }

  // Routes that need authentication
  app.use('/:accountId', authenticateSession, validateAccountAccess, validateTokenAccess);

  app.use('/:accountId/account', autoTrackParentUrl(), accountRouter.authRequiredRouter);

  // Notification routes (enabled unless specifically disabled)
  if (process.env.DISABLE_NOTIFICATIONS !== 'true') {
    app.use('/:accountId/notifications', autoTrackParentUrl(), notificationRouter);
    logger.info('Notification routes enabled');
  } else {
    logger.info('Notification routes disabled');
  }

  // Local auth authenticated routes (enabled unless specifically disabled)
  if (process.env.DISABLE_LOCAL_AUTH !== 'true') {
    app.use('/:accountId/auth', autoTrackParentUrl(), localAuthRouter.authRequiredRouter);
    logger.info('Local auth authenticated routes enabled');
  }

  // 2FA authenticated routes (enabled unless both auth types are disabled)
  if (process.env.DISABLE_LOCAL_AUTH !== 'true' || process.env.DISABLE_OAUTH !== 'true') {
    app.use('/:accountId/twofa', autoTrackParentUrl(), twoFARouter.twoFAAuthenticatedRouter);
    logger.info('2FA authenticated routes enabled');
  }

  app.use('/:accountId/tokens', autoTrackParentUrl(), tokenRouter.tokenRouter);
  logger.info('Centralized token routes enabled');

  applyErrorHandlers(app);

  // 404 handler
  app.use(
    asyncHandler((req, res, next) => {
      next(new NotFoundError('Endpoint not found', 404, ApiErrorCode.RESOURCE_NOT_FOUND));
    }),
  );

  return app;
}

/**
 * Start the main HTTP server
 */
export async function startMainServer() {
  if (httpServer) {
    if (app) {
      logger.warn('Main server is already running');
      return app;
    }
    throw new Error('Server error');
  }

  // Initialize database connections and models
  await initializeDB();
  logger.info('Database connections established and models initialized');

  // Create Express app
  app = createMainApp();

  // Create HTTP server
  httpServer = http.createServer(app);

  // Register server for cleanup
  registerServer('main-http-server', httpServer);

  // Initialize Socket.IO with the HTTP server
  const io = socketConfig.initializeSocketIO(httpServer, 'external');

  // Register Socket.IO cleanup
  registerCustomCleanup('main-socketio', async () => {
    logger.info('Closing Socket.IO connections...');
    io.close();
    logger.info('Socket.IO connections closed');
  });

  // Initialize socket handlers if notifications are enabled
  if (process.env.DISABLE_NOTIFICATIONS !== 'true') {
    new NotificationSocketHandler(io);
    logger.info('Notification socket handlers initialized');
  } else {
    logger.info('Notification system disabled');
  }

  // Start HTTP server
  const PORT = getPort();

  await new Promise<void>((resolve, reject) => {
    httpServer!.listen(PORT, () => {
      logger.info(`🌐 Main HTTP server running on port ${PORT}`);
      logger.info(`📡 Socket.IO is listening on the same port`);
      logger.info('🛡️  Process cleanup handlers are active');

      // Log enabled mock services
      if (process.env.NODE_ENV !== 'production' && process.env.MOCK_ENABLED === 'true') {
        logger.info('🧪 Mock services enabled:');
        logger.info('   📧 Email Mock: /mock/email/*');
        logger.info('   🔐 OAuth Mock: /mock/oauth/*');
        logger.info('   🏷️ Session Mock: /mock/session/*');
        logger.info('   🎫 Token Mock: /mock/token/*');
      }

      resolve();
    });

    httpServer!.on('error', (error: Error) => {
      logger.error('Failed to start main server:', error);
      reject(error);
    });
  });

  return app;
}

/**
 * Stop the main HTTP server
 */
export async function stopMainServer(): Promise<void> {
  if (!httpServer) {
    logger.warn('Main server is not running');
    return;
  }

  logger.info('Stopping main HTTP server...');

  await new Promise<void>((resolve) => {
    httpServer!.close(() => {
      logger.info('Main HTTP server stopped');
      httpServer = null;
      resolve();
    });
  });
}
