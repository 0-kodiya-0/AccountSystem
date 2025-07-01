import mongoose from 'mongoose';
import { getAccountsDbUri, getNodeEnv } from './env.config';
import { logger } from '../utils/logger';
import { MongoMemoryServer } from 'mongodb-memory-server';
import initAccountModel from '../feature/account/Account.model';
import { getAccountsMockConfig, getOAuthMockConfig } from './mock.config';

// Create separate connections for accounts and auth
const connections = {
  accounts: null as mongoose.Connection | null,
};

// Memory server instance for testing
let memoryServer: MongoMemoryServer | null = null;
/**
 * Check if we should use MongoDB Memory Server
 */
function shouldUseMemoryServer(): boolean {
  const nodeEnv = getNodeEnv();
  const useMemoryDb = process.env.USE_MEMORY_DB === 'true';
  const isTestOrDev = nodeEnv === 'test' || nodeEnv === 'development';

  return MongoMemoryServer && useMemoryDb && isTestOrDev;
}

/**
 * Start MongoDB Memory Server
 */
async function startMemoryServer(): Promise<string> {
  if (!MongoMemoryServer) {
    throw new Error('MongoDB Memory Server is not available');
  }

  try {
    memoryServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'test-accounts-db',
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
async function stopMemoryServer(): Promise<void> {
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
 * Connect to the accounts database
 */
export const connectAccountsDB = async (): Promise<mongoose.Connection> => {
  try {
    const accountsURI = await getMongoDbUri();

    // Create a new connection
    if (!connections.accounts) {
      connections.accounts = mongoose.createConnection(accountsURI);

      const dbType = shouldUseMemoryServer() ? 'Memory' : 'MongoDB';
      logger.info(`${dbType} accounts database connected successfully`);

      // Setup connection error handlers
      connections.accounts.on('error', (err) => {
        logger.error('Accounts database connection error:', err);
      });

      connections.accounts.on('disconnected', () => {
        logger.warn('Accounts database disconnected');
      });

      connections.accounts.on('reconnected', () => {
        logger.info('Accounts database reconnected');
      });

      // Memory server specific logging
      if (shouldUseMemoryServer()) {
        logger.info('Using MongoDB Memory Server for testing');
        logger.info('Database will be cleared when server stops');
      }
    }

    return connections.accounts;
  } catch (error) {
    logger.error('Accounts database connection error:', error);

    // If memory server fails, try regular MongoDB
    if (shouldUseMemoryServer()) {
      logger.warn('Memory server failed, falling back to regular MongoDB');
      process.env.USE_MEMORY_DB = 'false'; // Disable memory server for this session
      return connectAccountsDB(); // Retry with regular MongoDB
    }

    process.exit(1);
  }
};

/**
 * Connect to all databases
 */
export const connectAllDatabases = async (): Promise<void> => {
  await Promise.all([connectAccountsDB()]);

  const dbType = shouldUseMemoryServer() ? 'Memory' : 'MongoDB';
  logger.info(`All ${dbType} database connections established`);
};

/**
 * Close all database connections
 */
export const closeAllConnections = async (): Promise<void> => {
  await Promise.all([connections.accounts?.close()]);

  // Stop memory server if it was used
  if (shouldUseMemoryServer()) {
    await stopMemoryServer();
  }

  // Reset connections
  connections.accounts = null;

  logger.info('All database connections closed');
};

/**
 * Clear database (useful for testing)
 */
export const clearDatabase = async (): Promise<void> => {
  if (getNodeEnv() === 'production') {
    throw new Error('Database clearing is not allowed in production');
  }

  if (connections.accounts && connections.accounts.db) {
    const collections = await connections.accounts.db.collections();

    await Promise.all(collections.map((collection) => collection.deleteMany({})));

    logger.info('Database cleared successfully');
  }
};

/**
 * Seed database with test data (useful for testing)
 */
export const seedTestDatabase = async (): Promise<void> => {
  if (getNodeEnv() === 'production') {
    throw new Error('Database seeding is not allowed in production');
  }

  try {
    // Get the accounts connection
    if (!connections.accounts || connections.accounts.readyState !== mongoose.ConnectionStates.connected) {
      throw new Error('Database connection not established');
    }

    const accountsConfig = getAccountsMockConfig();

    if (!accountsConfig.enabled || !accountsConfig.accounts || accountsConfig.accounts.length === 0) {
      logger.info('No mock accounts to seed or accounts mock is disabled');
      return;
    }

    const AccountModel = await initAccountModel();

    logger.info(`Seeding database with ${accountsConfig.accounts.length} test accounts`);

    // Clear existing mock accounts if requested
    if (accountsConfig.clearOnSeed) {
      const deleteResult = await AccountModel.deleteMany({
        $or: [
          { 'userDetails.email': { $in: accountsConfig.accounts.map((acc) => acc.email) } },
          {
            'userDetails.username': {
              $in: accountsConfig.accounts.filter((acc) => acc.username).map((acc) => acc.username),
            },
          },
        ],
      });
      logger.info(`Cleared ${deleteResult.deletedCount} existing accounts before seeding`);
    }

    const seededAccounts = [];
    const skippedAccounts = [];
    const failedAccounts = [];

    for (const mockAccount of accountsConfig.accounts) {
      try {
        // Check if account already exists by email
        const existingAccountByEmail = await AccountModel.findOne({
          'userDetails.email': mockAccount.email,
        });

        if (existingAccountByEmail) {
          logger.info(`Account already exists with email: ${mockAccount.email}, skipping`);
          skippedAccounts.push({ email: mockAccount.email, reason: 'email_exists' });
          continue;
        }

        // Check if username already exists (for local accounts)
        if (mockAccount.username) {
          const existingAccountByUsername = await AccountModel.findOne({
            'userDetails.username': mockAccount.username,
          });

          if (existingAccountByUsername) {
            logger.info(`Account already exists with username: ${mockAccount.username}, skipping`);
            skippedAccounts.push({
              email: mockAccount.email,
              reason: 'username_exists',
              username: mockAccount.username,
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
        const newAccount = await AccountModel.create(accountData);
        seededAccounts.push({
          id: newAccount._id.toString(),
          mockId: mockAccount.id,
          email: mockAccount.email,
          name: mockAccount.name,
          accountType: mockAccount.accountType,
          provider: mockAccount.provider,
          status: mockAccount.status || 'active',
          username: mockAccount.username,
        });

        logger.info(
          `Seeded mock account: ${mockAccount.email} (${mockAccount.accountType}${
            mockAccount.provider ? ` - ${mockAccount.provider}` : ''
          })`,
        );
      } catch (error) {
        logger.error(`Failed to seed account ${mockAccount.email}:`, error);
        failedAccounts.push({
          email: mockAccount.email,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Continue with other accounts even if one fails
      }
    }

    logger.info(`Database seeding completed successfully.`);
    logger.info(
      `Seeded: ${seededAccounts.length}, Skipped: ${skippedAccounts.length}, Failed: ${failedAccounts.length}`,
    );

    // Log seeding statistics
    const stats = {
      totalAttempted: accountsConfig.accounts.length,
      totalSeeded: seededAccounts.length,
      totalSkipped: skippedAccounts.length,
      totalFailed: failedAccounts.length,
      byAccountType: {} as Record<string, number>,
      byProvider: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      seededAccounts: seededAccounts.map((acc) => ({
        mockId: acc.mockId,
        email: acc.email,
        name: acc.name,
        accountType: acc.accountType,
        provider: acc.provider,
        status: acc.status,
      })),
      skippedAccounts,
      failedAccounts,
    };

    seededAccounts.forEach((account) => {
      stats.byAccountType[account.accountType] = (stats.byAccountType[account.accountType] || 0) + 1;
      if (account.provider) {
        stats.byProvider[account.provider] = (stats.byProvider[account.provider] || 0) + 1;
      }
      stats.byStatus[account.status] = (stats.byStatus[account.status] || 0) + 1;
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
 * Clean up seeded test data
 */
export const cleanupSeededTestData = async (): Promise<void> => {
  if (getNodeEnv() === 'production') {
    throw new Error('Database cleanup is not allowed in production');
  }

  try {
    if (!connections.accounts || connections.accounts.readyState !== mongoose.ConnectionStates.connected) {
      throw new Error('Database connection not established');
    }

    const accountsConfig = getAccountsMockConfig();

    if (!accountsConfig.enabled || !accountsConfig.accounts || accountsConfig.accounts.length === 0) {
      logger.info('No mock accounts configured to clean up');
      return;
    }

    const AccountModel = await initAccountModel();

    // Remove accounts by email addresses from the mock config
    const emailsToRemove = accountsConfig.accounts.map((acc) => acc.email);
    const result = await AccountModel.deleteMany({
      'userDetails.email': { $in: emailsToRemove },
    });

    logger.info(`Cleaned up ${result.deletedCount} seeded test accounts`);
  } catch (error) {
    logger.error('Failed to cleanup seeded test data:', error);
    throw error;
  }
};

/**
 * Get seeded account statistics
 */
export const getSeededAccountStats = async (): Promise<{
  totalSeededAccounts: number;
  accountsByType: Record<string, number>;
  accountsByProvider: Record<string, number>;
  accountsByStatus: Record<string, number>;
  accounts: Array<{
    id: string;
    email: string;
    name: string;
    accountType: string;
    provider?: string;
    status: string;
    username?: string;
  }>;
}> => {
  try {
    if (!connections.accounts || connections.accounts.readyState !== mongoose.ConnectionStates.connected) {
      throw new Error('Database connection not established');
    }

    const accountsConfig = getAccountsMockConfig();

    if (!accountsConfig.enabled || !accountsConfig.accounts || accountsConfig.accounts.length === 0) {
      return {
        totalSeededAccounts: 0,
        accountsByType: {},
        accountsByProvider: {},
        accountsByStatus: {},
        accounts: [],
      };
    }

    const AccountModel = await initAccountModel();

    // Find accounts that match the mock configuration emails
    const mockEmails = accountsConfig.accounts.map((acc) => acc.email);
    const seededAccounts = await AccountModel.find({
      'userDetails.email': { $in: mockEmails },
    }).select('userDetails provider status accountType');

    const stats = {
      totalSeededAccounts: seededAccounts.length,
      accountsByType: {} as Record<string, number>,
      accountsByProvider: {} as Record<string, number>,
      accountsByStatus: {} as Record<string, number>,
      accounts: seededAccounts.map((account) => ({
        id: account._id.toString(),
        email: account.userDetails.email || '',
        name: account.userDetails.name || '',
        accountType: account.accountType || '',
        provider: account.provider,
        status: account.status || '',
        username: account.userDetails.username,
      })),
    };

    // Calculate statistics
    seededAccounts.forEach((account) => {
      const accountType = account.accountType || 'unknown';
      const provider = account.provider;
      const status = account.status || 'unknown';

      stats.accountsByType[accountType] = (stats.accountsByType[accountType] || 0) + 1;
      if (provider) {
        stats.accountsByProvider[provider] = (stats.accountsByProvider[provider] || 0) + 1;
      }
      stats.accountsByStatus[status] = (stats.accountsByStatus[status] || 0) + 1;
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
  connected: boolean;
  collections: string[];
  totalDocuments: number;
}> => {
  const isMemory = shouldUseMemoryServer();
  const isConnected = connections.accounts?.readyState === mongoose.ConnectionStates.connected;

  let collections: string[] = [];
  let totalDocuments = 0;

  if (isConnected && connections.accounts && connections.accounts.db) {
    try {
      const collectionInfos = await connections.accounts.db.listCollections().toArray();
      collections = collectionInfos.map((info) => info.name);

      // Count documents in all collections
      for (const collectionName of collections) {
        const count = await connections.accounts.db.collection(collectionName).countDocuments();
        totalDocuments += count;
      }
    } catch (error) {
      logger.error('Error getting database stats:', error);
    }
  }

  return {
    type: isMemory ? 'memory' : 'mongodb',
    connected: isConnected,
    collections,
    totalDocuments,
  };
};

export default {
  connectAccountsDB,
  connectAllDatabases,
  closeAllConnections,
  clearDatabase,
  seedTestDatabase,
  getDatabaseStats,
  connections,
};
