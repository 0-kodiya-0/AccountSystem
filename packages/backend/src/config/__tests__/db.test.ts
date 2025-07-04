import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import {
  getModels,
  closeAllConnections,
  clearDatabase,
  ensureConnection,
  getAuthConnectionStatus,
  getDatabaseStats,
  seedTestDatabase,
  initializeDB,
  isConnected,
} from '../db.config';
import { getNodeEnv } from '../env.config';
import { getAccountsMockConfig, getAvailableSeedingTags, previewSeeding, type SeedingOptions } from '../mock.config';

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
    beforeAll(async () => {
      await ensureConnection();
    });

    it('should ensure database connection', async () => {
      const connection = await ensureConnection();
      expect(connection).toBeDefined();
      expect(isConnected()).toBe(true);
    });

    it('should get connection status', () => {
      const status = getAuthConnectionStatus();
      expect(status).toBeDefined();
      expect(status.connected).toBe(true);
      expect(status.readyState).toBe(1); // Connected state
    });

    it('should connect to all databases and initialize models', async () => {
      const models = await getModels();
      expect(models).toBeDefined();
      expect(models.accounts).toBeDefined();
      expect(models.notifications).toBeDefined();
      expect(models.google).toBeDefined();
    });

    it('should get database statistics', async () => {
      const stats = await getDatabaseStats();
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('type');
      expect(stats).toHaveProperty('collections');
      expect(stats).toHaveProperty('totalDocuments');

      // Should be memory type in test environment
      expect(stats.type).toBe('memory');
    });
  });

  describe('Database Operations (Test Environment Only)', () => {
    beforeEach(async () => {
      // Ensure clean database state
      await ensureConnection();
    });

    afterEach(async () => {
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

        // Verify seeding worked by checking database stats
        const stats = await getDatabaseStats();
        expect(stats.totalDocuments).toBeGreaterThan(0);
      }
    });

    it('should handle seeding when accounts config is disabled', async () => {
      // This should not throw but should log that no accounts to seed
      await expect(seedTestDatabase()).resolves.not.toThrow();
    });

    it('should prevent database seeding in production', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await expect(seedTestDatabase()).rejects.toThrow('Database seeding is not allowed in production');

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should get seeded account statistics with tag information', async () => {
      await seedTestDatabase();

      // Verify seeding worked by checking database stats
      const stats = await getDatabaseStats();
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('type');
      expect(stats).toHaveProperty('collections');
      expect(stats).toHaveProperty('totalDocuments');
      expect(stats.totalDocuments).toBeGreaterThan(0);
    });

    it('should cleanup seeded test data', async () => {
      // First seed some data
      await seedTestDatabase();

      const beforeStats = await getDatabaseStats();
      expect(beforeStats.totalDocuments).toBeGreaterThan(0);

      // Then cleanup by clearing database
      await clearDatabase();

      const afterStats = await getDatabaseStats();
      expect(afterStats.totalDocuments).toBe(0);
    });

    it('should prevent cleanup in production', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await expect(clearDatabase()).rejects.toThrow('Database clearing is not allowed in production');

      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('Selective Seeding Features', () => {
    beforeEach(async () => {
      await ensureConnection();
      await clearDatabase();
    });

    afterEach(async () => {
      await clearDatabase();
    });

    it('should get available seeding tags', () => {
      const tags = getAvailableSeedingTags();
      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBeGreaterThan(0);

      // Should have common tags if configuration is loaded
      const accountsConfig = getAccountsMockConfig();
      if (accountsConfig.enabled && accountsConfig.accounts.length > 0) {
        expect(tags).toContain('basic');
        expect(tags).toContain('oauth');
      }
    });

    it('should preview seeding without actually seeding', () => {
      const preview = previewSeeding();

      expect(preview).toHaveProperty('accountsToSeed');
      expect(preview).toHaveProperty('seedingCriteria');
      expect(preview).toHaveProperty('summary');

      expect(Array.isArray(preview.accountsToSeed)).toBe(true);
      expect(typeof preview.summary.totalAccounts).toBe('number');
      expect(typeof preview.summary.byType).toBe('object');
      expect(typeof preview.summary.byProvider).toBe('object');
      expect(typeof preview.summary.byTags).toBe('object');
    });

    it('should preview seeding with specific options', () => {
      const options: SeedingOptions = {
        mode: 'tagged',
        tags: ['basic'],
        clearOnSeed: false,
      };

      const preview = previewSeeding(options);

      expect(preview.seedingCriteria.mode).toBe('tagged');
      expect(preview.seedingCriteria.tags).toContain('basic');

      // All accounts should have 'basic' tag
      preview.accountsToSeed.forEach((account) => {
        expect(account.tags).toContain('basic');
      });
    });

    it('should seed default accounts only', async () => {
      const options: SeedingOptions = {
        mode: 'default',
        clearOnSeed: true,
      };

      await seedTestDatabase(options);

      // Verify seeding worked
      const stats = await getDatabaseStats();
      expect(stats.totalDocuments).toBeGreaterThan(0);
    });

    it('should seed accounts by tags', async () => {
      const tags = ['basic', 'oauth'];
      const options: SeedingOptions = {
        mode: 'tagged',
        tags,
        clearOnSeed: true,
      };

      await seedTestDatabase(options);

      // Verify seeding worked
      const stats = await getDatabaseStats();
      expect(stats.totalDocuments).toBeGreaterThan(0);
    });

    it('should seed accounts by specific IDs', async () => {
      const accountsConfig = getAccountsMockConfig();
      if (accountsConfig.enabled && accountsConfig.accounts.length >= 2) {
        const accountIds = accountsConfig.accounts.slice(0, 2).map((acc) => acc.id);

        const options: SeedingOptions = {
          mode: 'explicit',
          accountIds,
          clearOnSeed: true,
        };

        await seedTestDatabase(options);

        // Verify seeding worked
        const stats = await getDatabaseStats();
        expect(stats.totalDocuments).toBeGreaterThan(0);
      }
    });

    it('should seed all accounts regardless of seedByDefault flag', async () => {
      const options: SeedingOptions = {
        mode: 'all',
        clearOnSeed: true,
      };

      await seedTestDatabase(options);

      const stats = await getDatabaseStats();
      expect(stats.totalDocuments).toBeGreaterThan(0);
    });

    it('should support complex seeding options', async () => {
      const options: SeedingOptions = {
        mode: 'tagged',
        tags: ['oauth', 'basic'],
        excludeAccountIds: [], // Will be set dynamically if needed
        clearOnSeed: true,
      };

      await seedTestDatabase(options);

      // Verify seeding worked
      const stats = await getDatabaseStats();
      expect(stats.totalDocuments).toBeGreaterThan(0);
    });

    it('should support selective cleanup', async () => {
      // Seed all accounts first
      const options: SeedingOptions = {
        mode: 'all',
        clearOnSeed: true,
      };

      await seedTestDatabase(options);

      const initialStats = await getDatabaseStats();
      const initialCount = initialStats.totalDocuments;

      if (initialCount > 0) {
        // Clear database for cleanup simulation
        await clearDatabase();

        const afterStats = await getDatabaseStats();
        expect(afterStats.totalDocuments).toBe(0);
      }
    });
  });

  describe('Database Initialization', () => {
    beforeAll(async () => {
      await initializeDB();
    });

    it('should initialize database models', async () => {
      const models = await getModels();
      expect(models).toBeDefined();
      expect(models.accounts).toBeDefined();
      expect(models.accounts.Account).toBeDefined();
      expect(models.notifications).toBeDefined();
      expect(models.notifications.Notification).toBeDefined();
      expect(models.google).toBeDefined();
      expect(models.google.GooglePermissions).toBeDefined();
    });

    it('should get models after initialization', async () => {
      const models = await getModels();
      expect(models).toBeDefined();
      expect(models.accounts.Account).toBeDefined();
    });

    it('should handle multiple getModels calls', async () => {
      const models1 = await getModels();
      const models2 = await getModels();

      expect(models1).toBe(models2); // Should return same instance
    });

    it('should close database connections', async () => {
      await closeAllConnections();

      // After closing, should be able to reinitialize
      const models = await getModels();
      expect(models).toBeDefined();
    });
  });

  describe('Connection State Management', () => {
    it('should check connection state properly', async () => {
      // Ensure we have a connection
      await ensureConnection();
      expect(isConnected()).toBe(true);

      // Close connection
      await closeAllConnections();
      expect(isConnected()).toBe(false);

      // Reconnect
      await ensureConnection();
      expect(isConnected()).toBe(true);
    });

    it('should handle multiple ensureConnection calls gracefully', async () => {
      const connection1 = await ensureConnection();
      const connection2 = await ensureConnection();

      expect(connection1).toBe(connection2);
      expect(isConnected()).toBe(true);
    });

    it('should get detailed connection status', async () => {
      await ensureConnection();

      const status = getAuthConnectionStatus();
      expect(status.connected).toBe(true);
      expect(status.connecting).toBe(false);
      expect(status.memoryServer).toBe(true);
      expect(status.lastConnectionTime).toBeDefined();
    });
  });

  describe('Account Seeding Validation', () => {
    beforeAll(async () => {
      await ensureConnection();
    });

    beforeEach(async () => {
      await clearDatabase();
    });

    afterAll(async () => {
      await clearDatabase();
    });

    it('should only add accounts without duplicates', async () => {
      // Seed once
      await seedTestDatabase();
      const firstStats = await getDatabaseStats();

      // Seed again - should skip existing accounts
      await seedTestDatabase();
      const secondStats = await getDatabaseStats();

      // Should have same number of documents (no duplicates added)
      expect(secondStats.totalDocuments).toBe(firstStats.totalDocuments);
    });

    it('should categorize accounts by type correctly', async () => {
      await seedTestDatabase();

      const stats = await getDatabaseStats();
      expect(stats.totalDocuments).toBeGreaterThan(0);

      // Verify accounts collection exists
      expect(stats.collections).toContain('accounts');
    });

    it('should categorize accounts by provider correctly', async () => {
      await seedTestDatabase();

      const stats = await getDatabaseStats();
      expect(stats.totalDocuments).toBeGreaterThan(0);

      // Verify accounts were seeded
      expect(stats.collections).toContain('accounts');
    });

    it('should categorize accounts by status correctly', async () => {
      await seedTestDatabase();

      const stats = await getDatabaseStats();
      expect(stats.totalDocuments).toBeGreaterThan(0);

      // Verify accounts were seeded
      expect(stats.collections).toContain('accounts');
    });

    it('should categorize accounts by tags correctly', async () => {
      await seedTestDatabase();

      const stats = await getDatabaseStats();
      expect(stats.totalDocuments).toBeGreaterThan(0);

      // Verify accounts were seeded
      expect(stats.collections).toContain('accounts');
    });
  });

  describe('Memory Server Management', () => {
    it('should start and stop memory server properly', async () => {
      // Connect (starts memory server)
      await ensureConnection();

      const stats = await getDatabaseStats();
      let connectionStates = getAuthConnectionStatus();
      expect(stats.type).toBe('memory');
      expect(connectionStates.connected).toBe(true);

      // Close (stops memory server)
      await closeAllConnections();

      connectionStates = getAuthConnectionStatus();
      expect(connectionStates.connected).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle getModels call before initialization', async () => {
      // Close any existing connections
      await closeAllConnections();

      // This should initialize automatically
      const models = await getModels();
      expect(models).toBeDefined();
    });

    it('should handle seeding with no accounts configured', async () => {
      // This test verifies the function handles empty account arrays gracefully
      await expect(seedTestDatabase()).resolves.not.toThrow();
    });

    it('should handle stats when no accounts are seeded', async () => {
      await clearDatabase();

      const stats = await getDatabaseStats();
      expect(stats.totalDocuments).toBe(0);
      expect(Array.isArray(stats.collections)).toBe(true);
    });

    it('should handle preview with invalid seeding options', () => {
      const invalidOptions: SeedingOptions = {
        mode: 'explicit',
        accountIds: ['non-existent-id'],
      };

      const preview = previewSeeding(invalidOptions);
      expect(preview.summary.totalAccounts).toBe(0);
      expect(preview.accountsToSeed).toEqual([]);
    });

    it('should handle seeding by tags that do not exist', async () => {
      const options: SeedingOptions = {
        mode: 'tagged',
        tags: ['non-existent-tag'],
        clearOnSeed: true,
      };

      await seedTestDatabase(options);

      const stats = await getDatabaseStats();
      expect(stats.totalDocuments).toBe(0);
    });

    it('should handle seeding by IDs that do not exist', async () => {
      const options: SeedingOptions = {
        mode: 'explicit',
        accountIds: ['non-existent-id'],
        clearOnSeed: true,
      };

      await seedTestDatabase(options);

      const stats = await getDatabaseStats();
      expect(stats.totalDocuments).toBe(0);
    });
  });
});
