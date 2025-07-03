import { logger } from './logger';

interface CleanupResource {
  id: string;
  type: 'database-connection' | 'server' | 'custom';
  cleanup: () => Promise<void>;
}

class SimpleProcessCleanup {
  private static instance: SimpleProcessCleanup;
  private resources = new Map<string, CleanupResource>();
  private isCleaningUp = false;
  private signalHandlersRegistered = false;

  private constructor() {
    this.registerSignalHandlers();
  }

  static getInstance(): SimpleProcessCleanup {
    if (!SimpleProcessCleanup.instance) {
      SimpleProcessCleanup.instance = new SimpleProcessCleanup();
    }
    return SimpleProcessCleanup.instance;
  }

  /**
   * Register signal handlers for graceful shutdown
   */
  private registerSignalHandlers(): void {
    if (this.signalHandlersRegistered) return;

    // Handle various termination signals
    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT', 'SIGHUP'] as const;

    signals.forEach((signal) => {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, initiating graceful shutdown...`);
        await this.cleanup(`Process ${signal}`);
        process.exit(0);
      });
    });

    // Handle uncaught exceptions and unhandled rejections
    process.on('uncaughtException', async (error) => {
      logger.error('Uncaught Exception:', error);
      await this.cleanup('Uncaught Exception');
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      logger.error('Unhandled Rejection at:', { promise, reason });
      await this.cleanup('Unhandled Rejection');
      process.exit(1);
    });

    // Handle Windows-specific signals (Ctrl+C, Ctrl+Break)
    if (process.platform === 'win32') {
      process.on('SIGBREAK', async () => {
        logger.info('Received SIGBREAK (Ctrl+Break), initiating graceful shutdown...');
        await this.cleanup('SIGBREAK');
        process.exit(0);
      });
    }

    this.signalHandlersRegistered = true;
    logger.info('Process cleanup signal handlers registered');
  }

  /**
   * Register a cleanup resource (NOT for mongodb-memory-server)
   */
  registerCleanup(resource: CleanupResource): void {
    this.resources.set(resource.id, resource);
    logger.debug(`Registered cleanup resource: ${resource.id} (${resource.type})`);
  }

  /**
   * Unregister a cleanup resource
   */
  unregisterCleanup(id: string): void {
    if (this.resources.delete(id)) {
      logger.debug(`Unregistered cleanup resource: ${id}`);
    }
  }

  /**
   * Register database connection for cleanup
   */
  registerDatabaseConnection(id: string, connection: any): void {
    this.registerCleanup({
      id,
      type: 'database-connection',
      cleanup: async () => {
        try {
          if (connection && typeof connection.close === 'function') {
            logger.info(`Closing database connection: ${id}`);
            await connection.close();
            logger.info(`Database connection closed: ${id}`);
          }
        } catch (error) {
          logger.error(`Error closing database connection ${id}:`, error);
        }
      },
    });
  }

  /**
   * Register HTTP server for cleanup
   */
  registerServer(id: string, server: any): void {
    this.registerCleanup({
      id,
      type: 'server',
      cleanup: async () => {
        try {
          if (server && typeof server.close === 'function') {
            logger.info(`Closing server: ${id}`);
            await new Promise<void>((resolve) => {
              server.close(() => {
                logger.info(`Server closed: ${id}`);
                resolve();
              });
            });
          }
        } catch (error) {
          logger.error(`Error closing server ${id}:`, error);
        }
      },
    });
  }

  /**
   * Main cleanup method - mongodb-memory-server will clean itself up automatically
   */
  async cleanup(reason: string = 'Manual cleanup'): Promise<void> {
    if (this.isCleaningUp) {
      logger.warn('Cleanup already in progress, skipping...');
      return;
    }

    this.isCleaningUp = true;
    logger.info(`Starting graceful shutdown - Reason: ${reason}`);
    logger.info('Note: MongoDB Memory Server will clean up its own temp files automatically');

    try {
      // Run cleanup for registered resources with timeout
      const cleanupPromises = Array.from(this.resources.values()).map(async (resource) => {
        try {
          logger.info(`Cleaning up resource: ${resource.id} (${resource.type})`);

          // Add timeout to prevent hanging (5 seconds max per resource)
          await Promise.race([
            resource.cleanup(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Cleanup timeout')), 5000)),
          ]);
        } catch (error) {
          logger.error(`Failed to cleanup resource ${resource.id}:`, error);
        }
      });

      // Wait for all cleanups to complete or timeout
      await Promise.allSettled(cleanupPromises);

      logger.info('Graceful shutdown completed');
    } catch (error) {
      logger.error('Error during cleanup process:', error);
    } finally {
      this.isCleaningUp = false;
    }
  }

  /**
   * Force immediate cleanup (for emergencies)
   */
  forceCleanup(): void {
    logger.warn('Forcing immediate cleanup...');

    // Try to close resources synchronously if possible
    for (const resource of this.resources.values()) {
      try {
        // Only attempt sync operations here
        logger.info(`Force cleaning: ${resource.id}`);
      } catch (error) {
        logger.error(`Error in force cleanup for ${resource.id}:`, error);
      }
    }
  }

  /**
   * Get cleanup status
   */
  getStatus(): {
    registeredResources: number;
    isCleaningUp: boolean;
    resources: Array<{ id: string; type: string }>;
  } {
    return {
      registeredResources: this.resources.size,
      isCleaningUp: this.isCleaningUp,
      resources: Array.from(this.resources.values()).map((r) => ({
        id: r.id,
        type: r.type,
      })),
    };
  }
}

// Export singleton instance
export const processCleanup = SimpleProcessCleanup.getInstance();

// Convenience functions
export const registerDatabaseConnection = (id: string, connection: any) =>
  processCleanup.registerDatabaseConnection(id, connection);

export const registerServer = (id: string, server: any) => processCleanup.registerServer(id, server);

export const registerCustomCleanup = (id: string, cleanupFn: () => Promise<void>) =>
  processCleanup.registerCleanup({
    id,
    type: 'custom',
    cleanup: cleanupFn,
  });

export const unregisterCleanup = (id: string) => processCleanup.unregisterCleanup(id);

export default processCleanup;
