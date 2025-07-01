import mongoose from 'mongoose';
import { getAccountsDbUri, getNodeEnv } from './env.config';
import { logger } from '../utils/logger';
import { MongoMemoryServer } from 'mongodb-memory-server';

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

  // This would be implemented to seed with test accounts
  // For now, just log that seeding would happen here
  logger.info('Database seeding would happen here');
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
