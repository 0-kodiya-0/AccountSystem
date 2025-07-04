import mongoose from 'mongoose';
import {
  getAccountsDbUri,
  getNodeEnv,
  getTestDbClearOnStart,
  getTestDbSeedOnStart,
  getUseMemoryDb,
} from './env.config';
import {
  getAccountsMockConfig,
  getOAuthMockConfig,
  type SeedingOptions,
  getMockAccountsForSeeding,
} from './mock.config';
import { logger } from '../utils/logger';
import { MongoMemoryServer } from 'mongodb-memory-server';
import processCleanup from '../utils/processCleanup';

// Import model initializers
import initAccountModel from '../feature/account/Account.model';
import initNotificationModel from '../feature/notifications/Notification.model';
import initGooglePermissionsModel from '../feature/google/models/GooglePermissions.model';

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

// Connection state management
interface ConnectionState {
  connection: mongoose.Connection | null;
  isConnected: boolean;
  isConnecting: boolean;
  lastConnectionTime: Date | null;
  connectionPromise: Promise<mongoose.Connection> | null;
}

// Create connection state for authentication
const connectionState: ConnectionState = {
  connection: null,
  isConnected: false,
  isConnecting: false,
  lastConnectionTime: null,
  connectionPromise: null,
};

// Memory server instance for testing
let memoryServer: MongoMemoryServer | null = null;

// Track initialization state
let isInitialized = false;
let models: DatabaseModels | null = null;

/**
 * Database Connection Error
 */
export class DatabaseConnectionError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'DatabaseConnectionError';
  }
}

/**
 * Check if we should use MongoDB Memory Server
 */
export function shouldUseMemoryServer(): boolean {
  const nodeEnv = getNodeEnv();
  const isTestOrDev = nodeEnv === 'test' || nodeEnv === 'development';
  return MongoMemoryServer && getUseMemoryDb() && isTestOrDev;
}

/**
 * Start MongoDB Memory Server
 */
export async function startMemoryServer(): Promise<string> {
  if (!MongoMemoryServer) {
    throw new Error('MongoDB Memory Server is not available');
  }

  processCleanup.registerCleanup({
    id: 'mongodb-memory-server',
    type: 'custom',
    cleanup: async () => {
      if (memoryServer) {
        logger.info('Gracefully stopping MongoDB Memory Server...');
        await memoryServer.stop();
        memoryServer = null;
      }
    },
  });

  try {
    memoryServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'test-accounts-db',
        dbPath: './.temp/db',
        port: 27017,
      },
      binary: {
        version: '7.0.0',
      },
    });

    const uri = memoryServer.getUri();
    logger.info('MongoDB Memory Server started:', uri);
    return uri;
  } catch (error) {
    logger.error('Failed to start MongoDB Memory Server:', error);
    throw error;
  }
}

/**
 * Stop MongoDB Memory Server
 */
export async function stopMemoryServer(): Promise<void> {
  if (memoryServer) {
    try {
      await memoryServer.stop();
      memoryServer = null;
      logger.info('MongoDB Memory Server stopped');
    } catch (error) {
      logger.error('Error stopping MongoDB Memory Server:', error);
    }
  }
}

/**
 * Get the appropriate MongoDB URI
 */
async function getMongoDbUri(): Promise<string> {
  if (shouldUseMemoryServer()) {
    return await startMemoryServer();
  }

  const providedUri = getAccountsDbUri();
  if (providedUri) {
    return providedUri;
  }

  throw new Error('ACCOUNTS_DB_URI is missing');
}

/**
 * Wait for connection to be ready with timeout
 */
