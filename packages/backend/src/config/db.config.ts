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

// Create connection for authentication
let authConnection: mongoose.Connection | null = null;

// Memory server instance for testing
let memoryServer: MongoMemoryServer | null = null;

// Track initialization state
let isInitialized = false;
let models: DatabaseModels | null = null;

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

  /**
   * Register cleanup handlers on module load
   */
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
        port: 27017, // Use default port for consistency
      },
      binary: {
        version: '7.0.0', // Use specific MongoDB version
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

  // Use provided URI or construct default
  const providedUri = getAccountsDbUri();
  if (providedUri) {
    return providedUri;
  }

  throw new Error('ACCOUNTS_DB_URI is missing');
}

/**
 * Connect to the authentication database
 */
export const connectAuthDB = async (forceNew: boolean = false): Promise<mongoose.Connection> => {
  try {
    // Return existing connection if available and not forcing a new one
    if (authConnection && !forceNew) {
      const state = authConnection.readyState;

      // If connected, return existing connection
      if (state === mongoose.ConnectionStates.connected) {
        logger.debug('Returning existing authentication database connection');
        return authConnection;
      }

      // If connecting, wait for it to complete
      if (state === mongoose.ConnectionStates.connecting) {
        logger.debug('Waiting for existing authentication database connection to complete');
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            authConnection!.off('connected', onConnected);
            authConnection!.off('error', onError);
            reject(new Error('Connection timeout'));
          }, 30000); // 30 second timeout

          const onConnected = () => {
            clearTimeout(timeout);
            authConnection!.off('error', onError);
            resolve();
          };

          const onError = (err: Error) => {
            clearTimeout(timeout);
            authConnection!.off('connected', onConnected);
            reject(err);
          };

          authConnection!.once('connected', onConnected);
          authConnection!.once('error', onError);
        });
        return authConnection;
      }
    }

    // Force close existing connection if forceNew is true
    if (forceNew && authConnection) {
      logger.info('Forcing new authentication database connection - closing existing connection');
      await authConnection.close();
      authConnection = null;
    }

    const authURI = await getMongoDbUri();

    // Create a new connection
    authConnection = mongoose.createConnection(authURI);

    const dbType = shouldUseMemoryServer() ? 'Memory' : 'MongoDB';
    logger.info(`${dbType} authentication database connected successfully`);

    // Setup connection error handlers
    authConnection.on('error', (err) => {
      logger.error('Authentication database connection error:', err);
    });

    authConnection.on('disconnected', () => {
      logger.warn('Authentication database disconnected');
    });

    authConnection.on('reconnected', () => {
      logger.info('Authentication database reconnected');
    });

    // Memory server specific logging
    if (shouldUseMemoryServer()) {
      logger.info('Using MongoDB Memory Server for testing');
      logger.info('Database will be cleared when server stops');
    }

    return authConnection;
  } catch (error) {
    logger.error('Authentication database connection error:', error);

    // If memory server fails, try regular MongoDB
    if (shouldUseMemoryServer()) {
      logger.warn('Memory server failed, falling back to regular MongoDB');
      process.env.USE_MEMORY_DB = 'false'; // Disable memory server for this session
    }

    process.exit(1);
  }
};

/**
 * Initialize all database connections and models
 * This ensures models are available before they're used
 */
