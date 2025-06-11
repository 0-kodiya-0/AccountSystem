import { getPort } from "./config/env.config";

import http, { Server } from "http";
import express from "express";
import passport from "passport";
import cookieParser from "cookie-parser";

import setupPassport from "./config/passport";
import db from "./config/db";
import socketConfig from "./config/socket.config";
import { applyErrorHandlers, asyncHandler } from "./utils/response";

import { router as oauthRoutes } from "./feature/oauth";
import {
  authenticatedNeedRouter as authNeedAccountRouter,
  authenticationNotNeedRouter as authNotNeedAccountRouter,
} from "./feature/account";
import { sessionRouter } from "./services/session/session.routes"; // NEW: Session routes
import { router as googleRoutes } from "./feature/google";
import {
  authNotRequiredRouter as localAuthNotRequiredRouter,
  authRequiredRouter as localAuthRequiredRouter,
} from "./feature/local_auth";
import notificationRoutes, {
  NotificationSocketHandler,
} from "./feature/notifications";
import {
  authenticateSession,
  validateAccountAccess,
  validateTokenAccess,
} from "./middleware";
import { ApiErrorCode, NotFoundError } from "./types/response.types";
import { logger } from "./utils/logger";
import { autoTrackParentUrl } from "./middleware/path-track";

let httpServer: Server | null = null;

/**
 * Create the main Express app
 */
function createMainApp(): express.Application {
  const app = express();

  app.set("trust proxy", true);

  // Middleware
  app.use(express.json());
  app.use(cookieParser());

  // Initialize Passport
  app.use(passport.initialize());
  setupPassport();

  // Request logging middleware (configurable)
  if (process.env.NO_REQUEST_LOGS !== "true") {
    app.use((req, res, next) => {
      logger.info(`[BACKEND] ${req.method} ${req.url}`, {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });
      next();
    });
  }

  // Routes - Using API paths that match the proxy configuration

  // OAuth routes (enabled unless specifically disabled)
  if (process.env.DISABLE_OAUTH !== "true") {
    app.use("/oauth", autoTrackParentUrl(), oauthRoutes);
    logger.info("OAuth routes enabled");
  } else {
    logger.info("OAuth routes disabled");
  }

  // Account routes (always enabled) - UPDATED to include session routes
  app.use("/account", autoTrackParentUrl(), authNotNeedAccountRouter);
  app.use("/account", autoTrackParentUrl(), sessionRouter); // NEW: Session routes

  // Local auth routes (enabled unless specifically disabled)
  if (process.env.DISABLE_LOCAL_AUTH !== "true") {
    app.use("/auth", autoTrackParentUrl(), localAuthNotRequiredRouter);
    logger.info("Local authentication routes enabled");
  } else {
    logger.info("Local authentication routes disabled");
  }

  // Routes that need authentication
  app.use(
    "/:accountId",
    authenticateSession,
    validateAccountAccess,
    validateTokenAccess,
  );

  app.use("/:accountId/account", autoTrackParentUrl(), authNeedAccountRouter);
  app.use("/:accountId/google", autoTrackParentUrl(), googleRoutes);

  // Notification routes (enabled unless specifically disabled)
  if (process.env.DISABLE_NOTIFICATIONS !== "true") {
    app.use(
      "/:accountId/notifications",
      autoTrackParentUrl(),
      notificationRoutes,
    );
    logger.info("Notification routes enabled");
  } else {
    logger.info("Notification routes disabled");
  }

  // Local auth authenticated routes (enabled unless specifically disabled)
  if (process.env.DISABLE_LOCAL_AUTH !== "true") {
    app.use("/:accountId/auth", autoTrackParentUrl(), localAuthRequiredRouter);
  }

  applyErrorHandlers(app);

  // 404 handler
  app.use(
    asyncHandler((req, res, next) => {
      next(
        new NotFoundError(
          "Endpoint not found",
          404,
          ApiErrorCode.RESOURCE_NOT_FOUND,
        ),
      );
    }),
  );

  return app;
}

/**
 * Start the main HTTP server
 */
export async function startMainServer(): Promise<void> {
  if (httpServer) {
    logger.warn("Main server is already running");
    return;
  }

  // Initialize database connections and models
  await db.initializeDB();
  logger.info("Database connections established and models initialized");

  // Create Express app
  const app = createMainApp();

  // Create HTTP server
  httpServer = http.createServer(app);

  // Initialize Socket.IO with the HTTP server
  const io = socketConfig.initializeSocketIO(httpServer);

  // Initialize socket handlers if notifications are enabled
  if (process.env.DISABLE_NOTIFICATIONS !== "true") {
    new NotificationSocketHandler(io);
    logger.info("Notification socket handlers initialized");
  } else {
    logger.info("Notification system disabled");
  }

  // Start HTTP server
  const PORT = getPort();

  await new Promise<void>((resolve, reject) => {
    httpServer!.listen(PORT, () => {
      logger.info(`🌐 Main HTTP server running on port ${PORT}`);
      logger.info(`📡 Socket.IO is listening on the same port`);
      resolve();
    });

    httpServer!.on("error", (error: Error) => {
      logger.error("Failed to start main server:", error);
      reject(error);
    });
  });
}

/**
 * Stop the main HTTP server
 */
export async function stopMainServer(): Promise<void> {
  if (!httpServer) {
    logger.warn("Main server is not running");
    return;
  }

  logger.info("Stopping main HTTP server...");

  await new Promise<void>((resolve) => {
    httpServer!.close(() => {
      logger.info("Main HTTP server stopped");
      httpServer = null;
      resolve();
    });
  });
}
