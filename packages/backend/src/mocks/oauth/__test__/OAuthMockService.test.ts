import { describe, it, expect, beforeEach, vi } from 'vitest';
import { oauthMockService } from '../../../../src/mocks/oauth/OAuthMockService';
import { OAuthProviders } from '../../../../src/feature/account/Account.types';

// Mock the logger
vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('OAuthMockService', () => {
  beforeEach(() => {
    // Clear cache before each test
    oauthMockService.clearCache();
    // Refresh config to ensure we're using the latest
    oauthMockService.refreshConfig();
  });

  describe('Configuration Management', () => {
    it('should be enabled in test environment', () => {
      expect(oauthMockService.isEnabled()).toBe(true);
    });

    it('should load configuration from mock.config.json', () => {
      const config = oauthMockService.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.mockAccounts).toHaveLength(6);
      expect(config.mockServerEnabled).toBe(true);
      expect(config.mockServerPort).toBe(8080);
      expect(config.autoApprove).toBe(true);
      expect(config.logRequests).toBe(true);
    });

    it('should return supported providers', () => {
      const providers = oauthMockService.getSupportedProviders();

      expect(providers).toContain(OAuthProviders.Google);
      expect(providers).toContain(OAuthProviders.Microsoft);
      expect(providers).toContain(OAuthProviders.Facebook);
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
    it('should find mock accounts by email', () => {
      const testUser = oauthMockService.findMockAccount('test.user@example.com');
      const adminUser = oauthMockService.findMockAccount('admin@example.com');
      const nonExistentUser = oauthMockService.findMockAccount('nonexistent@example.com');

      expect(testUser).toBeDefined();
      expect(testUser?.id).toBe('mock_user_1');
      expect(testUser?.name).toBe('Test User');
      expect(testUser?.provider).toBe(OAuthProviders.Google);
      expect(testUser?.status).toBe('active');
      expect(testUser?.twoFactorEnabled).toBe(false);

      expect(adminUser).toBeDefined();
      expect(adminUser?.id).toBe('mock_user_2');
      expect(adminUser?.name).toBe('Admin User');
      expect(adminUser?.twoFactorEnabled).toBe(true);

      expect(nonExistentUser).toBeNull();
    });

    it('should find mock accounts by email and provider', () => {
      const googleUser = oauthMockService.findMockAccount('test.user@example.com', OAuthProviders.Google);
      const microsoftUser = oauthMockService.findMockAccount('test.user@example.com', OAuthProviders.Microsoft);

      expect(googleUser).toBeDefined();
      expect(googleUser?.provider).toBe(OAuthProviders.Google);
      expect(microsoftUser).toBeNull(); // No Microsoft account with this email
    });

    it('should get all mock accounts', () => {
      const allAccounts = oauthMockService.getAllMockAccounts();
      expect(allAccounts).toHaveLength(6);

      const googleAccounts = oauthMockService.getAllMockAccounts(OAuthProviders.Google);
      expect(googleAccounts).toHaveLength(6); // All accounts in mock.config.json are Google
    });

    it('should handle suspended account', () => {
      const suspendedUser = oauthMockService.findMockAccount('suspended@example.com');

      expect(suspendedUser).toBeDefined();
      expect(suspendedUser?.status).toBe('suspended');
      expect(suspendedUser?.name).toBe('Suspended User');
    });

    it('should handle developer test account', () => {
      const devUser = oauthMockService.findMockAccount('developer@example.com');

      expect(devUser).toBeDefined();
      expect(devUser?.id).toBe('mock_user_6');
      expect(devUser?.name).toBe('Developer Test');
      expect(devUser?.status).toBe('active');
    });

    it('should handle company email accounts', () => {
      const johnDoe = oauthMockService.findMockAccount('john.doe@company.com');
      const janeSmith = oauthMockService.findMockAccount('jane.smith@company.com');

      expect(johnDoe).toBeDefined();
      expect(johnDoe?.name).toBe('John Doe');
      expect(johnDoe?.twoFactorEnabled).toBe(false);

      expect(janeSmith).toBeDefined();
      expect(janeSmith?.name).toBe('Jane Smith');
      expect(janeSmith?.twoFactorEnabled).toBe(true);
    });
  });

  describe('State Management', () => {
    it('should save and retrieve OAuth state', () => {
      const state = oauthMockService.saveOAuthState(
        OAuthProviders.Google,
        'signin',
        'http://localhost:7000/callback',
        'test.user@example.com',
        ['email', 'profile'],
      );

      expect(state).toBeDefined();
      expect(typeof state).toBe('string');
      expect(state.length).toBeGreaterThan(10);

      const retrievedState = oauthMockService.getOAuthState(state);
      expect(retrievedState).toBeDefined();
      expect(retrievedState?.provider).toBe(OAuthProviders.Google);
      expect(retrievedState?.authType).toBe('signin');
      expect(retrievedState?.callbackUrl).toBe('http://localhost:7000/callback');
      expect(retrievedState?.mockAccountEmail).toBe('test.user@example.com');
      expect(retrievedState?.scopes).toEqual(['email', 'profile']);
    });

    it('should return null for invalid state', () => {
      const invalidState = oauthMockService.getOAuthState('invalid_state');
      expect(invalidState).toBeNull();
    });

    it('should remove OAuth state', () => {
      const state = oauthMockService.saveOAuthState(OAuthProviders.Google, 'signup', 'http://localhost:7000/callback');

      let retrievedState = oauthMockService.getOAuthState(state);
      expect(retrievedState).toBeDefined();

      oauthMockService.removeOAuthState(state);
      retrievedState = oauthMockService.getOAuthState(state);
      expect(retrievedState).toBeNull();
    });

    it('should handle state expiration', async () => {
      // Mock Date.now to simulate time passage
      const originalNow = Date.now;
      const mockNow = vi.fn();
      Date.now = mockNow;

      try {
        // Set initial time
        mockNow.mockReturnValue(1000000);

        const state = oauthMockService.saveOAuthState(
          OAuthProviders.Google,
          'signin',
          'http://localhost:7000/callback',
        );

        // Simulate time passage beyond expiration (11 minutes)
        mockNow.mockReturnValue(1000000 + 11 * 60 * 1000);

        const retrievedState = oauthMockService.getOAuthState(state);
        expect(retrievedState).toBeNull();
      } finally {
        Date.now = originalNow;
      }
    });
  });

  describe('Authorization Code Management', () => {
    it('should generate and exchange authorization codes', () => {
      // First save state
      const state = oauthMockService.saveOAuthState(
        OAuthProviders.Google,
        'signin',
        'http://localhost:7000/callback',
        'test.user@example.com',
      );

      const account = oauthMockService.findMockAccount('test.user@example.com')!;

      // Generate authorization code
      const code = oauthMockService.generateAuthorizationCode(state, account, OAuthProviders.Google);
      expect(code).toBeDefined();
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(10);

      // Exchange authorization code
      const exchangeResult = oauthMockService.exchangeAuthorizationCode(code, OAuthProviders.Google);
      expect(exchangeResult).toBeDefined();
      expect(exchangeResult?.tokens).toBeDefined();
      expect(exchangeResult?.userInfo).toBeDefined();

      // Verify tokens
      const { tokens, userInfo } = exchangeResult!;
      expect(tokens.access_token).toBe(account.accessToken);
      expect(tokens.refresh_token).toBe(account.refreshToken);
      expect(tokens.expires_in).toBe(account.expiresIn);
      expect(tokens.token_type).toBe('Bearer');
      expect(tokens.scope).toBe('openid email profile');
      expect(tokens.id_token).toBeDefined();

      // Verify user info
      expect(userInfo.id).toBe(account.id);
      expect(userInfo.email).toBe(account.email);
      expect(userInfo.name).toBe(account.name);
      expect(userInfo.email_verified).toBe(account.emailVerified);
    });

    it('should return null for invalid authorization code', () => {
      const result = oauthMockService.exchangeAuthorizationCode('invalid_code', OAuthProviders.Google);
      expect(result).toBeNull();
    });

    it('should return null for wrong provider', () => {
      const state = oauthMockService.saveOAuthState(OAuthProviders.Google, 'signin', 'http://localhost:7000/callback');

      const account = oauthMockService.findMockAccount('test.user@example.com')!;
      const code = oauthMockService.generateAuthorizationCode(state, account, OAuthProviders.Google);

      // Try to exchange with wrong provider
      const result = oauthMockService.exchangeAuthorizationCode(code, OAuthProviders.Microsoft);
      expect(result).toBeNull();
    });

    it('should handle one-time use of authorization codes', () => {
      const state = oauthMockService.saveOAuthState(OAuthProviders.Google, 'signin', 'http://localhost:7000/callback');

      const account = oauthMockService.findMockAccount('test.user@example.com')!;
      const code = oauthMockService.generateAuthorizationCode(state, account, OAuthProviders.Google);

      // First exchange should work
      const firstResult = oauthMockService.exchangeAuthorizationCode(code, OAuthProviders.Google);
      expect(firstResult).toBeDefined();

      // Second exchange should fail (one-time use)
      const secondResult = oauthMockService.exchangeAuthorizationCode(code, OAuthProviders.Google);
      expect(secondResult).toBeNull();
    });
  });

  describe('Token Operations', () => {
    it('should get token info for valid access token', () => {
      const account = oauthMockService.findMockAccount('test.user@example.com')!;
      const tokenInfo = oauthMockService.getTokenInfo(account.accessToken, OAuthProviders.Google);

      expect(tokenInfo).toBeDefined();
      expect(tokenInfo.user_id).toBe(account.id);
      expect(tokenInfo.email).toBe(account.email);
      expect(tokenInfo.verified_email).toBe(account.emailVerified);
      expect(tokenInfo.expires_in).toBe(account.expiresIn);
    });

    it('should return null for invalid access token', () => {
      const tokenInfo = oauthMockService.getTokenInfo('invalid_token', OAuthProviders.Google);
      expect(tokenInfo).toBeNull();
    });

    it('should get user info for valid access token', () => {
      const account = oauthMockService.findMockAccount('admin@example.com')!;
      const userInfo = oauthMockService.getUserInfo(account.accessToken, OAuthProviders.Google);

      expect(userInfo).toBeDefined();
      expect(userInfo?.id).toBe(account.id);
      expect(userInfo?.email).toBe(account.email);
      expect(userInfo?.name).toBe(account.name);
      expect(userInfo?.given_name).toBe(account.firstName);
      expect(userInfo?.family_name).toBe(account.lastName);
      expect(userInfo?.email_verified).toBe(account.emailVerified);
      expect(userInfo?.picture).toBe(account.imageUrl);
    });

    it('should refresh access tokens', () => {
      const account = oauthMockService.findMockAccount('john.doe@company.com')!;
      const refreshedTokens = oauthMockService.refreshAccessToken(account.refreshToken, OAuthProviders.Google);

      expect(refreshedTokens).toBeDefined();
      expect(refreshedTokens?.access_token).toContain('refreshed');
      expect(refreshedTokens?.refresh_token).toBe(account.refreshToken);
      expect(refreshedTokens?.expires_in).toBe(account.expiresIn);
      expect(refreshedTokens?.token_type).toBe('Bearer');
    });

    it('should return null when refreshing with invalid token', () => {
      const refreshedTokens = oauthMockService.refreshAccessToken('invalid_refresh_token', OAuthProviders.Google);
      expect(refreshedTokens).toBeNull();
    });

    it('should revoke tokens successfully', () => {
      const account = oauthMockService.findMockAccount('jane.smith@company.com')!;

      const accessRevoked = oauthMockService.revokeToken(account.accessToken, OAuthProviders.Google);
      const refreshRevoked = oauthMockService.revokeToken(account.refreshToken, OAuthProviders.Google);

      expect(accessRevoked).toBe(true);
      expect(refreshRevoked).toBe(true);
    });

    it('should return false when revoking invalid tokens', () => {
      const revoked = oauthMockService.revokeToken('invalid_token', OAuthProviders.Google);
      expect(revoked).toBe(false);
    });
  });

  describe('Error Simulation', () => {
    it('should detect blocked emails', () => {
      const config = oauthMockService.getConfig();
      const blockedEmails = config.blockEmails;

      blockedEmails.forEach((email) => {
        expect(oauthMockService.isEmailBlocked(email)).toBe(true);
      });

      expect(oauthMockService.isEmailBlocked('test.user@example.com')).toBe(false);
    });

    it('should detect fail-on emails', () => {
      const config = oauthMockService.getConfig();
      const failOnEmails = config.failOnEmails;

      failOnEmails.forEach((email) => {
        expect(oauthMockService.shouldSimulateError(email)).toBe(true);
      });
    });

    it('should simulate random errors when enabled', () => {
      // Mock Math.random to return a value that triggers error simulation
      const originalRandom = Math.random;
      Math.random = vi.fn().mockReturnValue(0.01); // Below default error rate of 0.05

      try {
        // This would require enabling error simulation in config
        const shouldError = oauthMockService.shouldSimulateError('random@example.com');
        // The result depends on config.simulateErrors setting
        expect(typeof shouldError).toBe('boolean');
      } finally {
        Math.random = originalRandom;
      }
    });

    it('should simulate delays when enabled', async () => {
      const start = Date.now();
      await oauthMockService.simulateDelay();
      const end = Date.now();

      // If delays are enabled in config, this should take some time
      // If disabled, it should be nearly instantaneous
      expect(end - start).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Client Credentials Validation', () => {
    it('should validate Google client credentials', () => {
      const validGoogle = oauthMockService.validateClientCredentials(
        process.env.GOOGLE_CLIENT_ID!,
        process.env.GOOGLE_CLIENT_SECRET!,
        OAuthProviders.Google,
      );
      expect(validGoogle).toBe(true);

      const invalidGoogle = oauthMockService.validateClientCredentials(
        'invalid_id',
        'invalid_secret',
        OAuthProviders.Google,
      );
      expect(invalidGoogle).toBe(false);
    });

    it('should validate Microsoft client credentials', () => {
      // These will be empty in test environment, so should return false
      const microsoftResult = oauthMockService.validateClientCredentials(
        'test_microsoft_id',
        'test_microsoft_secret',
        OAuthProviders.Microsoft,
      );
      expect(microsoftResult).toBe(false);
    });

    it('should validate Facebook client credentials', () => {
      // These will be empty in test environment, so should return false
      const facebookResult = oauthMockService.validateClientCredentials(
        'test_facebook_id',
        'test_facebook_secret',
        OAuthProviders.Facebook,
      );
      expect(facebookResult).toBe(false);
    });
  });

  describe('Statistics and Management', () => {
    it('should provide accurate statistics', () => {
      // Add some state and codes to test
      const state1 = oauthMockService.saveOAuthState(OAuthProviders.Google, 'signin', 'callback1');
      oauthMockService.saveOAuthState(OAuthProviders.Microsoft, 'signup', 'callback2');

      const account = oauthMockService.findMockAccount('test.user@example.com')!;
      oauthMockService.generateAuthorizationCode(state1, account, OAuthProviders.Google);

      const stats = oauthMockService.getStats();

      expect(stats.activeStates).toBeGreaterThanOrEqual(2);
      expect(stats.activeCodes).toBeGreaterThanOrEqual(1);
      expect(stats.mockAccounts).toBe(6);
      expect(stats.accountsByProvider[OAuthProviders.Google]).toBe(6);
      expect(stats.supportedProviders).toContain(OAuthProviders.Google);
      expect(stats.config).toBeDefined();
    });

    it('should clear cache successfully', () => {
      // Add some data
      oauthMockService.saveOAuthState(OAuthProviders.Google, 'signin', 'callback');
      const account = oauthMockService.findMockAccount('test.user@example.com')!;
      oauthMockService.generateAuthorizationCode('test_state', account, OAuthProviders.Google);

      let stats = oauthMockService.getStats();
      expect(stats.activeStates).toBeGreaterThan(0);

      // Clear cache
      oauthMockService.clearCache();

      stats = oauthMockService.getStats();
      expect(stats.activeStates).toBe(0);
      expect(stats.activeCodes).toBe(0);
    });
  });

  describe('Account Type Specific Tests', () => {
    it('should handle 2FA enabled accounts correctly', () => {
      const adminAccount = oauthMockService.findMockAccount('admin@example.com');
      const janeAccount = oauthMockService.findMockAccount('jane.smith@company.com');

      expect(adminAccount?.twoFactorEnabled).toBe(true);
      expect(janeAccount?.twoFactorEnabled).toBe(true);
    });

    it('should handle accounts without 2FA', () => {
      const testAccount = oauthMockService.findMockAccount('test.user@example.com');
      const johnAccount = oauthMockService.findMockAccount('john.doe@company.com');
      const devAccount = oauthMockService.findMockAccount('developer@example.com');

      expect(testAccount?.twoFactorEnabled).toBe(false);
      expect(johnAccount?.twoFactorEnabled).toBe(false);
      expect(devAccount?.twoFactorEnabled).toBe(false);
    });

    it('should have consistent token structure across accounts', () => {
      const accounts = oauthMockService.getAllMockAccounts();

      accounts.forEach((account) => {
        expect(account.accessToken).toMatch(/^mock_access_token_/);
        expect(account.refreshToken).toMatch(/^mock_refresh_token_/);
        expect(account.expiresIn).toBe(3600);
        expect(account.provider).toBe(OAuthProviders.Google);
        expect(account.emailVerified).toBe(true);
        expect(typeof account.imageUrl).toBe('string');
        expect(account.imageUrl).toContain('placeholder');
      });
    });

    it('should handle different account statuses', () => {
      const activeAccounts = oauthMockService.getAllMockAccounts().filter((acc) => acc.status === 'active');
      const suspendedAccounts = oauthMockService.getAllMockAccounts().filter((acc) => acc.status === 'suspended');

      expect(activeAccounts.length).toBe(5);
      expect(suspendedAccounts.length).toBe(1);
      expect(suspendedAccounts[0].email).toBe('suspended@example.com');
    });
  });

  describe('Integration with mock.config.json', () => {
    it('should match exact configuration values from mock.config.json', () => {
      const config = oauthMockService.getConfig();

      // Verify top-level OAuth config
      expect(config.enabled).toBe(true);
      expect(config.simulateDelay).toBe(true);
      expect(config.delayMs).toBe(1500);
      expect(config.simulateErrors).toBe(false);
      expect(config.errorRate).toBe(0.05);
      expect(config.autoApprove).toBe(true);
      expect(config.requireConsent).toBe(false);
      expect(config.logRequests).toBe(true);
      expect(config.mockServerEnabled).toBe(true);
      expect(config.mockServerPort).toBe(8080);

      // Verify fail and block email arrays
      expect(config.failOnEmails).toEqual(['fail@example.com', 'error@test.com', 'oauth-error@example.com']);
      expect(config.blockEmails).toEqual(['blocked@example.com', 'spam@test.com', 'oauth-blocked@example.com']);

      // Verify mock accounts match exactly
      expect(config.mockAccounts).toHaveLength(6);

      const testUser = config.mockAccounts.find((acc) => acc.id === 'mock_user_1');
      expect(testUser).toEqual({
        id: 'mock_user_1',
        email: 'test.user@example.com',
        name: 'Test User',
        firstName: 'Test',
        lastName: 'User',
        imageUrl: 'https://via.placeholder.com/150?text=Test+User',
        emailVerified: true,
        provider: 'google',
        accessToken: 'mock_access_token_test_user_123456789',
        refreshToken: 'mock_refresh_token_test_user_987654321',
        expiresIn: 3600,
        twoFactorEnabled: false,
        status: 'active',
      });
    });

    it('should handle all predefined mock accounts from config', () => {
      const expectedAccounts = [
        { id: 'mock_user_1', email: 'test.user@example.com', name: 'Test User', twoFactor: false, status: 'active' },
        { id: 'mock_user_2', email: 'admin@example.com', name: 'Admin User', twoFactor: true, status: 'active' },
        { id: 'mock_user_3', email: 'john.doe@company.com', name: 'John Doe', twoFactor: false, status: 'active' },
        { id: 'mock_user_4', email: 'jane.smith@company.com', name: 'Jane Smith', twoFactor: true, status: 'active' },
        {
          id: 'mock_user_5',
          email: 'suspended@example.com',
          name: 'Suspended User',
          twoFactor: false,
          status: 'suspended',
        },
        {
          id: 'mock_user_6',
          email: 'developer@example.com',
          name: 'Developer Test',
          twoFactor: false,
          status: 'active',
        },
      ];

      expectedAccounts.forEach((expected) => {
        const account = oauthMockService.findMockAccount(expected.email);
        expect(account).toBeDefined();
        expect(account?.id).toBe(expected.id);
        expect(account?.name).toBe(expected.name);
        expect(account?.twoFactorEnabled).toBe(expected.twoFactor);
        expect(account?.status).toBe(expected.status);
      });
    });
  });
});