export const initializeDB = async (): Promise<DatabaseModels> => {
  try {
    // Connect to database
    const connection = await connectAuthDB();

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
      // Clear database if requested
      if (getTestDbClearOnStart()) {
        await clearDatabase();
        logger.info('Test database cleared on startup');
      }

      // Seed database if requested
      if (getTestDbSeedOnStart()) {
        await seedTestDatabase();
        logger.info('Test database seeded on startup');
      }

      // Log database stats for development/test
      const stats = await getDatabaseStats();
      logger.info('Database statistics:', stats);
    }

    const dbType = shouldUseMemoryServer() ? 'Memory' : 'MongoDB';
    logger.info(`All ${dbType} database connections established`);

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
export const getModels = async (): Promise<DatabaseModels> => {
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
 * Enhanced seed database with selective seeding support
 */
export const seedTestDatabase = async (seedingOptions?: SeedingOptions): Promise<void> => {
  if (getNodeEnv() === 'production') {
    throw new Error('Database seeding is not allowed in production');
  }

  try {
    // Get the authentication connection
    if (!authConnection) {
      throw new Error('Database connection not established');
    }

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
  } catch (error) {
    logger.error('Failed to seed test database:', error);
    throw error;
  }
};

/**
 * Clear database (useful for testing)
 */
export const clearDatabase = async (): Promise<void> => {
  if (getNodeEnv() === 'production') {
    throw new Error('Database clearing is not allowed in production');
  }

  if (authConnection && authConnection.db) {
    const collections = await authConnection.db.collections();

    await Promise.all(collections.map((collection) => collection.deleteMany({})));

    logger.info('Database cleared successfully');
  }
};

/**
 * Enhanced cleanup with selective removal
 */
export const cleanupSeededTestData = async (seedingOptions?: SeedingOptions): Promise<void> => {
  if (getNodeEnv() === 'production') {
    throw new Error('Database cleanup is not allowed in production');
  }

  try {
    if (!authConnection) {
      throw new Error('Database connection not established');
    }

    let accountsToClean;

    if (seedingOptions) {
      // Use provided seeding options to determine what to clean
      accountsToClean = getMockAccountsForSeeding(seedingOptions);
      logger.info(`Selective cleanup requested for ${accountsToClean.length} accounts`);
    } else {
      // Clean all configured accounts
      const accountsConfig = getAccountsMockConfig();
      accountsToClean = accountsConfig.accounts || [];
      logger.info(`Cleaning all ${accountsToClean.length} configured mock accounts`);
    }

    if (accountsToClean.length === 0) {
      logger.info('No mock accounts to clean up');
      return;
    }

    // Remove accounts by email addresses
    const emailsToRemove = accountsToClean.map((acc) => acc.email);
    const result = await (
      await getModels()
    ).accounts.Account.deleteMany({
      'userDetails.email': { $in: emailsToRemove },
    });

    logger.info(`Cleaned up ${result.deletedCount} test accounts`, {
      requestedCleanup: accountsToClean.length,
      actuallyRemoved: result.deletedCount,
      seedingOptions: seedingOptions || 'all_configured',
    });
  } catch (error) {
    logger.error('Failed to cleanup seeded test data:', error);
    throw error;
  }
};

/**
 * Seed specific accounts by tags
 */
export const seedAccountsByTags = async (tags: string[], clearOnSeed: boolean = false): Promise<void> => {
  const seedingOptions: SeedingOptions = {
    mode: 'tagged',
    tags,
    clearOnSeed,
  };

  await seedTestDatabase(seedingOptions);
};

/**
 * Seed specific accounts by IDs
 */
export const seedAccountsById = async (accountIds: string[], clearOnSeed: boolean = false): Promise<void> => {
  const seedingOptions: SeedingOptions = {
    mode: 'explicit',
    accountIds,
    clearOnSeed,
  };

  await seedTestDatabase(seedingOptions);
};

/**
 * Seed only default accounts (those with seedByDefault: true)
 */
export const seedDefaultAccounts = async (clearOnSeed: boolean = false): Promise<void> => {
  const seedingOptions: SeedingOptions = {
    mode: 'default',
    clearOnSeed,
  };

  await seedTestDatabase(seedingOptions);
};

/**
 * Seed all accounts regardless of seedByDefault flag
 */
export const seedAllAccounts = async (clearOnSeed: boolean = false): Promise<void> => {
  const seedingOptions: SeedingOptions = {
    mode: 'all',
    clearOnSeed,
  };

  await seedTestDatabase(seedingOptions);
};

/**
 * Enhanced get seeded account statistics with filtering support
 */
export const getSeededAccountStats = async (
  filterOptions?: SeedingOptions,
): Promise<{
  totalSeededAccounts: number;
  accountsByType: Record<string, number>;
  accountsByProvider: Record<string, number>;
  accountsByStatus: Record<string, number>;
  accountsByTags: Record<string, number>;
  accounts: Array<{
    id: string;
    email: string;
    name: string;
    accountType: string;
    provider?: string;
    status: string;
    username?: string;
    tags?: string[];
    testDescription?: string;
  }>;
}> => {
  try {
    if (!authConnection) {
      throw new Error('Database connection not established');
    }

    // Get all seeded accounts first
    const accountsConfig = getAccountsMockConfig();
    const allMockEmails = accountsConfig.accounts.map((acc) => acc.email);

    const seededAccounts = await (
      await getModels()
    ).accounts.Account.find({
      'userDetails.email': { $in: allMockEmails },
    }).select('userDetails provider status accountType');

    // Create a map of email to mock account for tag lookup
    const mockAccountMap = new Map(accountsConfig.accounts.map((acc) => [acc.email, acc]));

    // Convert to our stats format and add tag information
    let accountsWithTags = seededAccounts.map((account) => {
      const mockAccount = mockAccountMap.get(account.userDetails.email || '');
      return {
        id: account._id.toString(),
        email: account.userDetails.email || '',
        name: account.userDetails.name || '',
        accountType: account.accountType || '',
        provider: account.provider,
        status: account.status || '',
        username: account.userDetails.username,
        tags: mockAccount?.seedTags || [],
        testDescription: mockAccount?.testDescription,
      };
    });

    // Apply filtering if provided
    if (filterOptions) {
      const filteredMockAccounts = getMockAccountsForSeeding(filterOptions);
      const filteredEmails = new Set(filteredMockAccounts.map((acc) => acc.email));
      accountsWithTags = accountsWithTags.filter((acc) => filteredEmails.has(acc.email));
    }

    const stats = {
      totalSeededAccounts: accountsWithTags.length,
      accountsByType: {} as Record<string, number>,
      accountsByProvider: {} as Record<string, number>,
      accountsByStatus: {} as Record<string, number>,
      accountsByTags: {} as Record<string, number>,
      accounts: accountsWithTags,
    };

    // Calculate statistics
    accountsWithTags.forEach((account) => {
      const accountType = account.accountType || 'unknown';
      const provider = account.provider;
      const status = account.status || 'unknown';

      stats.accountsByType[accountType] = (stats.accountsByType[accountType] || 0) + 1;
      if (provider) {
        stats.accountsByProvider[provider] = (stats.accountsByProvider[provider] || 0) + 1;
      }
      stats.accountsByStatus[status] = (stats.accountsByStatus[status] || 0) + 1;

      if (account.tags && account.tags.length > 0) {
        account.tags.forEach((tag) => {
          stats.accountsByTags[tag] = (stats.accountsByTags[tag] || 0) + 1;
        });
      }
    });

    return stats;
  } catch (error) {
    logger.error('Failed to get seeded account statistics:', error);
    throw error;
  }
};

/**
 * Get database statistics
 */
export const getDatabaseStats = async (): Promise<{
  type: 'memory' | 'mongodb';
  collections: string[];
  totalDocuments: number;
}> => {
  const isMemory = shouldUseMemoryServer();

  let collections: string[] = [];
  let totalDocuments = 0;

  if (authConnection && authConnection.db) {
    try {
      const collectionInfos = await authConnection.db.listCollections().toArray();
      collections = collectionInfos.map((info) => info.name);

      // Count documents in all collections
      for (const collectionName of collections) {
        const count = await authConnection.db.collection(collectionName).countDocuments();
        totalDocuments += count;
      }
    } catch (error) {
      logger.error('Error getting database stats:', error);
    }
  }

  return {
    type: isMemory ? 'memory' : 'mongodb',
    collections,
    totalDocuments,
  };
};

/**
 * Close all database connections
 */
export const closeAllConnections = async (): Promise<void> => {
  try {
    if (authConnection) {
      await authConnection.close();
      authConnection = null;
    }

    // Stop memory server if it was used
    if (shouldUseMemoryServer()) {
      await stopMemoryServer();
    }

    // Reset state
    models = null;
    isInitialized = false;

    logger.info('All database connections closed');
  } catch (error) {
    logger.error('Error closing database connections:', error);
    throw error;
  }
};

/**
 * Get authentication database connection status
 */
export const getAuthConnectionStatus = (): {
  connected: boolean;
  readyState: number;
  host?: string;
  name?: string;
  collections?: number;
  memoryServer: boolean;
} => {
  if (!authConnection) {
    return {
      connected: false,
      readyState: mongoose.ConnectionStates.disconnected,
      memoryServer: shouldUseMemoryServer(),
    };
  }

  const readyState = authConnection.readyState;
  const connected = readyState === mongoose.ConnectionStates.connected;

  const status = {
    connected,
    readyState,
    memoryServer: shouldUseMemoryServer(),
  };

  // Add additional info if connected
  if (connected && authConnection.db) {
    return {
      ...status,
      host: authConnection.host,
      name: authConnection.name,
    };
  }

  return status;
};
