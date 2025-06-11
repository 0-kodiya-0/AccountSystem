import express, { NextFunction } from "express";
import https, { Server } from "https";
import cors from "cors";
import { Socket } from "net";
import { TLSSocket } from "tls";
import { applyErrorHandlers, asyncHandler } from "./utils/response";
import {
  internalAuthentication,
  InternalRequest,
} from "./middleware/internal-auth.middleware";
import internalAuthRoutes from "./feature/internal/auth/internal-auth.routes";
import socketConfig from "./config/socket.config";
import { InternalNotificationHandler } from "./feature/internal/socket/internal-socket.handler";
import {
  ApiErrorCode,
  JsonSuccess,
  NotFoundError,
} from "./types/response.types";
import { loadInternalSSLCertificates } from "./config/internal-server.config";
import { logger } from "./utils/logger";
import { getInternalServerEnabled, getInternalPort } from "./config/env.config";

let internalServer: Server | null = null;

/**
 * Create the internal Express app
 */
function createInternalApp(): express.Application {
  const app = express();

  // Basic middleware for internal server
  app.use(
    express.json({
      limit: "10mb",
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
  if (process.env.NO_REQUEST_LOGS !== "true") {
    app.use((req, res, next) => {
      const timestamp = new Date().toISOString();
      const clientIP = req.ip || req.socket.remoteAddress || "unknown";
      logger.info(
        `[INTERNAL] ${timestamp} - ${req.method} ${req.url} - ${clientIP}`,
      );
      next();
    });
  }

  // Apply internal authentication middleware to all routes
  app.use("/internal", internalAuthentication);

  // Internal API routes
  app.use("/internal/auth", internalAuthRoutes);

  // Health check endpoint (with authentication)
  app.get(
    "/internal/health",
    asyncHandler(async (req, res, next: NextFunction) => {
      const internalReq = req as InternalRequest;
      next(
        new JsonSuccess({
          success: true,
          data: {
            status: "healthy",
            timestamp: new Date().toISOString(),
            server: "internal-https",
            certificate: {
              fingerprint: internalReq.clientCertificate?.fingerprint,
              subject: internalReq.clientCertificate?.subject,
              signedBySameCA: internalReq.clientCertificate?.signedBySameCA,
            },
            service: req.get("X-Internal-Service-ID"),
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
      next(
        new NotFoundError(
          "Internal endpoint not found",
          404,
          ApiErrorCode.RESOURCE_NOT_FOUND,
        ),
      );
    }),
  );

  return app;
}

/**
 * Start the internal HTTPS server
 */
export async function startInternalServer(): Promise<void> {
  if (internalServer) {
    logger.warn("Internal server is already running");
    return;
  }

  // Check if internal server is enabled
  if (!getInternalServerEnabled()) {
    logger.info("Internal server is disabled");
    return;
  }

  // Load SSL certificates
  const httpsOptions = loadInternalSSLCertificates();

  // Create the Express app
  const app = createInternalApp();

  // Create HTTPS server with client certificate authentication
  internalServer = https.createServer(httpsOptions, app);

  // Initialize Socket.IO for internal services
  const io = socketConfig.initializeSocketIO(internalServer);

  // Initialize internal notification handler
  new InternalNotificationHandler(io);

  // Enhanced error handling for the HTTPS server
  internalServer.on("error", (error: NodeJS.ErrnoException) => {
    logger.error("Internal HTTPS server error:", error);
    if (error.code === "EADDRINUSE") {
      logger.error(
        `Port ${getInternalPort()} is already in use for internal server`,
      );
    }
  });

  internalServer.on("clientError", (error: Error, socket: Socket) => {
    logger.error("Internal client error:", error.message);

    // Handle client certificate errors gracefully
    if (
      "code" in error &&
      (error.code === "EPROTO" || error.code === "ECONNRESET")
    ) {
      logger.warn("Client certificate validation failed or connection reset");
    }

    try {
      socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
    } catch {
      // Socket might already be closed
    }
  });

  // Handle TLS/SSL errors
  internalServer.on("tlsClientError", (error: Error) => {
    logger.error("TLS client error:", error.message);

    if ("code" in error && error.code === "EPROTO") {
      logger.warn("Client presented invalid or unauthorized certificate");
    }
  });

  internalServer.on("secureConnection", (tlsSocket: TLSSocket) => {
    const cert = tlsSocket.getPeerCertificate();
    if (cert && Object.keys(cert).length > 0) {
      const commonName = cert.subject?.CN || "unknown";
      logger.debug(
        `Secure connection established with certificate: ${commonName}`,
      );
    }
  });

  // Start the server
  const port = getInternalPort();

  await new Promise<void>((resolve, reject) => {
    internalServer!.listen(port, () => {
      logger.info(`🔒 Internal HTTPS server running on port ${port}`);
      logger.info("   ✓ Client certificate authentication enabled");
      logger.info("   ✓ Same-CA certificate validation enabled");
      logger.info("   ✓ Internal service authentication required");
      logger.info("   ✓ Internal notification socket.io enabled");
      logger.debug(
        `   📡 Health check: https://localhost:${port}/internal/health`,
      );
      logger.debug(
        `   📡 Internal notifications: /internal-notifications namespace`,
      );
      resolve();
    });

    internalServer!.on("error", (error) => {
      reject(error);
    });
  });
}

/**
 * Stop the internal HTTPS server
 */
export async function stopInternalServer(): Promise<void> {
  if (!internalServer) {
    logger.warn("Internal server is not running");
    return;
  }

  logger.info("Stopping internal HTTPS server...");

  await new Promise<void>((resolve) => {
    internalServer!.close(() => {
      logger.info("Internal HTTPS server stopped");
      internalServer = null;
      resolve();
    });
  });
}
