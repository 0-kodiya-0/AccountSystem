import express, { NextFunction } from 'express';
import https from 'https';
import http from 'http';
import cors from 'cors';
import { Socket } from 'net';
//import { TLSSocket } from 'tls';
import { applyErrorHandlers, asyncHandler } from './utils/response';
// TEMPORARILY COMMENTED FOR TESTING - DISABLE TLS VALIDATION
// import {
//   internalAuthentication,
//   InternalRequest,
// } from "./middleware/internal-auth.middleware";
import internalAuthRoutes from './feature/internal/auth/internal-auth.routes';
import socketConfig from './config/socket.config';
import { InternalNotificationHandler } from './feature/internal/socket/internal-socket.handler';
import { ApiErrorCode, JsonSuccess, NotFoundError } from './types/response.types';
// TEMPORARILY COMMENTED FOR TESTING - DISABLE SSL CERT LOADING
// import { loadInternalSSLCertificates } from "./config/internal-server.config";
import { logger } from './utils/logger';
import { getInternalServerEnabled, getInternalPort } from './config/env.config';
import fs from 'fs';

let internalServer: https.Server | http.Server | null = null;

// TEMPORARY INTERFACE FOR TESTING WITHOUT TLS MIDDLEWARE
interface TempInternalRequest extends express.Request {
  clientCertificate?: {
    fingerprint: string;
    subject: { CN: string };
    signedBySameCA: boolean;
  };
  isInternalRequest?: boolean;
}

