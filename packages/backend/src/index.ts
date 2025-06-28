import { envConfig } from './config/env.config';

envConfig.initialize();

import { logger } from './utils/logger';
import { startMainServer, stopMainServer } from './app';
import { startInternalServer, stopInternalServer } from './app-internal';
import db from './config/db';

/**
 * Start both servers with proper error handling
 */
export async function startServer(): Promise<void> {
  try {
    logger.info('Starting AccountSystem Backend Server...');

    // Start main HTTP server
    await startMainServer();
    logger.info('Main HTTP server started successfully');

    // Start internal HTTPS server (if enabled and configured)
    try {
      await startInternalServer();
      logger.info('Internal HTTPS server started successfully');
    } catch (error) {
      logger.warn('Failed to start internal HTTPS server:', error);
      logger.info('Continuing without internal server...');
      // Don't throw here - internal server failure shouldn't crash the main server
    }

    logger.info('🚀 AccountSystem Backend Server started successfully');

    // Log enabled features
    const features = [];
    if (process.env.DISABLE_OAUTH !== 'true') features.push('OAuth');
    if (process.env.DISABLE_LOCAL_AUTH !== 'true') features.push('Local Auth');
    if (process.env.DISABLE_NOTIFICATIONS !== 'true') features.push('Notifications');
    // Check if internal server is actually enabled
    if (
      process.env.INTERNAL_SERVER_ENABLED !== 'false' &&
      process.env.INTERNAL_SERVER_KEY_PATH &&
      process.env.INTERNAL_SERVER_CERT_PATH &&
      process.env.INTERNAL_CA_CERT_PATH
    ) {
      features.push('Internal Server');
    }

    logger.info(`Enabled features: ${features.join(', ')}`);
  } catch (error) {
    logger.error('Failed to start servers:', error);
    throw error;
  }
}

/**
 * Stop all servers
 */
export async function stopServer(): Promise<void> {
  logger.info('Stopping backend servers...');

  const shutdownPromises = [];

  // Stop main server
  shutdownPromises.push(
    stopMainServer().catch((error) => {
      logger.error('Error stopping main server:', error);
    }),
  );

  // Stop internal server
  shutdownPromises.push(
    stopInternalServer().catch((error) => {
      logger.error('Error stopping internal server:', error);
    }),
  );

  // Close database connections
  shutdownPromises.push(
    db
      .close()
      .then(() => {
        logger.info('Database connections closed');
      })
      .catch((error) => {
        logger.error('Error closing database connections:', error);
      }),
  );

  await Promise.all(shutdownPromises);
}

// Graceful shutdown handling when used as a module
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  try {
    await stopServer();
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully');
  try {
    await stopServer();
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
});