async function waitForConnection(connection: mongoose.Connection, timeoutMs: number = 30000): Promise<void> {
  if (connection.readyState === mongoose.ConnectionStates.connected) {
    return;
  }

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      connection.removeAllListeners('connected');
      connection.removeAllListeners('error');
      reject(new DatabaseConnectionError(`Connection timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    const onConnected = () => {
      clearTimeout(timeout);
      connection.removeAllListeners('error');
      resolve();
    };

    const onError = (err: Error) => {
      clearTimeout(timeout);
      connection.removeAllListeners('connected');
      reject(new DatabaseConnectionError('Connection failed', err));
    };

    connection.once('connected', onConnected);
    connection.once('error', onError);
  });
}

/**
 * Verify database connection is actually working
 */
async function verifyConnection(connection: mongoose.Connection): Promise<void> {
  try {
    if (!connection.db) {
      throw new Error('Database object not available');
    }
    // Ping the database to ensure it's responsive
    await connection.db.admin().ping();
    logger.debug('Database ping successful');
  } catch (error) {
    throw new DatabaseConnectionError('Database ping failed - connection not functional', error as Error);
  }
}

/**
 * Connect to the authentication database with proper verification
 */
export const connectAuthDB = async (forceNew: boolean = false): Promise<mongoose.Connection> => {
  try {
    // Return existing connection if it's working and not forcing a new one
    if (connectionState.connection && !forceNew && connectionState.isConnected) {
      await verifyConnection(connectionState.connection);
      logger.debug('Returning existing verified database connection');
      return connectionState.connection;
    }

    // If currently connecting, wait for that connection
    if (connectionState.isConnecting && connectionState.connectionPromise && !forceNew) {
      logger.debug('Waiting for existing connection attempt to complete');
      return await connectionState.connectionPromise;
    }

    // Force close existing connection if forceNew is true
    if (forceNew && connectionState.connection) {
      logger.info('Forcing new database connection - closing existing connection');
      await connectionState.connection.close();
      connectionState.connection = null;
      connectionState.isConnected = false;
    }

    // Set connecting state
    connectionState.isConnecting = true;

    // Create connection promise
    connectionState.connectionPromise = (async () => {
      const authURI = await getMongoDbUri();

      // Create a new connection
      const connection = mongoose.createConnection(authURI, {
        // Connection options for reliability
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        family: 4, // Use IPv4, skip trying IPv6
        retryWrites: true,
        retryReads: true,
      });

      // Wait for connection to be established
      await waitForConnection(connection);

      // Verify the connection is actually working
      await verifyConnection(connection);

      // Update connection state
      connectionState.connection = connection;
      connectionState.isConnected = true;
      connectionState.isConnecting = false;
      connectionState.lastConnectionTime = new Date();

      const dbType = shouldUseMemoryServer() ? 'Memory' : 'MongoDB';
      logger.info(`${dbType} authentication database connected and verified successfully`);

      if (shouldUseMemoryServer()) {
        logger.info('Using MongoDB Memory Server for testing');
        logger.info('Database will be cleared when server stops');
      }

      return connection;
    })();

    return await connectionState.connectionPromise;
  } catch (error) {
    connectionState.isConnecting = false;
    connectionState.connectionPromise = null;
    logger.error('Authentication database connection error:', error);

    // If memory server fails, try regular MongoDB
    if (shouldUseMemoryServer()) {
      logger.warn('Memory server failed, falling back to regular MongoDB');
      process.env.USE_MEMORY_DB = 'false';
      // Retry with regular MongoDB
      return await connectAuthDB(forceNew);
    }

    throw new DatabaseConnectionError('Failed to connect to database', error as Error);
  }
};

/**
 * Ensure database connection is ready
 * This is the main function to use throughout the application
 */
export const ensureConnection = async (): Promise<mongoose.Connection> => {
  if (!connectionState.connection) {
    return await connectAuthDB();
  }

  if (!connectionState.isConnected) {
    logger.warn('Database connection exists but is not connected, attempting to reconnect');
    return await connectAuthDB(true);
  }

  try {
    await verifyConnection(connectionState.connection);
    return connectionState.connection;
  } catch {
    logger.warn('Database connection verification failed, reconnecting');
    return await connectAuthDB(true);
  }
};

/**
 * Get the current connection or throw if not available
 * Use this when you need to access the connection directly
 */
export const getConnection = (): mongoose.Connection => {
  if (!connectionState.connection || !connectionState.isConnected) {
    throw new DatabaseConnectionError('Database connection is not available. Call ensureConnection() first.');
  }
  return connectionState.connection;
};

/**
 * Check if database is connected and ready
 */
export const isConnected = (): boolean => {
  return connectionState.isConnected && !!connectionState.connection;
};

/**
 * Initialize all database connections and models
 */
export const initializeDB = async (): Promise<DatabaseModels> => {
  try {
    // Ensure database connection is ready
    const connection = await ensureConnection();

    // Initialize models on the authentication database
    const accountModel = await initAccountModel(connection);
    const notificationModel = await initNotificationModel(connection);
    const googlePermissionsModel = await initGooglePermissionsModel(connection);

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
      if (getTestDbClearOnStart()) {
        await clearDatabase();
        logger.info('Test database cleared on startup');
      }

      if (getTestDbSeedOnStart()) {
        await seedTestDatabase();
        logger.info('Test database seeded on startup');
      }

      const stats = await getDatabaseStats();
      logger.info('Database statistics:', stats);
    }

    const dbType = shouldUseMemoryServer() ? 'Memory' : 'MongoDB';
    logger.info(`All ${dbType} database connections established and verified`);

    return models;
  } catch (error) {
    logger.error('Failed to initialize database models:', error);
    throw error;
  }
};

/**
 * Get models for database operations
 */
export const getModels = async (): Promise<DatabaseModels> => {
  if (!isInitialized || !models) {
    try {
      return await initializeDB();
    } catch (error) {
      throw new DatabaseConnectionError(`Failed to initialize database connections: ${error}`);
    }
  }
  return models;
};

/**
 * Clear database (useful for testing) - now with connection verification
 */
export const clearDatabase = async (): Promise<void> => {
  if (getNodeEnv() === 'production') {
    throw new Error('Database clearing is not allowed in production');
  }

  const connection = await ensureConnection();
  if (!connection.db) {
    throw new DatabaseConnectionError('Database object not available');
  }

  const collections = await connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
  logger.info('Database cleared successfully');
};

/**
 * Get database statistics - now with connection verification
 */
export const getDatabaseStats = async (): Promise<{
  type: 'memory' | 'mongodb';
  collections: string[];
  totalDocuments: number;
}> => {
  const isMemory = shouldUseMemoryServer();
  let collections: string[] = [];
  let totalDocuments = 0;

  try {
    const connection = await ensureConnection();
    if (!connection.db) {
      throw new DatabaseConnectionError('Database object not available');
    }

    const collectionInfos = await connection.db.listCollections().toArray();
    collections = collectionInfos.map((info) => info.name);

    // Count documents in all collections
    for (const collectionName of collections) {
      const count = await connection.db.collection(collectionName).countDocuments();
      totalDocuments += count;
    }
  } catch (error) {
    logger.error('Error getting database stats:', error);
  }

  return {
    type: isMemory ? 'memory' : 'mongodb',
    collections,
    totalDocuments,
  };
};

/**
 * Enhanced seed database with connection verification
 */
export const seedTestDatabase = async (seedingOptions?: SeedingOptions): Promise<void> => {
  if (getNodeEnv() === 'production') {
    throw new Error('Database seeding is not allowed in production');
  }

  try {
    // Ensure connection is ready
    await ensureConnection();

    // Get accounts configuration
    const accountsConfig = getAccountsMockConfig();

    if (!accountsConfig.enabled) {
      logger.info('Accounts mock is disabled, skipping seeding');
      return;
    }

    // Determine which accounts to seed
    let accountsToSeed;

    if (seedingOptions) {
      // Use provided seeding options
      accountsToSeed = getMockAccountsForSeeding(seedingOptions);
      logger.info(`Selective seeding requested:`, {
        mode: seedingOptions.mode,
        tags: seedingOptions.tags,
        accountIds: seedingOptions.accountIds,
        excludeAccountIds: seedingOptions.excludeAccountIds,
        accountsFound: accountsToSeed.length,
      });
    } else {
      // Use default configuration seeding mode
      accountsToSeed = getMockAccountsForSeeding();
      logger.info(
        `Default seeding mode: ${accountsConfig.seedingMode || 'default'}, found ${accountsToSeed.length} accounts`,
      );
    }

    if (accountsToSeed.length === 0) {
      logger.info('No accounts to seed with current criteria');
      return;
    }

    logger.info(`Seeding database with ${accountsToSeed.length} test accounts`);

    // Clear existing mock accounts if requested
    const shouldClear = seedingOptions?.clearOnSeed ?? accountsConfig.clearOnSeed;
    if (shouldClear) {
      const deleteResult = await (
        await getModels()
      ).accounts.Account.deleteMany({
        $or: [
          { 'userDetails.email': { $in: accountsToSeed.map((acc) => acc.email) } },
          {
            'userDetails.username': {
              $in: accountsToSeed.filter((acc) => acc.username).map((acc) => acc.username),
            },
          },
        ],
      });
      logger.info(`Cleared ${deleteResult.deletedCount} existing accounts before seeding`);
    }

    const seededAccounts = [];
    const skippedAccounts = [];
    const failedAccounts = [];

    for (const mockAccount of accountsToSeed) {
      try {
        // Check if account already exists by email
        const existingAccountByEmail = await (
          await getModels()
        ).accounts.Account.findOne({
          'userDetails.email': mockAccount.email,
        });

        if (existingAccountByEmail) {
          logger.info(`Account already exists with email: ${mockAccount.email}, skipping`);
          skippedAccounts.push({
            email: mockAccount.email,
            reason: 'email_exists',
            tags: mockAccount.seedTags,
            testDescription: mockAccount.testDescription,
          });
          continue;
        }

        // Check if username already exists (for local accounts)
        if (mockAccount.username) {
          const existingAccountByUsername = await (
            await getModels()
          ).accounts.Account.findOne({
            'userDetails.username': mockAccount.username,
          });

          if (existingAccountByUsername) {
            logger.info(`Account already exists with username: ${mockAccount.username}, skipping`);
            skippedAccounts.push({
              email: mockAccount.email,
              reason: 'username_exists',
              username: mockAccount.username,
              tags: mockAccount.seedTags,
              testDescription: mockAccount.testDescription,
            });
            continue;
          }
        }

        // Map mock account status to AccountStatus enum
        let accountStatus;
        switch (mockAccount.status) {
          case 'active':
            accountStatus = 'active';
            break;
          case 'suspended':
            accountStatus = 'suspended';
            break;
          case 'inactive':
            accountStatus = 'inactive';
            break;
          case 'unverified':
            accountStatus = 'unverified';
            break;
          default:
            accountStatus = 'active';
        }

        // Create account document based on mock account data
        const timestamp = new Date().toISOString();

        const accountData = {
          created: timestamp,
          updated: timestamp,
          accountType: mockAccount.accountType,
          status: accountStatus,
          ...(mockAccount.provider && { provider: mockAccount.provider }),
          userDetails: {
            name: mockAccount.name,
            firstName: mockAccount.firstName,
            lastName: mockAccount.lastName,
            email: mockAccount.email,
            ...(mockAccount.username && { username: mockAccount.username }),
            ...(mockAccount.imageUrl && { imageUrl: mockAccount.imageUrl }),
            emailVerified: mockAccount.emailVerified,
            ...(mockAccount.birthdate && { birthdate: mockAccount.birthdate }),
          },
          security: {
            ...(mockAccount.password && { password: mockAccount.password }), // Will be hashed by pre-save hook
            twoFactorEnabled: mockAccount.twoFactorEnabled || false,
            sessionTimeout: 3600,
            autoLock: false,
            failedLoginAttempts: 0,
          },
        };

        // Create the account
        const newAccount = await (await getModels()).accounts.Account.create(accountData);
        seededAccounts.push({
          id: newAccount._id.toString(),
          mockId: mockAccount.id,
          email: mockAccount.email,
          name: mockAccount.name,
          accountType: mockAccount.accountType,
          provider: mockAccount.provider,
          status: mockAccount.status || 'active',
          username: mockAccount.username,
          tags: mockAccount.seedTags,
          testDescription: mockAccount.testDescription,
          seedByDefault: mockAccount.seedByDefault,
        });

        const accountTypeLog =
          mockAccount.accountType === 'oauth'
            ? `${mockAccount.accountType} - ${mockAccount.provider}`
            : mockAccount.accountType;

        const tagInfo =
          mockAccount.seedTags && mockAccount.seedTags.length > 0 ? ` [tags: ${mockAccount.seedTags.join(', ')}]` : '';

        const descInfo = mockAccount.testDescription ? ` (${mockAccount.testDescription})` : '';

        logger.info(`Seeded mock account: ${mockAccount.email} (${accountTypeLog})${tagInfo}${descInfo}`);
      } catch (error) {
        logger.error(`Failed to seed account ${mockAccount.email}:`, error);
        failedAccounts.push({
          email: mockAccount.email,
          error: error instanceof Error ? error.message : 'Unknown error',
          tags: mockAccount.seedTags,
          testDescription: mockAccount.testDescription,
        });
        // Continue with other accounts even if one fails
      }
    }

    logger.info(`Database seeding completed successfully.`);
    logger.info(
      `Seeded: ${seededAccounts.length}, Skipped: ${skippedAccounts.length}, Failed: ${failedAccounts.length}`,
    );

    // Enhanced seeding statistics
    const stats = {
      totalAttempted: accountsToSeed.length,
      totalSeeded: seededAccounts.length,
      totalSkipped: skippedAccounts.length,
      totalFailed: failedAccounts.length,
      byAccountType: {} as Record<string, number>,
      byProvider: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      byTags: {} as Record<string, number>,
      seedingOptions: seedingOptions || { mode: accountsConfig.seedingMode || 'default' },
      seededAccounts: seededAccounts.map((acc) => ({
        mockId: acc.mockId,
        email: acc.email,
        name: acc.name,
        accountType: acc.accountType,
        provider: acc.provider,
        status: acc.status,
        tags: acc.tags,
        testDescription: acc.testDescription,
      })),
      skippedAccounts,
      failedAccounts,
    };

    // Calculate statistics
    seededAccounts.forEach((account) => {
      stats.byAccountType[account.accountType] = (stats.byAccountType[account.accountType] || 0) + 1;
      if (account.provider) {
        stats.byProvider[account.provider] = (stats.byProvider[account.provider] || 0) + 1;
      }
      stats.byStatus[account.status] = (stats.byStatus[account.status] || 0) + 1;

      if (account.tags && account.tags.length > 0) {
        account.tags.forEach((tag) => {
          stats.byTags[tag] = (stats.byTags[tag] || 0) + 1;
        });
      }
    });

    logger.info('Seeding statistics:', stats);

    // Also log OAuth mock service status if available
    try {
      const oauthConfig = getOAuthMockConfig();

      if (oauthConfig.enabled) {
        const enabledProviders = [];
        if (oauthConfig.providers?.google?.enabled) enabledProviders.push('google');
        if (oauthConfig.providers?.microsoft?.enabled) enabledProviders.push('microsoft');
        if (oauthConfig.providers?.facebook?.enabled) enabledProviders.push('facebook');

        logger.info('OAuth mock service configuration:', {
          enabled: oauthConfig.enabled,
          enabledProviders,
          simulateDelay: oauthConfig.simulateDelay,
          simulateErrors: oauthConfig.simulateErrors,
        });
      }
    } catch {
      logger.warn('Could not load OAuth configuration for logging');
    }

    logger.info('Database seeding completed successfully');
  } catch (error) {
    logger.error('Failed to seed test database:', error);
    throw error;
  }
};

/**
 * Close all database connections
 */
export const closeAllConnections = async (): Promise<void> => {
  try {
    if (connectionState.connection) {
      await connectionState.connection.close();
      connectionState.connection = null;
      connectionState.isConnected = false;
      connectionState.isConnecting = false;
      connectionState.connectionPromise = null;
    }

    if (shouldUseMemoryServer()) {
      await stopMemoryServer();
    }

    models = null;
    isInitialized = false;

    logger.info('All database connections closed');
  } catch (error) {
    logger.error('Error closing database connections:', error);
    throw error;
  }
};

/**
 * Get authentication database connection status with detailed info
 */
export const getAuthConnectionStatus = (): {
  connected: boolean;
  connecting: boolean;
  readyState: number;
  host?: string;
  name?: string;
  lastConnectionTime?: Date;
  memoryServer: boolean;
} => {
  const status = {
    connected: connectionState.isConnected,
    connecting: connectionState.isConnecting,
    readyState: connectionState.connection?.readyState || mongoose.ConnectionStates.disconnected,
    memoryServer: shouldUseMemoryServer(),
    lastConnectionTime: connectionState.lastConnectionTime || undefined,
  };

  if (connectionState.connection && connectionState.isConnected) {
    return {
      ...status,
      host: connectionState.connection.host,
      name: connectionState.connection.name,
    };
  }

  return status;
};
