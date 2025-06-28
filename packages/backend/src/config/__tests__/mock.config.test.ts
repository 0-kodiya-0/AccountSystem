import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockConfig } from '../mock.config';
import {
  getEmailMockConfig,
  getOAuthMockConfig,
  updateEmailMockConfig,
  updateOAuthMockConfig,
  resetMockConfig,
  validateEmailMockConfig,
  validateOAuthMockConfig,
  validateMockConfig,
} from '../mock.config';
import type { EmailMockConfig, OAuthMockConfig } from '../mock.config';

describe('mock.config', () => {
  beforeEach(() => {
    vi.resetModules();
    // Reset to defaults before each test
    mockConfig.resetToDefaults();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('MockConfigManager Singleton', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = mockConfig;
      const instance2 = mockConfig;
      expect(instance1).toBe(instance2);
    });

    it('should be initialized on import', () => {
      expect(mockConfig).toBeDefined();
      expect(typeof mockConfig.getConfig).toBe('function');
      expect(typeof mockConfig.getEmailConfig).toBe('function');
      expect(typeof mockConfig.getOAuthConfig).toBe('function');
    });
  });

  describe('Email Mock Configuration', () => {
    it('should return default email configuration', () => {
      const emailConfig = getEmailMockConfig();

      expect(emailConfig).toMatchObject({
        logEmails: true,
        simulateDelay: false,
        delayMs: 100,
        simulateFailures: false,
        failureRate: 0.1,
        failOnEmails: [],
        blockEmails: [],
      });
    });

    it('should update email configuration', () => {
      const updates: Partial<EmailMockConfig> = {
        logEmails: false,
        simulateDelay: true,
        delayMs: 500,
      };

      updateEmailMockConfig(updates);
      const updatedConfig = getEmailMockConfig();

      expect(updatedConfig.logEmails).toBe(false);
      expect(updatedConfig.simulateDelay).toBe(true);
      expect(updatedConfig.delayMs).toBe(500);
    });

    it('should validate email configuration correctly', () => {
      const validConfig: EmailMockConfig = {
        enabled: true,
        logEmails: true,
        simulateDelay: false,
        delayMs: 150,
        simulateFailures: false,
        failureRate: 0.1,
        failOnEmails: ['fail@example.com'],
        blockEmails: ['blocked@example.com'],
      };

      expect(() => validateEmailMockConfig(validConfig)).not.toThrow();
    });

    it('should throw error for invalid email configuration', () => {
      const invalidConfig = {
        logEmails: 'invalid', // should be boolean
        simulateDelay: false,
        delayMs: 150,
        simulateFailures: false,
        failureRate: 0.1,
        failOnEmails: [],
        blockEmails: [],
      };

      expect(() => validateEmailMockConfig(invalidConfig)).toThrow('Invalid email mock configuration');
    });
  });

  describe('OAuth Mock Configuration', () => {
    it('should return default OAuth configuration', () => {
      const oauthConfig = getOAuthMockConfig();

      expect(oauthConfig).toMatchObject({
        enabled: true,
        simulateDelay: false,
        delayMs: 1000,
        simulateErrors: false,
        errorRate: 0.05,
        failOnEmails: expect.any(Array),
        blockEmails: expect.any(Array),
        autoApprove: true,
        requireConsent: false,
        logRequests: true,
        mockServerEnabled: true,
        mockServerPort: 8080,
      });

      expect(oauthConfig.mockAccounts).toBeInstanceOf(Array);
      expect(oauthConfig.mockAccounts.length).toBeGreaterThan(0);
    });

    it('should update OAuth configuration', () => {
      const updates: Partial<OAuthMockConfig> = {
        enabled: false,
        simulateDelay: true,
        delayMs: 2000,
        errorRate: 0.1,
      };

      updateOAuthMockConfig(updates);
      const updatedConfig = getOAuthMockConfig();

      expect(updatedConfig.enabled).toBe(false);
      expect(updatedConfig.simulateDelay).toBe(true);
      expect(updatedConfig.delayMs).toBe(2000);
      expect(updatedConfig.errorRate).toBe(0.1);
    });

    it('should validate OAuth configuration correctly', () => {
      const oauthConfig = getOAuthMockConfig();
      expect(() => validateOAuthMockConfig(oauthConfig)).not.toThrow();
    });

    it('should throw error for invalid OAuth configuration', () => {
      const invalidConfig = {
        enabled: 'invalid', // should be boolean
        simulateDelay: false,
        delayMs: 1000,
        simulateErrors: false,
        errorRate: 0.05,
        mockAccounts: [],
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
  });

  describe('Complete Mock Configuration', () => {
    it('should return complete configuration', () => {
      const config = mockConfig.getConfig();

      expect(config).toHaveProperty('email');
      expect(config).toHaveProperty('oauth');
      expect(config.email).toBeInstanceOf(Object);
      expect(config.oauth).toBeInstanceOf(Object);
    });

    it('should validate complete configuration', () => {
      const config = mockConfig.getConfig();
      expect(() => validateMockConfig(config)).not.toThrow();
    });

    it('should reset to defaults', () => {
      // Modify configuration
      updateEmailMockConfig({ logEmails: false });
      updateOAuthMockConfig({ enabled: false });

      // Reset to defaults
      resetMockConfig();

      const emailConfig = getEmailMockConfig();
      const oauthConfig = getOAuthMockConfig();

      expect(emailConfig.logEmails).toBe(true);
      expect(oauthConfig.enabled).toBe(true);
    });
  });

  describe('Mock Account Validation', () => {
    it('should validate default mock accounts', () => {
      const oauthConfig = getOAuthMockConfig();

      oauthConfig.mockAccounts.forEach((account) => {
        expect(account).toHaveProperty('id');
        expect(account).toHaveProperty('email');
        expect(account).toHaveProperty('name');
        expect(account).toHaveProperty('provider');
        expect(account).toHaveProperty('accessToken');
        expect(account).toHaveProperty('refreshToken');
        expect(account).toHaveProperty('expiresIn');

        expect(typeof account.id).toBe('string');
        expect(typeof account.email).toBe('string');
        expect(typeof account.name).toBe('string');
        expect(typeof account.accessToken).toBe('string');
        expect(typeof account.refreshToken).toBe('string');
        expect(typeof account.expiresIn).toBe('number');
        expect(account.expiresIn).toBeGreaterThan(0);
      });
    });

    it('should have accounts with different statuses', () => {
      const oauthConfig = getOAuthMockConfig();
      const statuses = oauthConfig.mockAccounts.map((account) => account.status);

      expect(statuses).toContain('active');
      expect(statuses).toContain('suspended');
    });

    it('should have accounts with 2FA enabled and disabled', () => {
      const oauthConfig = getOAuthMockConfig();
      const twoFactorStates = oauthConfig.mockAccounts.map((account) => account.twoFactorEnabled);

      expect(twoFactorStates).toContain(true);
      expect(twoFactorStates).toContain(false);
    });
  });

  describe('Configuration Validation Edge Cases', () => {
    it('should handle missing required fields in email config', () => {
      const incompleteConfig = {
        logEmails: true,
        simulateDelay: false,
        // Missing other required fields
      };

      expect(() => validateEmailMockConfig(incompleteConfig)).toThrow();
    });

    it('should handle invalid data types', () => {
      const invalidConfig = {
        logEmails: 'true', // string instead of boolean
        simulateDelay: 1, // number instead of boolean
        delayMs: '150', // string instead of number
        simulateFailures: null,
        failureRate: 'invalid',
        failOnEmails: 'not-an-array',
        blockEmails: [],
      };

      expect(() => validateEmailMockConfig(invalidConfig)).toThrow();
    });

    it('should handle boundary values', () => {
      const boundaryConfig: EmailMockConfig = {
        enabled: true,
        logEmails: true,
        simulateDelay: true,
        delayMs: 10000, // max value
        simulateFailures: true,
        failureRate: 1.0, // max value
        failOnEmails: [],
        blockEmails: [],
      };

      expect(() => validateEmailMockConfig(boundaryConfig)).not.toThrow();
    });

    it('should reject out-of-bounds values', () => {
      const outOfBoundsConfig = {
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

  describe('Configuration State Management', () => {
    it('should maintain configuration state between method calls', () => {
      const initialConfig = mockConfig.getConfig();

      updateEmailMockConfig({ logEmails: false });

      const updatedConfig = mockConfig.getConfig();
      expect(updatedConfig.email.logEmails).toBe(false);
      expect(updatedConfig.oauth).toEqual(initialConfig.oauth);
    });

    it('should validate configuration state', () => {
      expect(mockConfig.isConfigValid()).toBe(true);

      // This would need to be tested with actual invalid state
      // which might require more complex setup
    });
  });
});
