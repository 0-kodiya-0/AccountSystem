import mongoose from "mongoose";
import {
  getAccountsDbUri,
  getMongodbPassword,
  getMongodbUsername,
} from "./env.config";
import { logger } from "../utils/logger";

// Create separate connections for accounts and auth
const connections = {
  accounts: null as mongoose.Connection | null,
};

const username = encodeURIComponent(getMongodbUsername());
const password = encodeURIComponent(getMongodbPassword());

/**
 * Connect to the accounts database
 */
export const connectAccountsDB = async (): Promise<mongoose.Connection> => {
  try {
    const accountsURI =
      getAccountsDbUri() ||
      `mongodb+srv://${username}:${password}@fusion-space.vb7xt.mongodb.net/accounts-db?retryWrites=true&w=majority&appName=Fusion-space`;

    // Create a new connection
    if (!connections.accounts) {
      connections.accounts = mongoose.createConnection(accountsURI);
      logger.info("Accounts database connected successfully");

      // Setup connection error handlers
      connections.accounts.on("error", (err) => {
        logger.error("Accounts database connection error:", err);
      });

      connections.accounts.on("disconnected", () => {
        logger.warn("Accounts database disconnected");
      });
    }

    return connections.accounts;
  } catch (error) {
    logger.error("Accounts database connection error:", error);
    process.exit(1);
  }
};

/**
 * Connect to both databases
 */
export const connectAllDatabases = async (): Promise<void> => {
  await Promise.all([connectAccountsDB()]);
  logger.info("All database connections established");
};

/**
 * Close all database connections
 */
export const closeAllConnections = async (): Promise<void> => {
  await Promise.all([connections.accounts?.close()]);
  logger.info("All database connections closed");
};

export default {
  connectAccountsDB,
  connectAllDatabases,
  closeAllConnections,
  connections,
};
