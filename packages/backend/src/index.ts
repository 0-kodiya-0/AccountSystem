import { startMainServer, stopMainServer } from './app';
import { startInternalServer, stopInternalServer } from './app-internal';
import { logger } from './utils/logger';
import { processCleanup, registerCustomCleanup } from './utils/processCleanup';
import { closeAllConnections } from './config/db.config';

/**
 * Start both main and internal servers
 */
export async function startServer(): Promise<void> {
  try {
    logger.info('🚀 Starting AccountSystem Backend Server...');

    // Initialize cleanup system status logging
    const initialStatus = processCleanup.getStatus();
    logger.info(`🛡️  Process cleanup system initialized (${initialStatus.registeredResources} resources monitored)`);

    // Start main server
    await startMainServer();
    logger.info('✅ Main server started successfully');

    // Start internal server (if enabled)
    await startInternalServer();
    logger.info('✅ Internal server started successfully');

    // Register database cleanup
    registerCustomCleanup('database-cleanup', async () => {
      logger.info('Closing all database connections...');
      await closeAllConnections();
      logger.info('All database connections closed');
    });

    // Log final cleanup status
    const finalStatus = processCleanup.getStatus();
    logger.info(`🛡️  All servers started with ${finalStatus.registeredResources} resources monitored for cleanup`);

    logger.info('🎉 Backend server startup completed successfully!');
    logger.info('💡 Use Ctrl+C to gracefully shutdown all services');
  } catch (error) {
    logger.error('❌ Failed to start backend server:', error);

    // Attempt cleanup on startup failure
    try {
      await processCleanup.cleanup('Startup failure');
    } catch (cleanupError) {
      logger.error('Cleanup after startup failure also failed:', cleanupError);
    }

    throw error;
  }
}

/**
 * Stop both main and internal servers
 */
export async function stopServer(): Promise<void> {
  try {
    logger.info('🛑 Stopping AccountSystem Backend Server...');

    // Stop internal server first (less critical)
    try {
      await stopInternalServer();
      logger.info('✅ Internal server stopped');
    } catch (error) {
      logger.error('❌ Error stopping internal server:', error);
    }

    // Stop main server
    try {
      await stopMainServer();
      logger.info('✅ Main server stopped');
    } catch (error) {
      logger.error('❌ Error stopping main server:', error);
    }

    // Close database connections
    try {
      await closeAllConnections();
      logger.info('✅ Database connections closed');
    } catch (error) {
      logger.error('❌ Error closing database connections:', error);
    }

    logger.info('✅ Backend server shutdown completed');
  } catch (error) {
    logger.error('❌ Error during server shutdown:', error);
    throw error;
  }
}

// Export server functions
export { startMainServer, stopMainServer, startInternalServer, stopInternalServer };
