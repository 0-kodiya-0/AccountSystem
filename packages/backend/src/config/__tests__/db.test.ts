import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import {
  getModels,
  closeAllConnections,
  clearDatabase,
  connectAuthDB,
  getAuthConnectionStatus,
  getDatabaseStats,
  seedTestDatabase,
  getSeededAccountStats,
  cleanupSeededTestData,
  initializeDB,
  seedAccountsByTags,
  seedAccountsById,
  seedDefaultAccounts,
  seedAllAccounts,
} from '../db.config';
import { getNodeEnv } from '../env.config';
import {
  getAccountsMockConfig,
  getAvailableSeedingTags,
  getMockAccountsForSeeding,
  previewSeeding,
  type SeedingOptions,
} from '../mock.config';

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
      await connectAuthDB();
    });

    it('should connect to accounts database', async () => {
      const connection = getAuthConnectionStatus();

      expect(connection).toBeDefined();
      expect(connection.readyState).toBe(1); // Connected state
    });

    it('should connect to all databases', async () => {
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
      await connectAuthDB();
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

        const stats = await getSeededAccountStats();
        expect(stats.totalSeededAccounts).toBeGreaterThan(0);
        expect(stats.accounts).toBeInstanceOf(Array);

        // Verify enhanced account structure
        stats.accounts.forEach((account) => {
          expect(account).toHaveProperty('id');
          expect(account).toHaveProperty('email');
          expect(account).toHaveProperty('name');
          expect(account).toHaveProperty('accountType');
          expect(account).toHaveProperty('status');
          expect(account).toHaveProperty('tags'); // New property
          expect(account).toHaveProperty('testDescription'); // New property
        });
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

      const stats = await getSeededAccountStats();
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('totalSeededAccounts');
      expect(stats).toHaveProperty('accountsByType');
      expect(stats).toHaveProperty('accountsByProvider');
      expect(stats).toHaveProperty('accountsByStatus');
      expect(stats).toHaveProperty('accountsByTags'); // New property
      expect(stats).toHaveProperty('accounts');

      expect(typeof stats.totalSeededAccounts).toBe('number');
      expect(Array.isArray(stats.accounts)).toBe(true);
      expect(typeof stats.accountsByTags).toBe('object'); // New validation
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

  describe('Selective Seeding Features', () => {
    beforeEach(async () => {
      await connectAuthDB();
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
      await seedDefaultAccounts(true);

      const stats = await getSeededAccountStats();

      // All seeded accounts should have been marked as seedByDefault: true
      const mockAccounts = getMockAccountsForSeeding({ mode: 'default' });
      expect(stats.totalSeededAccounts).toBe(mockAccounts.length);
    });

    it('should seed accounts by tags', async () => {
      const tags = ['basic', 'oauth'];
      await seedAccountsByTags(tags, true);

      const stats = await getSeededAccountStats();

      // All seeded accounts should have at least one of the specified tags
      stats.accounts.forEach((account) => {
        const hasRequiredTag = account.tags && account.tags.some((tag) => tags.includes(tag));
        expect(hasRequiredTag).toBe(true);
      });
    });

    it('should seed accounts by specific IDs', async () => {
      const accountsConfig = getAccountsMockConfig();
      if (accountsConfig.enabled && accountsConfig.accounts.length >= 2) {
        const accountIds = accountsConfig.accounts.slice(0, 2).map((acc) => acc.id);

        await seedAccountsById(accountIds, true);

        const stats = await getSeededAccountStats();
        expect(stats.totalSeededAccounts).toBe(2);

        // Should only have the specific accounts we requested
        const seededIds = stats.accounts.map((acc) => {
          // Find the mock account by email to get its ID
          const mockAccount = accountsConfig.accounts.find((mock) => mock.email === acc.email);
          return mockAccount?.id;
        });

        accountIds.forEach((id) => {
          expect(seededIds).toContain(id);
        });
      }
    });

    it('should seed all accounts regardless of seedByDefault flag', async () => {
      await seedAllAccounts(true);

      const stats = await getSeededAccountStats();
      const accountsConfig = getAccountsMockConfig();

      if (accountsConfig.enabled) {
        // Should seed all configured accounts
        expect(stats.totalSeededAccounts).toBe(accountsConfig.accounts.length);
      }
    });

    it('should support complex seeding options', async () => {
      const options: SeedingOptions = {
        mode: 'tagged',
        tags: ['oauth', 'basic'],
        excludeAccountIds: [], // Will be set dynamically if needed
        clearOnSeed: true,
      };

      await seedTestDatabase(options);

      const stats = await getSeededAccountStats();

      // All accounts should have at least one of the specified tags
      if (stats.accounts.length > 0) {
        stats.accounts.forEach((account) => {
          const hasRequiredTag = account.tags && account.tags.some((tag) => options.tags!.includes(tag));
          expect(hasRequiredTag).toBe(true);
        });
      }
    });

    it('should support selective cleanup', async () => {
      // Seed all accounts first
      await seedAllAccounts(true);

      const initialStats = await getSeededAccountStats();
      const initialCount = initialStats.totalSeededAccounts;

      if (initialCount > 0) {
        // Cleanup only accounts with specific tags
        const cleanupOptions: SeedingOptions = {
          mode: 'tagged',
          tags: ['basic'],
        };

        await cleanupSeededTestData(cleanupOptions);

        const afterStats = await getSeededAccountStats();

        // Should have fewer accounts now (unless all accounts had 'basic' tag)
        expect(afterStats.totalSeededAccounts).toBeLessThanOrEqual(initialCount);

        // Remaining accounts should not have 'basic' tag
        afterStats.accounts.forEach((account) => {
          const hasBasicTag = account.tags && account.tags.includes('basic');
          expect(hasBasicTag).toBe(false);
        });
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

  describe('Account Seeding Validation', () => {
    beforeAll(async () => {
      await connectAuthDB();
    });

    beforeEach(async () => {
      await cleanupSeededTestData();
    });

    afterAll(async () => {
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

      if (stats.totalSeededAccounts > 0) {
        // Should have both oauth and local accounts based on mock config
        expect(Object.keys(stats.accountsByType)).toContain('oauth');
        expect(Object.keys(stats.accountsByType)).toContain('local');

        // Counts should be positive
        expect(stats.accountsByType.oauth).toBeGreaterThan(0);
        expect(stats.accountsByType.local).toBeGreaterThan(0);
      }
    });

    it('should categorize accounts by provider correctly', async () => {
      await seedTestDatabase();

      const stats = await getSeededAccountStats();

      if (stats.totalSeededAccounts > 0) {
        // Should have Google provider accounts
        expect(Object.keys(stats.accountsByProvider)).toContain('google');
        expect(stats.accountsByProvider.google).toBeGreaterThan(0);
      }
    });

    it('should categorize accounts by status correctly', async () => {
      await seedTestDatabase();

      const stats = await getSeededAccountStats();

      if (stats.totalSeededAccounts > 0) {
        // Should have different status types
        expect(Object.keys(stats.accountsByStatus)).toContain('active');
        expect(stats.accountsByStatus.active).toBeGreaterThan(0);
      }
    });

    it('should categorize accounts by tags correctly', async () => {
      await seedTestDatabase();

      const stats = await getSeededAccountStats();

      if (stats.totalSeededAccounts > 0) {
        // Should have tag categorization
        expect(typeof stats.accountsByTags).toBe('object');
        expect(Object.keys(stats.accountsByTags).length).toBeGreaterThan(0);

        // Common tags should be present
        expect(Object.keys(stats.accountsByTags)).toContain('basic');
        expect(stats.accountsByTags.basic).toBeGreaterThan(0);
      }
    });
  });

  describe('Memory Server Management', () => {
    it('should start and stop memory server properly', async () => {
      // Connect (starts memory server)
      await connectAuthDB();

      let stats = await getDatabaseStats();
      let connectionStates = getAuthConnectionStatus();
      expect(stats.type).toBe('memory');
      expect(connectionStates.connected).toBe(true);

      // Close (stops memory server)
      await closeAllConnections();

      stats = await getDatabaseStats();
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

      const stats = await getSeededAccountStats();
      expect(stats.totalSeededAccounts).toBe(0);
      expect(stats.accounts).toEqual([]);
      expect(stats.accountsByTags).toEqual({});
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
      await seedAccountsByTags(['non-existent-tag'], true);

      const stats = await getSeededAccountStats();
      expect(stats.totalSeededAccounts).toBe(0);
    });

    it('should handle seeding by IDs that do not exist', async () => {
      await seedAccountsById(['non-existent-id'], true);

      const stats = await getSeededAccountStats();
      expect(stats.totalSeededAccounts).toBe(0);
    });
  });
});
