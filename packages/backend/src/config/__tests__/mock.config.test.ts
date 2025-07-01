import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockConfig } from '../mock.config';
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
} from '../mock.config';
import type { EmailMockConfig, OAuthMockConfig, AccountsMockConfig } from '../mock.config';

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

  describe('Accounts Mock Configuration from File', () => {
    it('should load accounts configuration from file', () => {
      const accountsConfig = getAccountsMockConfig();

      expect(accountsConfig).toBeDefined();
      expect(accountsConfig).toHaveProperty('enabled');
      expect(accountsConfig).toHaveProperty('accounts');
      expect(Array.isArray(accountsConfig.accounts)).toBe(true);
    });

    it('should validate accounts configuration from file', () => {
      const accountsConfig = getAccountsMockConfig();
      expect(() => validateAccountsMockConfig(accountsConfig)).not.toThrow();
    });

    it('should validate mock accounts structure from file', () => {
      const accountsConfig = getAccountsMockConfig();

      accountsConfig.accounts.forEach((account) => {
        expect(account).toHaveProperty('id');
        expect(account).toHaveProperty('email');
        expect(account).toHaveProperty('name');
        expect(account).toHaveProperty('accountType');
        expect(account).toHaveProperty('emailVerified');

        expect(typeof account.id).toBe('string');
        expect(typeof account.email).toBe('string');
        expect(typeof account.name).toBe('string');
        expect(typeof account.emailVerified).toBe('boolean');
      });
    });

    it('should have different account types in loaded accounts', () => {
      const accountsConfig = getAccountsMockConfig();
      const accountTypes = accountsConfig.accounts.map((account) => account.accountType);

      expect(accountTypes).toContain('oauth');
      expect(accountTypes).toContain('local');
    });

    it('should update accounts configuration at runtime', () => {
      const originalConfig = getAccountsMockConfig();
      const updates: Partial<AccountsMockConfig> = {
        enabled: !originalConfig.enabled,
        clearOnSeed: !originalConfig.clearOnSeed,
      };

      updateAccountsMockConfig(updates);
      const updatedConfig = getAccountsMockConfig();

      expect(updatedConfig.enabled).toBe(updates.enabled);
      expect(updatedConfig.clearOnSeed).toBe(updates.clearOnSeed);
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

  describe('Configuration Validation Runtime Logic', () => {
    it('should validate email mock configuration correctly', () => {
      const emailConfig = getEmailMockConfig();
      expect(() => validateEmailMockConfig(emailConfig)).not.toThrow();
    });

    it('should validate OAuth mock configuration correctly', () => {
      const oauthConfig = getOAuthMockConfig();
      expect(() => validateOAuthMockConfig(oauthConfig)).not.toThrow();
    });

    it('should validate accounts mock configuration correctly', () => {
      const accountsConfig = getAccountsMockConfig();
      expect(() => validateAccountsMockConfig(accountsConfig)).not.toThrow();
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

  describe('Reset Functionality', () => {
    it('should throw error when trying to reset to defaults', () => {
      expect(() => resetMockConfig()).toThrow('Reset to defaults not supported');
    });
  });
});