/**
 * Create the internal Express app
 * TEMPORARILY SIMPLIFIED FOR TESTING - TLS VALIDATION DISABLED
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

  // TEMPORARILY COMMENTED - DISABLE AUTHENTICATION MIDDLEWARE FOR TESTING
  // Apply internal authentication middleware to all routes
  // app.use("/internal", internalAuthentication);

  // TEMPORARY BASIC AUTH BYPASS FOR TESTING
  app.use('/internal', (req, res, next) => {
    const tempReq = req as TempInternalRequest;
    tempReq.isInternalRequest = true;
    tempReq.clientCertificate = {
      fingerprint: 'TEMP_TESTING_FINGERPRINT',
      subject: { CN: 'test-service' },
      signedBySameCA: true,
    };
    logger.info('TEMP: Bypassing internal authentication for testing');
    next();
  });

  // Internal API routes
  app.use('/internal/auth', internalAuthRoutes);

  // Health check endpoint (with authentication)
  app.get(
    '/internal/health',
    asyncHandler(async (req, res, next: NextFunction) => {
      const internalReq = req as TempInternalRequest;
      next(
        new JsonSuccess({
          success: true,
          data: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            server: 'internal-https',
            certificate: {
              fingerprint: internalReq.clientCertificate?.fingerprint,
              subject: internalReq.clientCertificate?.subject,
              signedBySameCA: internalReq.clientCertificate?.signedBySameCA,
            },
            // TEMP: Remove service header requirement for testing
            service: 'testing-mode',
            note: 'TEMPORARY: TLS validation disabled for testing',
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
 * Start the internal HTTPS server
 * TEMPORARILY MODIFIED FOR TESTING - BASIC SSL WITHOUT CLIENT CERT VALIDATION
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

  // TEMPORARILY COMMENTED - DISABLE STRICT SSL CERT LOADING
  // Load SSL certificates
  // const httpsOptions = loadInternalSSLCertificates();

  // TEMPORARY BASIC SSL CONFIG FOR TESTING
  let httpsOptions;
  try {
    // Try to load basic SSL certificates if available
    const keyPath = process.env.INTERNAL_SERVER_KEY_PATH;
    const certPath = process.env.INTERNAL_SERVER_CERT_PATH;

    if (keyPath && certPath && fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      httpsOptions = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
        // TEMPORARILY DISABLED - NO CLIENT CERT VALIDATION
        // ca: fs.readFileSync(caCertPath),
        // requestCert: true,
        // rejectUnauthorized: true,

        // TEMP: Allow any client connection
        requestCert: false,
        rejectUnauthorized: false,
      };
      logger.info('TEMP: Using basic SSL configuration for testing');
    } else {
      // Fallback to self-signed certificate generation or HTTP
      throw new Error('SSL certificates not found - will fall back to HTTP');
    }
  } catch (error) {
    logger.warn('TEMP: SSL certificate loading failed, falling back to HTTP for testing:', error);

    // TEMPORARY FALLBACK TO HTTP FOR TESTING
    const app = createInternalApp();

    internalServer = http.createServer(app);

    // Initialize Socket.IO for internal services
    const io = socketConfig.initializeSocketIO(internalServer);

    // Initialize internal notification handler
    new InternalNotificationHandler(io);

    const port = getInternalPort();

    await new Promise<void>((resolve, reject) => {
      internalServer!.listen(port, () => {
        logger.warn(`⚠️  TEMP: Internal HTTP server running on port ${port} (TLS DISABLED FOR TESTING)`);
        logger.warn('   ⚠️  Client certificate authentication DISABLED');
        logger.warn('   ⚠️  Same-CA certificate validation DISABLED');
        logger.warn('   ⚠️  Internal service authentication BYPASSED');
        logger.warn('   ⚠️  This is for TESTING ONLY - DO NOT USE IN PRODUCTION');
        logger.debug(`   📡 Health check: http://localhost:${port}/internal/health`);
        resolve();
      });

      internalServer!.on('error', (error) => {
        reject(error);
      });
    });

    return;
  }

  // Create the Express app
  const app = createInternalApp();

  // Create HTTPS server with client certificate authentication
  internalServer = https.createServer(httpsOptions, app);

  // Initialize Socket.IO for internal services
  const io = socketConfig.initializeSocketIO(internalServer);

  // Initialize internal notification handler
  new InternalNotificationHandler(io);

  // Enhanced error handling for the HTTPS server
  internalServer.on('error', (error: NodeJS.ErrnoException) => {
    logger.error('Internal HTTPS server error:', error);
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${getInternalPort()} is already in use for internal server`);
    }
  });

  internalServer.on('clientError', (error: Error, socket: Socket) => {
    logger.error('Internal client error:', error);

    // TEMPORARILY COMMENTED - CLIENT CERT ERROR HANDLING
    // Handle client certificate errors gracefully
    // if (
    //   "code" in error &&
    //   (error.code === "EPROTO" || error.code === "ECONNRESET")
    // ) {
    //   logger.warn("Client certificate validation failed or connection reset");
    // }

    try {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    } catch {
      // Socket might already be closed
    }
  });

  // TEMPORARILY COMMENTED - TLS CLIENT ERROR HANDLING
  // Handle TLS/SSL errors
  // internalServer.on("tlsClientError", (error: Error) => {
  //   logger.error("TLS client error:", error.message);

  //   if ("code" in error && error.code === "EPROTO") {
  //     logger.warn("Client presented invalid or unauthorized certificate");
  //   }
  // });

  // TEMPORARILY COMMENTED - SECURE CONNECTION LOGGING
  // internalServer.on("secureConnection", (tlsSocket: TLSSocket) => {
  //   const cert = tlsSocket.getPeerCertificate();
  //   if (cert && Object.keys(cert).length > 0) {
  //     const commonName = cert.subject?.CN || "unknown";
  //     logger.debug(
  //       `Secure connection established with certificate: ${commonName}`,
  //     );
  //   }
  // });

  // Start the server
  const port = getInternalPort();

  await new Promise<void>((resolve, reject) => {
    internalServer!.listen(port, () => {
      logger.info(`🔒 Internal HTTPS server running on port ${port}`);
      // TEMPORARILY MODIFIED LOGGING
      logger.warn('   ⚠️  TEMP: Client certificate authentication DISABLED for testing');
      logger.warn('   ⚠️  TEMP: Same-CA certificate validation DISABLED for testing');
      logger.warn('   ⚠️  TEMP: Internal service authentication BYPASSED for testing');
      logger.info('   ✓ Internal notification socket.io enabled');
      logger.debug(`   📡 Health check: https://localhost:${port}/internal/health`);
      logger.debug(`   📡 Internal notifications: /internal-notifications namespace`);
      logger.warn('   ⚠️  DO NOT USE THIS CONFIGURATION IN PRODUCTION');
      resolve();
    });

    internalServer!.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Stop the internal HTTPS server
 */
export async function stopInternalServer(): Promise<void> {
  if (!internalServer) {
    logger.warn('Internal server is not running');
    return;
  }

  logger.info('Stopping internal HTTPS server...');

  await new Promise<void>((resolve) => {
    internalServer!.close(() => {
      logger.info('Internal HTTPS server stopped');
      internalServer = null;
      resolve();
    });
  });
}
