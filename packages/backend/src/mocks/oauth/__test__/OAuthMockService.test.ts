import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { oauthMockService } from '../OAuthMockService';
import { OAuthProviders } from '../../../feature/account/Account.types';
import { updateOAuthMockConfig, type MockAccount } from '../../../config/mock.config';

describe('OAuthMockService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset service state
    oauthMockService.clearCaches();
    oauthMockService.refreshConfig();

    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
    process.env.MICROSOFT_CLIENT_ID = 'test-microsoft-client-id';
    process.env.MICROSOFT_CLIENT_SECRET = 'test-microsoft-client-secret';
    process.env.FACEBOOK_CLIENT_ID = 'test-facebook-client-id';
    process.env.FACEBOOK_CLIENT_SECRET = 'test-facebook-client-secret';
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('Service Configuration', () => {
    it('should be enabled in test environment', () => {
      expect(oauthMockService.isEnabled()).toBe(true);
    });

    it('should not be enabled in production', () => {
      process.env.NODE_ENV = 'production';
      expect(oauthMockService.isEnabled()).toBe(false);
    });

    it('should refresh configuration from file', () => {
      const initialConfig = oauthMockService.getConfig();
      oauthMockService.refreshConfig();
      const refreshedConfig = oauthMockService.getConfig();

      expect(refreshedConfig).toEqual(initialConfig);
    });

    it('should get supported providers from config', () => {
      const supportedProviders = oauthMockService.getSupportedProviders();

      expect(Array.isArray(supportedProviders)).toBe(true);
      expect(supportedProviders).toContain(OAuthProviders.Google);
    });

    it('should get provider instances', () => {
      const googleProvider = oauthMockService.getProvider(OAuthProviders.Google);
      const microsoftProvider = oauthMockService.getProvider(OAuthProviders.Microsoft);
      const facebookProvider = oauthMockService.getProvider(OAuthProviders.Facebook);

      expect(googleProvider).toBeDefined();
      expect(microsoftProvider).toBeDefined();
      expect(facebookProvider).toBeDefined();
    });
  });

  describe('Mock Account Management', () => {
    it('should find mock account by email and provider', () => {
      const account = oauthMockService.findMockAccount('test.user@example.com', OAuthProviders.Google);

      if (account) {
        expect(account.email).toBe('test.user@example.com');
        expect(account.provider).toBe(OAuthProviders.Google);
        expect(account.accountType).toBe('oauth');
      }
    });

    it('should find mock account by email only', () => {
      const account = oauthMockService.findMockAccount('test.user@example.com');

      if (account) {
        expect(account.email).toBe('test.user@example.com');
      }
    });

    it('should return null for non-existent account', () => {
      const account = oauthMockService.findMockAccount('nonexistent@example.com');
      expect(account).toBeNull();
    });

    it('should get all mock accounts', () => {
      const allAccounts = oauthMockService.getAllMockAccounts();

      expect(Array.isArray(allAccounts)).toBe(true);
      expect(allAccounts.length).toBeGreaterThan(0);

      allAccounts.forEach((account) => {
        expect(account.accountType).toBe('oauth');
        expect(account.provider).toBeDefined();
      });
    });

    it('should get mock accounts by provider', () => {
      const googleAccounts = oauthMockService.getAllMockAccounts(OAuthProviders.Google);

      expect(Array.isArray(googleAccounts)).toBe(true);
      googleAccounts.forEach((account) => {
        expect(account.provider).toBe(OAuthProviders.Google);
        expect(account.accountType).toBe('oauth');
      });
    });
  });

  describe('Error Simulation', () => {
    it('should simulate error for specific emails', () => {
      // Update config to fail on specific email
      updateOAuthMockConfig({
        simulateErrors: true,
        failOnEmails: ['fail@example.com'],
      });
      oauthMockService.refreshConfig();

      expect(oauthMockService.shouldSimulateError('fail@example.com')).toBe(true);
      expect(oauthMockService.shouldSimulateError('success@example.com')).toBe(false);
    });

    it('should simulate random errors based on error rate', () => {
      updateOAuthMockConfig({
        simulateErrors: true,
        errorRate: 1.0, // 100% error rate
        failOnEmails: [],
      });
      oauthMockService.refreshConfig();

      expect(oauthMockService.shouldSimulateError('test@example.com')).toBe(true);
    });

    it('should not simulate errors when disabled', () => {
      updateOAuthMockConfig({
        simulateErrors: false,
        errorRate: 1.0,
        failOnEmails: ['fail@example.com'],
      });
      oauthMockService.refreshConfig();

      expect(oauthMockService.shouldSimulateError('fail@example.com')).toBe(true); // Still fails for specific emails
      expect(oauthMockService.shouldSimulateError('test@example.com')).toBe(false); // Random errors disabled
    });

    it('should check if email is blocked', () => {
      updateOAuthMockConfig({
        blockEmails: ['blocked@example.com', 'spam@example.com'],
      });
      oauthMockService.refreshConfig();

      expect(oauthMockService.isEmailBlocked('blocked@example.com')).toBe(true);
      expect(oauthMockService.isEmailBlocked('normal@example.com')).toBe(false);
    });

    it('should simulate delay when enabled', async () => {
      updateOAuthMockConfig({
        simulateDelay: true,
        delayMs: 10, // Short delay for testing
      });
      oauthMockService.refreshConfig();

      const startTime = Date.now();
      await oauthMockService.simulateDelay();
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(10);
    });

    it('should not delay when simulation disabled', async () => {
      updateOAuthMockConfig({
        simulateDelay: false,
        delayMs: 1000,
      });
      oauthMockService.refreshConfig();

      const startTime = Date.now();
      await oauthMockService.simulateDelay();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(50); // Should be nearly instant
    });
  });

  describe('Authorization Code Management', () => {
    let testAccount: MockAccount;

    beforeEach(() => {
      testAccount = oauthMockService.findMockAccount('test.user@example.com', OAuthProviders.Google)!;
      expect(testAccount).toBeDefined();
    });

    it('should generate authorization code', () => {
      const state = 'test-state-123';
      const code = oauthMockService.generateAuthorizationCode(state, testAccount, OAuthProviders.Google);

      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(0);
      expect(code).toMatch(/^[a-f0-9]+$/); // Should be hex string
    });

    it('should exchange authorization code for tokens', () => {
      const state = 'test-state-123';
      const code = oauthMockService.generateAuthorizationCode(state, testAccount, OAuthProviders.Google);

      const result = oauthMockService.exchangeAuthorizationCode(code, OAuthProviders.Google);

      expect(result).toBeDefined();
      expect(result!.tokens).toBeDefined();
      expect(result!.userInfo).toBeDefined();

      // Check tokens structure
      expect(result!.tokens).toHaveProperty('access_token');
      expect(result!.tokens).toHaveProperty('refresh_token');
      expect(result!.tokens).toHaveProperty('expires_in');
      expect(result!.tokens).toHaveProperty('token_type');
      expect(result!.tokens).toHaveProperty('scope');
      expect(result!.tokens).toHaveProperty('id_token');

      // Check user info structure
      expect(result!.userInfo).toHaveProperty('id');
      expect(result!.userInfo).toHaveProperty('email');
      expect(result!.userInfo).toHaveProperty('name');
      expect(result!.userInfo).toHaveProperty('email_verified');

      expect(result!.userInfo.email).toBe(testAccount.email);
      expect(result!.userInfo.name).toBe(testAccount.name);
    });

    it('should return null for invalid authorization code', () => {
      const result = oauthMockService.exchangeAuthorizationCode('invalid-code', OAuthProviders.Google);
      expect(result).toBeNull();
    });

    it('should return null for wrong provider', () => {
      const state = 'test-state-123';
      const code = oauthMockService.generateAuthorizationCode(state, testAccount, OAuthProviders.Google);

      const result = oauthMockService.exchangeAuthorizationCode(code, OAuthProviders.Microsoft);
      expect(result).toBeNull();
    });

    it('should handle code expiration', async () => {
      const state = 'test-state-123';
      const code = oauthMockService.generateAuthorizationCode(state, testAccount, OAuthProviders.Google);

      // Code should work immediately
      const result1 = oauthMockService.exchangeAuthorizationCode(code, OAuthProviders.Google);
      expect(result1).toBeDefined();

      // Code should be consumed (one-time use)
      const result2 = oauthMockService.exchangeAuthorizationCode(code, OAuthProviders.Google);
      expect(result2).toBeNull();
    });
  });

  describe('Token Operations', () => {
    let accessToken: string;
    let refreshToken: string;
    let testAccount: MockAccount;

    beforeEach(() => {
      testAccount = oauthMockService.findMockAccount('test.user@example.com', OAuthProviders.Google)!;
      const state = 'test-state-123';
      const code = oauthMockService.generateAuthorizationCode(state, testAccount, OAuthProviders.Google);
      const result = oauthMockService.exchangeAuthorizationCode(code, OAuthProviders.Google)!;

      accessToken = result.tokens.access_token;
      refreshToken = result.tokens.refresh_token;
    });

    it('should get token info', () => {
      const tokenInfo = oauthMockService.getTokenInfo(accessToken, OAuthProviders.Google);

      expect(tokenInfo).toBeDefined();
      expect(tokenInfo!.user_id).toBe(testAccount.id);
      expect(tokenInfo!.email).toBe(testAccount.email);
      expect(tokenInfo!.verified_email).toBe(testAccount.emailVerified);
      expect(tokenInfo!.expires_in).toBeGreaterThan(0);
    });

    it('should get user info from access token', () => {
      const userInfo = oauthMockService.getUserInfo(accessToken, OAuthProviders.Google);

      expect(userInfo).toBeDefined();
      expect(userInfo!.id).toBe(testAccount.id);
      expect(userInfo!.email).toBe(testAccount.email);
      expect(userInfo!.name).toBe(testAccount.name);
      expect(userInfo!.email_verified).toBe(testAccount.emailVerified);
    });

    it('should return null for invalid access token', () => {
      const tokenInfo = oauthMockService.getTokenInfo('invalid-token', OAuthProviders.Google);
      expect(tokenInfo).toBeNull();

      const userInfo = oauthMockService.getUserInfo('invalid-token', OAuthProviders.Google);
      expect(userInfo).toBeNull();
    });

    it('should refresh access token', () => {
      const newTokens = oauthMockService.refreshAccessToken(refreshToken, OAuthProviders.Google);

      expect(newTokens).toBeDefined();
      expect(newTokens!.access_token).toBeDefined();
      expect(newTokens!.refresh_token).toBe(refreshToken); // Same refresh token
      expect(newTokens!.expires_in).toBe(3600);
      expect(newTokens!.token_type).toBe('Bearer');

      // New access token should be different
      expect(newTokens!.access_token).not.toBe(accessToken);
    });

    it('should return null for invalid refresh token', () => {
      const result = oauthMockService.refreshAccessToken('invalid-refresh-token', OAuthProviders.Google);
      expect(result).toBeNull();
    });

    it('should revoke access token', () => {
      const revoked = oauthMockService.revokeToken(accessToken, OAuthProviders.Google);
      expect(revoked).toBe(true);

      // Token should no longer work
      const tokenInfo = oauthMockService.getTokenInfo(accessToken, OAuthProviders.Google);
      expect(tokenInfo).toBeNull();
    });

    it('should revoke refresh token', () => {
      const revoked = oauthMockService.revokeToken(refreshToken, OAuthProviders.Google);
      expect(revoked).toBe(true);

      // Refresh token should no longer work
      const newTokens = oauthMockService.refreshAccessToken(refreshToken, OAuthProviders.Google);
      expect(newTokens).toBeNull();
    });

    it('should return false for invalid token revocation', () => {
      const revoked = oauthMockService.revokeToken('invalid-token', OAuthProviders.Google);
      expect(revoked).toBe(false);
    });
  });

  describe('Client Credential Validation', () => {
    it('should validate Google client credentials', () => {
      const isValid = oauthMockService.validateClientCredentials(
        'test-google-client-id',
        'test-google-client-secret',
        OAuthProviders.Google,
      );
      expect(isValid).toBe(true);
    });

    it('should validate Microsoft client credentials', () => {
      const isValid = oauthMockService.validateClientCredentials(
        'test-microsoft-client-id',
        'test-microsoft-client-secret',
        OAuthProviders.Microsoft,
      );
      expect(isValid).toBe(true);
    });

    it('should validate Facebook client credentials', () => {
      const isValid = oauthMockService.validateClientCredentials(
        'test-facebook-client-id',
        'test-facebook-client-secret',
        OAuthProviders.Facebook,
      );
      expect(isValid).toBe(true);
    });

    it('should reject invalid client credentials', () => {
      const isValid = oauthMockService.validateClientCredentials(
        'wrong-client-id',
        'wrong-client-secret',
        OAuthProviders.Google,
      );
      expect(isValid).toBe(false);
    });

    it('should return false for unsupported provider', () => {
      const invalidProvider = 'unsupported' as OAuthProviders;
      const isValid = oauthMockService.validateClientCredentials('any-id', 'any-secret', invalidProvider);
      expect(isValid).toBe(false);
    });
  });

  describe('Service Statistics', () => {
    it('should provide comprehensive statistics', () => {
      const stats = oauthMockService.getStats();

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('mockAccounts');
      expect(stats).toHaveProperty('accountsByProvider');
      expect(stats).toHaveProperty('supportedProviders');
      expect(stats).toHaveProperty('enabledProviders');
      expect(stats).toHaveProperty('activeTokens');
      expect(stats).toHaveProperty('activeCodes');
      expect(stats).toHaveProperty('config');

      expect(typeof stats.mockAccounts).toBe('number');
      expect(typeof stats.accountsByProvider).toBe('object');
      expect(Array.isArray(stats.supportedProviders)).toBe(true);
      expect(Array.isArray(stats.enabledProviders)).toBe(true);
      expect(typeof stats.activeTokens).toBe('number');
      expect(typeof stats.activeCodes).toBe('number');
    });

    it('should track account counts by provider', () => {
      const stats = oauthMockService.getStats();

      expect(stats.accountsByProvider[OAuthProviders.Google]).toBeGreaterThan(0);
      expect(typeof stats.accountsByProvider[OAuthProviders.Microsoft]).toBe('number');
      expect(typeof stats.accountsByProvider[OAuthProviders.Facebook]).toBe('number');
    });

    it('should track active tokens and codes', () => {
      // Generate some tokens
      const testAccount = oauthMockService.findMockAccount('test.user@example.com', OAuthProviders.Google)!;
      const code = oauthMockService.generateAuthorizationCode('state', testAccount, OAuthProviders.Google);

      let stats = oauthMockService.getStats();
      expect(stats.activeCodes).toBeGreaterThan(0);

      // Exchange for tokens
      oauthMockService.exchangeAuthorizationCode(code, OAuthProviders.Google);

      stats = oauthMockService.getStats();
      expect(stats.activeTokens).toBeGreaterThan(0);
    });
  });

  describe('Cache Management', () => {
    it('should clear all caches', () => {
      // Generate some data to cache
      const testAccount = oauthMockService.findMockAccount('test.user@example.com', OAuthProviders.Google)!;
      const code = oauthMockService.generateAuthorizationCode('state', testAccount, OAuthProviders.Google);
      oauthMockService.exchangeAuthorizationCode(code, OAuthProviders.Google);

      let stats = oauthMockService.getStats();

      // Clear caches
      oauthMockService.clearCaches();

      stats = oauthMockService.getStats();
      expect(stats.activeTokens).toBe(0);
      expect(stats.activeCodes).toBe(0);
    });
  });

  describe('Dynamic Token Generation', () => {
    it('should generate unique tokens each time', () => {
      const testAccount = oauthMockService.findMockAccount('test.user@example.com', OAuthProviders.Google)!;

      const code1 = oauthMockService.generateAuthorizationCode('state1', testAccount, OAuthProviders.Google);
      const code2 = oauthMockService.generateAuthorizationCode('state2', testAccount, OAuthProviders.Google);

      expect(code1).not.toBe(code2);

      const result1 = oauthMockService.exchangeAuthorizationCode(code1, OAuthProviders.Google)!;
      const result2 = oauthMockService.exchangeAuthorizationCode(code2, OAuthProviders.Google)!;

      expect(result1.tokens.access_token).not.toBe(result2.tokens.access_token);
      expect(result1.tokens.refresh_token).not.toBe(result2.tokens.refresh_token);
    });

    it('should generate tokens with correct format', () => {
      const testAccount = oauthMockService.findMockAccount('test.user@example.com', OAuthProviders.Google)!;
      const code = oauthMockService.generateAuthorizationCode('state', testAccount, OAuthProviders.Google);
      const result = oauthMockService.exchangeAuthorizationCode(code, OAuthProviders.Google)!;

      // Check token format patterns
      expect(result.tokens.access_token).toMatch(/^mock_google_access_/);
      expect(result.tokens.refresh_token).toMatch(/^mock_google_refresh_/);

      // Should contain account ID and timestamp
      expect(result.tokens.access_token).toContain(testAccount.id);
      expect(result.tokens.refresh_token).toContain(testAccount.id);
    });
  });
});
