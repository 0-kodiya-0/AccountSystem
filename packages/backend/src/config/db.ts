import initAccountModel from '../feature/account/Account.model';
import initNotificationModel from '../feature/notifications/Notification.model';
import initGooglePermissionsModel from '../feature/google/models/GooglePermissions.model';
import dbConfig from './db.config';
import { logger } from '../utils/logger';
import { getNodeEnv, getTestDbClearOnStart, getTestDbSeedOnStart } from './env.config';

// Define model types for type safety
export type AccountModels = {
  Account: Awaited<ReturnType<typeof initAccountModel>>;
};
export type NotificationModels = {
  Notification: Awaited<ReturnType<typeof initNotificationModel>>;
};
export type GoogleModels = {
  GooglePermissions: Awaited<ReturnType<typeof initGooglePermissionsModel>>;
};

// Database models container with proper typing
interface DatabaseModels {
  accounts: AccountModels;
  notifications: NotificationModels;
  google: GoogleModels;
}

// Track initialization state
let isInitialized = false;
let models: DatabaseModels | null = null;

/**
 * Initialize all database connections and models
 * This ensures models are available before they're used
 */
const initializeDB = async (): Promise<DatabaseModels> => {
  try {
    // Connect to both databases
    await dbConfig.connectAllDatabases();

    // Initialize models for all databases
    const [accountModel] = await Promise.all([initAccountModel()]);

    // Initialize environment models on the accounts database
    const accountsConnection = dbConfig.connections.accounts!;
    const notificationModel = await initNotificationModel(accountsConnection);
    const googlePermissionsModel = await initGooglePermissionsModel(accountsConnection);

    // Store initialized models
    models = {
      accounts: {
        Account: accountModel,
      },
      notifications: {
        Notification: notificationModel,
      },
      google: {
        GooglePermissions: googlePermissionsModel,
      },
    };

    isInitialized = true;
    logger.info('Database models initialized successfully');

    // Handle test database initialization
    if (getNodeEnv() === 'test' || getNodeEnv() === 'development') {
      // Clear database if requested
      if (getTestDbClearOnStart()) {
        await dbConfig.clearDatabase();
        logger.info('Test database cleared on startup');
      }

      // Seed database if requested
      if (getTestDbSeedOnStart()) {
        await dbConfig.seedTestDatabase();
        logger.info('Test database seeded on startup');
      }

      // Log database stats for development/test
      const stats = await dbConfig.getDatabaseStats();
      logger.info('Database statistics:', stats);
    }

    return models;
  } catch (error) {
    logger.error('Failed to initialize database models:', error);
    throw error;
  }
};

/**
 * Get models for database operations
 * This function ensures models are initialized before access
 * and throws a clear error if something goes wrong
 */
const getModels = async (): Promise<DatabaseModels> => {
  if (!isInitialized || !models) {
    try {
      return await initializeDB();
    } catch (error) {
      throw new Error(`Failed to initialize database connections: ${error}`);
    }
  }
  return models;
};

/**
 * Close all database connections
 */
const close = async (): Promise<void> => {
  await dbConfig.closeAllConnections();
  models = null;
  isInitialized = false;
};

export default {
  initializeDB,
  getModels,
  close,
};
