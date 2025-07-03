import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAvailableSeedingTags, mockConfig, previewSeeding } from '../mock.config';
import {
  getEmailMockConfig,
  getOAuthMockConfig,
  getAccountsMockConfig,
  updateEmailMockConfig,
  updateOAuthMockConfig,
  updateAccountsMockConfig,
  resetMockConfig,
  validateEmailMockConfig,
  validateOAuthMockConfig,
  validateAccountsMockConfig,
  validateMockConfig,
  getAllMockAccounts,
  getMockAccountsForSeeding,
  getMockAccountsByTags,
  getMockAccountsById,
  getMockAccountsByProvider,
  getMockAccountsByType,
  filterAccountsForSeeding,
  getAccountsByTags,
  getAccountsById,
} from '../mock.config';
import type { EmailMockConfig, OAuthMockConfig, AccountsMockConfig, SeedingOptions } from '../mock.config';
import { OAuthProviders, AccountType, AccountStatus } from '../../feature/account/Account.types';

describe('mock.config', () => {
  beforeEach(() => {
    vi.resetModules();
    // Force refresh config from file
    mockConfig.refreshConfig();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Email Mock Configuration from File', () => {
    it('should load email configuration from file', () => {
      const emailConfig = getEmailMockConfig();

      expect(emailConfig).toBeDefined();
      expect(emailConfig).toHaveProperty('enabled');
      expect(emailConfig).toHaveProperty('logEmails');
      expect(emailConfig).toHaveProperty('simulateDelay');
      expect(emailConfig).toHaveProperty('delayMs');
      expect(emailConfig).toHaveProperty('simulateFailures');
      expect(emailConfig).toHaveProperty('failureRate');
      expect(emailConfig).toHaveProperty('failOnEmails');
      expect(emailConfig).toHaveProperty('blockEmails');
    });

    it('should validate email configuration from file', () => {
      const emailConfig = getEmailMockConfig();
      expect(() => validateEmailMockConfig(emailConfig)).not.toThrow();
    });

    it('should update email configuration at runtime', () => {
      const originalConfig = getEmailMockConfig();
      const updates: Partial<EmailMockConfig> = {
        logEmails: !originalConfig.logEmails,
        simulateDelay: !originalConfig.simulateDelay,
      };

      updateEmailMockConfig(updates);
      const updatedConfig = getEmailMockConfig();

      expect(updatedConfig.logEmails).toBe(updates.logEmails);
      expect(updatedConfig.simulateDelay).toBe(updates.simulateDelay);

      // Other properties should remain unchanged
      expect(updatedConfig.enabled).toBe(originalConfig.enabled);
      expect(updatedConfig.delayMs).toBe(originalConfig.delayMs);
    });

    it('should validate updated email configuration', () => {
      const validUpdates: Partial<EmailMockConfig> = {
        delayMs: 500,
        failureRate: 0.2,
      };

      expect(() => updateEmailMockConfig(validUpdates)).not.toThrow();
    });

    it('should reject invalid email configuration updates', () => {
      const invalidUpdates = {
        delayMs: -100, // Invalid: negative delay
        failureRate: 1.5, // Invalid: rate > 1
      };

      expect(() => updateEmailMockConfig(invalidUpdates)).toThrow();
    });
  });

  describe('OAuth Mock Configuration from File', () => {
    it('should load OAuth configuration from file', () => {
      const oauthConfig = getOAuthMockConfig();

      expect(oauthConfig).toBeDefined();
      expect(oauthConfig).toHaveProperty('enabled');
      expect(oauthConfig).toHaveProperty('simulateDelay');
      expect(oauthConfig).toHaveProperty('delayMs');
      expect(oauthConfig).toHaveProperty('simulateErrors');
      expect(oauthConfig).toHaveProperty('errorRate');
      expect(oauthConfig).toHaveProperty('failOnEmails');
      expect(oauthConfig).toHaveProperty('blockEmails');
      expect(oauthConfig).toHaveProperty('autoApprove');
      expect(oauthConfig).toHaveProperty('requireConsent');
      expect(oauthConfig).toHaveProperty('logRequests');
      expect(oauthConfig).toHaveProperty('mockServerEnabled');
      expect(oauthConfig).toHaveProperty('mockServerPort');
    });

    it('should validate OAuth configuration from file', () => {
      const oauthConfig = getOAuthMockConfig();
      expect(() => validateOAuthMockConfig(oauthConfig)).not.toThrow();
    });

    it('should update OAuth configuration at runtime', () => {
      const originalConfig = getOAuthMockConfig();
      const updates: Partial<OAuthMockConfig> = {
        enabled: !originalConfig.enabled,
        simulateDelay: !originalConfig.simulateDelay,
        errorRate: 0.1,
      };

      updateOAuthMockConfig(updates);
      const updatedConfig = getOAuthMockConfig();

      expect(updatedConfig.enabled).toBe(updates.enabled);
      expect(updatedConfig.simulateDelay).toBe(updates.simulateDelay);
      expect(updatedConfig.errorRate).toBe(updates.errorRate);
    });

    it('should validate updated OAuth configuration', () => {
      const validUpdates: Partial<OAuthMockConfig> = {
        delayMs: 2000,
        mockServerPort: 9000,
      };

      expect(() => updateOAuthMockConfig(validUpdates)).not.toThrow();
    });

    it('should reject invalid OAuth configuration updates', () => {
      const invalidUpdates = {
        mockServerPort: 99999, // Invalid: port too high
        errorRate: -0.1, // Invalid: negative rate
      };

      expect(() => updateOAuthMockConfig(invalidUpdates)).toThrow();
    });
  });

  describe('Enhanced Accounts Mock Configuration from File', () => {
    it('should load enhanced accounts configuration from file', () => {
      const accountsConfig = getAccountsMockConfig();

      expect(accountsConfig).toBeDefined();
      expect(accountsConfig).toHaveProperty('enabled');
      expect(accountsConfig).toHaveProperty('accounts');
      expect(accountsConfig).toHaveProperty('seedingMode'); // New property
      expect(accountsConfig).toHaveProperty('defaultSeedTags'); // New property
      expect(Array.isArray(accountsConfig.accounts)).toBe(true);
    });

    it('should validate enhanced accounts configuration from file', () => {
      const accountsConfig = getAccountsMockConfig();
      expect(() => validateAccountsMockConfig(accountsConfig)).not.toThrow();
    });

    it('should validate enhanced mock accounts structure from file', () => {
      const accountsConfig = getAccountsMockConfig();

      accountsConfig.accounts.forEach((account) => {
        expect(account).toHaveProperty('id');
        expect(account).toHaveProperty('email');
        expect(account).toHaveProperty('name');
        expect(account).toHaveProperty('accountType');
        expect(account).toHaveProperty('emailVerified');
        expect(account).toHaveProperty('seedByDefault'); // New property
        expect(account).toHaveProperty('seedTags'); // New property
        expect(account).toHaveProperty('testDescription'); // New property

        expect(typeof account.id).toBe('string');
        expect(typeof account.email).toBe('string');
        expect(typeof account.name).toBe('string');
        expect(typeof account.emailVerified).toBe('boolean');
        expect(typeof account.seedByDefault).toBe('boolean');
        expect(Array.isArray(account.seedTags)).toBe(true);

        if (account.testDescription) {
          expect(typeof account.testDescription).toBe('string');
        }
      });
    });

    it('should have different account types in loaded accounts', () => {
      const accountsConfig = getAccountsMockConfig();
      const accountTypes = accountsConfig.accounts.map((account) => account.accountType);

      expect(accountTypes).toContain('oauth');
      expect(accountTypes).toContain('local');
    });

    it('should have accounts with various seeding tags', () => {
      const accountsConfig = getAccountsMockConfig();
      const allTags = new Set<string>();

      accountsConfig.accounts.forEach((account) => {
        if (account.seedTags) {
          account.seedTags.forEach((tag) => allTags.add(tag));
        }
      });

      expect(allTags.size).toBeGreaterThan(0);
      // Should have common tags
      expect(allTags).toContain('basic');
      expect(allTags).toContain('oauth');
    });

    it('should update enhanced accounts configuration at runtime', () => {
      const originalConfig = getAccountsMockConfig();
      const updates: Partial<AccountsMockConfig> = {
        enabled: !originalConfig.enabled,
        clearOnSeed: !originalConfig.clearOnSeed,
        seedingMode: 'tagged',
        defaultSeedTags: ['test-tag'],
      };

      updateAccountsMockConfig(updates);
      const updatedConfig = getAccountsMockConfig();

      expect(updatedConfig.enabled).toBe(updates.enabled);
      expect(updatedConfig.clearOnSeed).toBe(updates.clearOnSeed);
      expect(updatedConfig.seedingMode).toBe(updates.seedingMode);
      expect(updatedConfig.defaultSeedTags).toEqual(updates.defaultSeedTags);
    });
  });

  describe('Selective Seeding Helper Functions', () => {
    it('should get all mock accounts', () => {
      const allAccounts = getAllMockAccounts();

      expect(Array.isArray(allAccounts)).toBe(true);
      expect(allAccounts.length).toBeGreaterThan(0);

      allAccounts.forEach((account) => {
        expect(account).toHaveProperty('id');
        expect(account).toHaveProperty('email');
        expect(account).toHaveProperty('seedTags');
        expect(account).toHaveProperty('seedByDefault');
      });
    });

    it('should get accounts for default seeding', () => {
      const defaultAccounts = getMockAccountsForSeeding({ mode: 'default' });

      expect(Array.isArray(defaultAccounts)).toBe(true);

      // All returned accounts should have seedByDefault: true
      defaultAccounts.forEach((account) => {
        expect(account.seedByDefault).toBe(true);
      });
    });

    it('should get all accounts with "all" mode', () => {
      const allConfigAccounts = getAllMockAccounts();
      const allModeAccounts = getMockAccountsForSeeding({ mode: 'all' });

      expect(allModeAccounts.length).toBe(allConfigAccounts.length);
    });

    it('should filter accounts by tags', () => {
      const taggedAccounts = getMockAccountsByTags(['basic', 'oauth']);

      expect(Array.isArray(taggedAccounts)).toBe(true);

      // All returned accounts should have at least one of the specified tags
      taggedAccounts.forEach((account) => {
        const hasRequiredTag = account.seedTags && account.seedTags.some((tag) => ['basic', 'oauth'].includes(tag));
        expect(hasRequiredTag).toBe(true);
      });
    });

    it('should filter accounts by provider', () => {
      const googleAccounts = getMockAccountsByProvider(OAuthProviders.Google);

      expect(Array.isArray(googleAccounts)).toBe(true);

      // All returned accounts should be Google OAuth accounts
      googleAccounts.forEach((account) => {
        expect(account.provider).toBe(OAuthProviders.Google);
        expect(account.accountType).toBe(AccountType.OAuth);
      });
    });

    it('should filter accounts by account type', () => {
      const oauthAccounts = getMockAccountsByType(AccountType.OAuth);
      const localAccounts = getMockAccountsByType(AccountType.Local);

      expect(Array.isArray(oauthAccounts)).toBe(true);
      expect(Array.isArray(localAccounts)).toBe(true);

      oauthAccounts.forEach((account) => {
        expect(account.accountType).toBe(AccountType.OAuth);
      });

      localAccounts.forEach((account) => {
        expect(account.accountType).toBe(AccountType.Local);
      });
    });

    it('should get accounts by specific IDs', () => {
      const allAccounts = getAllMockAccounts();
      if (allAccounts.length >= 2) {
        const targetIds = allAccounts.slice(0, 2).map((acc) => acc.id);
        const foundAccounts = getMockAccountsById(targetIds);

        expect(foundAccounts.length).toBe(2);
        foundAccounts.forEach((account) => {
          expect(targetIds).toContain(account.id);
        });
      }
    });

    it('should get available seeding tags', () => {
      const tags = getAvailableSeedingTags();

      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBeGreaterThan(0);

      // Should be sorted
      const sortedTags = [...tags].sort();
      expect(tags).toEqual(sortedTags);

      // Should contain common tags
      expect(tags).toContain('basic');
      expect(tags).toContain('oauth');
    });

    it('should filter accounts with complex seeding options', () => {
      const options: SeedingOptions = {
        mode: 'tagged',
        tags: ['basic'],
        excludeAccountIds: [],
      };

      const allAccounts = getAllMockAccounts();
      if (allAccounts.length > 0) {
        // Get first account ID to exclude
        options.excludeAccountIds = [allAccounts[0].id];

        const filteredAccounts = filterAccountsForSeeding(allAccounts, options);

        // Should not contain the excluded account
        const excludedFound = filteredAccounts.some((acc) => acc.id === allAccounts[0].id);
        expect(excludedFound).toBe(false);

        // All remaining accounts should have 'basic' tag
        filteredAccounts.forEach((account) => {
          expect(account.seedTags).toContain('basic');
        });
      }
    });

    it('should handle seeding options with explicit mode', () => {
      const allAccounts = getAllMockAccounts();
      if (allAccounts.length >= 2) {
        const accountIds = allAccounts.slice(0, 2).map((acc) => acc.id);
        const options: SeedingOptions = {
          mode: 'explicit',
          accountIds,
        };

        const accounts = getMockAccountsForSeeding(options);

        expect(accounts.length).toBe(2);
        accounts.forEach((account) => {
          expect(accountIds).toContain(account.id);
        });
      }
    });

    it('should handle empty results gracefully', () => {
      const nonExistentTags = getMockAccountsByTags(['non-existent-tag']);
      const nonExistentIds = getMockAccountsById(['non-existent-id']);

      expect(nonExistentTags).toEqual([]);
      expect(nonExistentIds).toEqual([]);
    });

    it('should preview seeding correctly', () => {
      const preview = previewSeeding();

      expect(preview).toHaveProperty('accountsToSeed');
      expect(preview).toHaveProperty('seedingCriteria');
      expect(preview).toHaveProperty('summary');

      expect(Array.isArray(preview.accountsToSeed)).toBe(true);
      expect(typeof preview.summary.totalAccounts).toBe('number');
      expect(typeof preview.summary.byType).toBe('object');
      expect(typeof preview.summary.byProvider).toBe('object');
      expect(typeof preview.summary.byTags).toBe('object');

      // Summary should match accounts
      expect(preview.summary.totalAccounts).toBe(preview.accountsToSeed.length);
    });

    it('should preview seeding with specific options', () => {
      const options: SeedingOptions = {
        mode: 'tagged',
        tags: ['oauth'],
      };

      const preview = previewSeeding(options);

      expect(preview.seedingCriteria.mode).toBe('tagged');
      expect(preview.seedingCriteria.tags).toContain('oauth');

      // All accounts should have 'oauth' tag
      preview.accountsToSeed.forEach((account) => {
        expect(account.tags).toContain('oauth');
      });
    });
  });

  describe('Complete Mock Configuration from File', () => {
    it('should load complete configuration from file', () => {
      const config = mockConfig.getConfig();

      expect(config).toHaveProperty('email');
      expect(config).toHaveProperty('oauth');
      expect(config).toHaveProperty('accounts');
    });

    it('should validate complete configuration from file', () => {
      const config = mockConfig.getConfig();
      expect(() => validateMockConfig(config)).not.toThrow();
    });

    it('should maintain configuration consistency across getters', () => {
      const fullConfig = mockConfig.getConfig();
      const emailConfig = getEmailMockConfig();
      const oauthConfig = getOAuthMockConfig();
      const accountsConfig = getAccountsMockConfig();

      expect(fullConfig.email).toEqual(emailConfig);
      expect(fullConfig.oauth).toEqual(oauthConfig);
      expect(fullConfig.accounts).toEqual(accountsConfig);
    });

    it('should validate configuration state', () => {
      expect(mockConfig.isConfigValid()).toBe(true);
    });

    it('should refresh configuration from file', () => {
      const initialConfig = mockConfig.getConfig();

      // Make some changes
      updateEmailMockConfig({ logEmails: false });

      // Refresh should reload from file
      mockConfig.refreshConfig();
      const refreshedConfig = mockConfig.getConfig();

      // Should match original file content
      expect(refreshedConfig.email.logEmails).toBe(initialConfig.email.logEmails);
    });
  });

  describe('Enhanced Configuration Validation', () => {
    it('should validate email mock configuration correctly', () => {
      const emailConfig = getEmailMockConfig();
      expect(() => validateEmailMockConfig(emailConfig)).not.toThrow();
    });

    it('should validate OAuth mock configuration correctly', () => {
      const oauthConfig = getOAuthMockConfig();
      expect(() => validateOAuthMockConfig(oauthConfig)).not.toThrow();
    });

    it('should validate enhanced accounts mock configuration correctly', () => {
      const accountsConfig = getAccountsMockConfig();
      expect(() => validateAccountsMockConfig(accountsConfig)).not.toThrow();
    });

    it('should validate mock account with enhanced properties', () => {
      const accountsConfig = getAccountsMockConfig();
      const firstAccount = accountsConfig.accounts[0];

      // Should validate individual mock account
      expect(firstAccount).toHaveProperty('seedByDefault');
      expect(firstAccount).toHaveProperty('seedTags');
      expect(firstAccount).toHaveProperty('testDescription');

      expect(typeof firstAccount.seedByDefault).toBe('boolean');
      expect(Array.isArray(firstAccount.seedTags)).toBe(true);
    });

    it('should throw error for invalid email configuration', () => {
      const invalidConfig = {
        enabled: 'invalid', // should be boolean
        logEmails: true,
        simulateDelay: false,
        delayMs: 150,
        simulateFailures: false,
        failureRate: 0.1,
        failOnEmails: [],
        blockEmails: [],
      };

      expect(() => validateEmailMockConfig(invalidConfig)).toThrow('Invalid email mock configuration');
    });

    it('should throw error for invalid OAuth configuration', () => {
      const invalidConfig = {
        enabled: 'invalid', // should be boolean
        simulateDelay: false,
        delayMs: 1000,
        simulateErrors: false,
        errorRate: 0.05,
        failOnEmails: [],
        blockEmails: [],
        autoApprove: true,
        requireConsent: false,
        logRequests: true,
        mockServerEnabled: true,
        mockServerPort: 8080,
      };

      expect(() => validateOAuthMockConfig(invalidConfig)).toThrow('Invalid OAuth mock configuration');
    });

    it('should validate enhanced accounts configuration with new properties', () => {
      const validConfig: AccountsMockConfig = {
        enabled: true,
        clearOnSeed: false,
        seedingMode: 'tagged',
        defaultSeedTags: ['basic'],
        accounts: [
          {
            id: 'test_account',
            accountType: AccountType.OAuth,
            email: 'test@example.com',
            name: 'Test User',
            emailVerified: true,
            provider: OAuthProviders.Google,
            seedByDefault: true,
            seedTags: ['basic', 'oauth'],
            testDescription: 'Test account for validation',
            status: AccountStatus.Active,
            twoFactorEnabled: false,
          },
        ],
      };

      expect(() => validateAccountsMockConfig(validConfig)).not.toThrow();
    });

    it('should validate seeding mode enum values', () => {
      const validModes = ['all', 'default', 'tagged', 'explicit'];

      validModes.forEach((mode) => {
        const config: Partial<AccountsMockConfig> = {
          seedingMode: mode as any,
        };

        // Should not throw for valid modes
        expect(() => updateAccountsMockConfig(config)).not.toThrow();
      });
    });

    it('should handle boundary values in validation', () => {
      const boundaryEmailConfig: EmailMockConfig = {
        enabled: true,
        logEmails: true,
        simulateDelay: true,
        delayMs: 10000, // max value
        simulateFailures: true,
        failureRate: 1.0, // max value
        failOnEmails: [],
        blockEmails: [],
      };

      expect(() => validateEmailMockConfig(boundaryEmailConfig)).not.toThrow();
    });

    it('should reject out-of-bounds values', () => {
      const outOfBoundsConfig = {
        enabled: true,
        logEmails: true,
        simulateDelay: true,
        delayMs: 15000, // exceeds max
        simulateFailures: true,
        failureRate: 1.5, // exceeds max
        failOnEmails: [],
        blockEmails: [],
      };

      expect(() => validateEmailMockConfig(outOfBoundsConfig)).toThrow();
    });
  });

  describe('Enhanced Account Helper Functions', () => {
    it('should filter accounts correctly with getAccountsByTags helper', () => {
      const allAccounts = getAllMockAccounts();
      const basicAccounts = getAccountsByTags(allAccounts, ['basic']);

      basicAccounts.forEach((account) => {
        expect(account.seedTags).toContain('basic');
      });
    });

    it('should filter accounts correctly with getAccountsById helper', () => {
      const allAccounts = getAllMockAccounts();
      if (allAccounts.length > 0) {
        const targetId = allAccounts[0].id;
        const foundAccounts = getAccountsById(allAccounts, [targetId]);

        expect(foundAccounts.length).toBe(1);
        expect(foundAccounts[0].id).toBe(targetId);
      }
    });

    it('should handle edge cases in filtering', () => {
      const allAccounts = getAllMockAccounts();

      // Empty tags array
      const emptyTagsResult = getAccountsByTags(allAccounts, []);
      expect(emptyTagsResult).toEqual([]);

      // Empty IDs array
      const emptyIdsResult = getAccountsById(allAccounts, []);
      expect(emptyIdsResult).toEqual([]);

      // Non-existent tags
      const nonExistentTagsResult = getAccountsByTags(allAccounts, ['non-existent']);
      expect(nonExistentTagsResult).toEqual([]);

      // Non-existent IDs
      const nonExistentIdsResult = getAccountsById(allAccounts, ['non-existent']);
      expect(nonExistentIdsResult).toEqual([]);
    });
  });

  describe('Reset Functionality', () => {
    it('should throw error when trying to reset to defaults', () => {
      expect(() => resetMockConfig()).toThrow('Reset to defaults not supported');
    });
  });

  describe('MockConfigManager Enhanced Methods', () => {
    it('should get accounts by provider using manager method', () => {
      const googleAccounts = mockConfig.getAccountsByProvider(OAuthProviders.Google);

      expect(Array.isArray(googleAccounts)).toBe(true);
      googleAccounts.forEach((account) => {
        expect(account.provider).toBe(OAuthProviders.Google);
      });
    });

    it('should get accounts by type using manager method', () => {
      const oauthAccounts = mockConfig.getAccountsByType(AccountType.OAuth);
      const localAccounts = mockConfig.getAccountsByType(AccountType.Local);

      expect(Array.isArray(oauthAccounts)).toBe(true);
      expect(Array.isArray(localAccounts)).toBe(true);

      oauthAccounts.forEach((account) => {
        expect(account.accountType).toBe(AccountType.OAuth);
      });

      localAccounts.forEach((account) => {
        expect(account.accountType).toBe(AccountType.Local);
      });
    });

    it('should get accounts for seeding with options using manager method', () => {
      const options: SeedingOptions = {
        mode: 'tagged',
        tags: ['basic'],
      };

      const accounts = mockConfig.getAccountsForSeeding(options);

      expect(Array.isArray(accounts)).toBe(true);
      accounts.forEach((account) => {
        expect(account.seedTags).toContain('basic');
      });
    });

    it('should get accounts by tags using manager method', () => {
      const basicAccounts = mockConfig.getAccountsByTags(['basic']);

      expect(Array.isArray(basicAccounts)).toBe(true);
      basicAccounts.forEach((account) => {
        expect(account.seedTags).toContain('basic');
      });
    });

    it('should get accounts by ID using manager method', () => {
      const allAccounts = mockConfig.getAllAccounts();
      if (allAccounts.length > 0) {
        const targetId = allAccounts[0].id;
        const foundAccounts = mockConfig.getAccountsById([targetId]);

        expect(foundAccounts.length).toBe(1);
        expect(foundAccounts[0].id).toBe(targetId);
      }
    });
  });
});
