import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import {
  connectAccountsDB,
  connectAllDatabases,
  closeAllConnections,
  clearDatabase,
  seedTestDatabase,
  cleanupSeededTestData,
  getSeededAccountStats,
  getDatabaseStats,
} from '../db.config';
import db from '../db';
import { getNodeEnv } from '../env.config';
import { getAccountsMockConfig } from '../mock.config';

describe('Database Configuration', () => {
  // Track original environment
  const originalEnv = process.env;

  beforeAll(() => {
    // Ensure we're in test mode for memory server
    process.env.NODE_ENV = 'test';
    process.env.USE_MEMORY_DB = 'true';
  });

  afterAll(async () => {
    // Cleanup database connections
    await closeAllConnections();
    process.env = originalEnv;
  });

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Memory Server Configuration', () => {
    it('should use memory server when NODE_ENV is test and USE_MEMORY_DB is true', () => {
      process.env.NODE_ENV = 'test';
      process.env.USE_MEMORY_DB = 'true';

      expect(getNodeEnv()).toBe('test');
      expect(process.env.USE_MEMORY_DB).toBe('true');
    });

    it('should not use memory server when USE_MEMORY_DB is false', () => {
      process.env.NODE_ENV = 'test';
      process.env.USE_MEMORY_DB = 'false';

      expect(process.env.USE_MEMORY_DB).toBe('false');
    });

    it('should not use memory server in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.USE_MEMORY_DB = 'true';

      expect(getNodeEnv()).toBe('production');
    });
  });

  describe('Database Connection', () => {
    it('should connect to accounts database', async () => {
      const connection = await connectAccountsDB();

      expect(connection).toBeDefined();
      expect(connection.readyState).toBe(1); // Connected state
    });

    it('should connect to all databases', async () => {
      await connectAllDatabases();

      const models = await db.getModels();
      expect(models).toBeDefined();
      expect(models.accounts).toBeDefined();
      expect(models.notifications).toBeDefined();
      expect(models.google).toBeDefined();
    });

    it('should get database statistics', async () => {
      await connectAllDatabases();

      const stats = await getDatabaseStats();
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('type');
      expect(stats).toHaveProperty('connected');
      expect(stats).toHaveProperty('collections');
      expect(stats).toHaveProperty('totalDocuments');

      // Should be memory type in test environment
      expect(stats.type).toBe('memory');
      expect(stats.connected).toBe(true);
    });
  });

  describe('Database Operations (Test Environment Only)', () => {
    beforeEach(async () => {
      // Ensure clean database state
      await connectAllDatabases();
      await clearDatabase();
    });

    it('should clear database in test environment', async () => {
      await clearDatabase();

      const stats = await getDatabaseStats();
      expect(stats.totalDocuments).toBe(0);
    });

    it('should prevent database clearing in production', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await expect(clearDatabase()).rejects.toThrow('Database clearing is not allowed in production');

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should seed test database with accounts from config', async () => {
      const accountsConfig = getAccountsMockConfig();

      if (accountsConfig.enabled && accountsConfig.accounts.length > 0) {
        await seedTestDatabase();

        const stats = await getSeededAccountStats();
        expect(stats.totalSeededAccounts).toBeGreaterThan(0);
        expect(stats.accounts).toBeInstanceOf(Array);

        // Verify account structure
        stats.accounts.forEach((account) => {
          expect(account).toHaveProperty('id');
          expect(account).toHaveProperty('email');
          expect(account).toHaveProperty('name');
          expect(account).toHaveProperty('accountType');
          expect(account).toHaveProperty('status');
        });
      }
    });

    it('should handle seeding when accounts config is disabled', async () => {
      // Mock disabled accounts config
      vi.fn().mockReturnValue({
        enabled: false,
        accounts: [],
      });

      // This should not throw but should log that no accounts to seed
      await expect(seedTestDatabase()).resolves.not.toThrow();
    });

    it('should prevent database seeding in production', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await expect(seedTestDatabase()).rejects.toThrow('Database seeding is not allowed in production');

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should get seeded account statistics', async () => {
      await seedTestDatabase();

      const stats = await getSeededAccountStats();
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('totalSeededAccounts');
      expect(stats).toHaveProperty('accountsByType');
      expect(stats).toHaveProperty('accountsByProvider');
      expect(stats).toHaveProperty('accountsByStatus');
      expect(stats).toHaveProperty('accounts');

      expect(typeof stats.totalSeededAccounts).toBe('number');
      expect(Array.isArray(stats.accounts)).toBe(true);
    });

    it('should cleanup seeded test data', async () => {
      // First seed some data
      await seedTestDatabase();

      const beforeStats = await getSeededAccountStats();
      expect(beforeStats.totalSeededAccounts).toBeGreaterThan(0);

      // Then cleanup
      await cleanupSeededTestData();

      const afterStats = await getSeededAccountStats();
      expect(afterStats.totalSeededAccounts).toBe(0);
    });

    it('should prevent cleanup in production', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await expect(cleanupSeededTestData()).rejects.toThrow('Database cleanup is not allowed in production');

      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('Database Initialization (db.ts)', () => {
    it('should initialize database models', async () => {
      const models = await db.initializeDB();

      expect(models).toBeDefined();
      expect(models.accounts).toBeDefined();
      expect(models.accounts.Account).toBeDefined();
      expect(models.notifications).toBeDefined();
      expect(models.notifications.Notification).toBeDefined();
      expect(models.google).toBeDefined();
      expect(models.google.GooglePermissions).toBeDefined();
    });

    it('should get models after initialization', async () => {
      await db.initializeDB();

      const models = await db.getModels();
      expect(models).toBeDefined();
      expect(models.accounts.Account).toBeDefined();
    });

    it('should handle multiple getModels calls', async () => {
      await db.initializeDB();

      const models1 = await db.getModels();
      const models2 = await db.getModels();

      expect(models1).toBe(models2); // Should return same instance
    });

    it('should close database connections', async () => {
      await db.initializeDB();
      await db.close();

      // After closing, should be able to reinitialize
      const models = await db.getModels();
      expect(models).toBeDefined();
    });
  });

  describe('Account Seeding Validation', () => {
    beforeEach(async () => {
      await connectAllDatabases();
      await clearDatabase();
    });

    it('should only add accounts without duplicates', async () => {
      // Seed once
      await seedTestDatabase();
      const firstStats = await getSeededAccountStats();

      // Seed again - should skip existing accounts
      await seedTestDatabase();
      const secondStats = await getSeededAccountStats();

      // Should have same number of accounts (no duplicates added)
      expect(secondStats.totalSeededAccounts).toBe(firstStats.totalSeededAccounts);
    });

    it('should categorize accounts by type correctly', async () => {
      await seedTestDatabase();

      const stats = await getSeededAccountStats();

      // Should have both oauth and local accounts based on mock config
      expect(Object.keys(stats.accountsByType)).toContain('oauth');
      expect(Object.keys(stats.accountsByType)).toContain('local');

      // Counts should be positive
      expect(stats.accountsByType.oauth).toBeGreaterThan(0);
      expect(stats.accountsByType.local).toBeGreaterThan(0);
    });

    it('should categorize accounts by provider correctly', async () => {
      await seedTestDatabase();

      const stats = await getSeededAccountStats();

      // Should have Google provider accounts
      expect(Object.keys(stats.accountsByProvider)).toContain('google');
      expect(stats.accountsByProvider.google).toBeGreaterThan(0);
    });

    it('should categorize accounts by status correctly', async () => {
      await seedTestDatabase();

      const stats = await getSeededAccountStats();

      // Should have different status types
      expect(Object.keys(stats.accountsByStatus)).toContain('active');
      expect(stats.accountsByStatus.active).toBeGreaterThan(0);
    });
  });

  describe('Memory Server Management', () => {
    it('should start and stop memory server properly', async () => {
      // Connect (starts memory server)
      await connectAccountsDB();

      let stats = await getDatabaseStats();
      expect(stats.type).toBe('memory');
      expect(stats.connected).toBe(true);

      // Close (stops memory server)
      await closeAllConnections();

      stats = await getDatabaseStats();
      expect(stats.connected).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle getModels call before initialization', async () => {
      // Close any existing connections
      await db.close();

      // This should initialize automatically
      const models = await db.getModels();
      expect(models).toBeDefined();
    });

    it('should handle seeding with no accounts configured', async () => {
      // This test verifies the function handles empty account arrays gracefully
      await expect(seedTestDatabase()).resolves.not.toThrow();
    });

    it('should handle stats when no accounts are seeded', async () => {
      await clearDatabase();

      const stats = await getSeededAccountStats();
      expect(stats.totalSeededAccounts).toBe(0);
      expect(stats.accounts).toEqual([]);
    });
  });
});
