import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { oauthMockService } from '../../../../src/mocks/oauth/OAuthMockService';
import { getOAuthMockConfig, MockOAuthAccount } from '../../../../src/config/mock.config';
import { OAuthProviders } from '../../../../src/feature/account/Account.types';

const mockAccount: MockOAuthAccount = {
  id: 'mock_user_1',
  email: 'test.user@example.com',
  name: 'Test User',
  firstName: 'Test',
  lastName: 'User',
  imageUrl: 'https://via.placeholder.com/150?text=Test+User',
  emailVerified: true,
  provider: OAuthProviders.Google,
  accessToken: 'mock_access_token_test_user_123456789',
  refreshToken: 'mock_refresh_token_test_user_987654321',
  expiresIn: 3600,
  twoFactorEnabled: false,
  status: 'active',
};

const mockConfig = {
  enabled: true,
  simulateDelay: true,
  delayMs: 1500,
  simulateErrors: false,
  errorRate: 0.05,
  mockAccounts: [mockAccount],
  failOnEmails: ['fail@example.com', 'error@test.com', 'oauth-error@example.com'],
  blockEmails: ['blocked@example.com', 'spam@test.com', 'oauth-blocked@example.com'],
  autoApprove: true,
  requireConsent: false,
  logRequests: true,
  mockServerEnabled: true,
  mockServerPort: 8080,
};

// Mock the logger
vi.mock('../../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('OAuthMockService', () => {
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';

    // Clear cache and refresh config
    oauthMockService.clearCache();
    oauthMockService.refreshConfig();
  });

  afterEach(() => {
    // Clean up environment
    delete process.env.NODE_ENV;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
  });

  describe('Service Configuration', () => {
    it('should be enabled in non-production environment', () => {
      process.env.NODE_ENV = 'test';
      expect(oauthMockService.isEnabled()).toBe(true);
    });

    it('should be disabled in production environment', () => {
      process.env.NODE_ENV = 'production';
      expect(oauthMockService.isEnabled()).toBe(false);
    });

    it('should be disabled when config is disabled', () => {
      const disabledConfig = { ...mockConfig, enabled: false };
      vi.mocked(getOAuthMockConfig).mockReturnValue(disabledConfig);
      oauthMockService.refreshConfig();

      expect(oauthMockService.isEnabled()).toBe(false);
    });

    it('should refresh configuration', () => {
      const newConfig = { ...mockConfig, logRequests: false };
      vi.mocked(getOAuthMockConfig).mockReturnValue(newConfig);

      oauthMockService.refreshConfig();

      expect(getOAuthMockConfig).toHaveBeenCalled();
      expect(oauthMockService.getConfig()).toEqual(newConfig);
    });

    it('should return supported providers', () => {
      const providers = oauthMockService.getSupportedProviders();
      expect(providers).toContain(OAuthProviders.Google);
      expect(providers).toContain(OAuthProviders.Microsoft);
      expect(providers).toContain(OAuthProviders.Facebook);
    });
  });

  describe('State Management', () => {
    it('should save and retrieve OAuth state', () => {
      const state = oauthMockService.saveOAuthState(
        OAuthProviders.Google,
        'signin',
        'http://localhost:3000/callback',
        'test@example.com',
      );

      expect(state).toBeTruthy();
      expect(typeof state).toBe('string');

      const stateData = oauthMockService.getOAuthState(state);
      expect(stateData).toBeTruthy();
      expect(stateData!.provider).toBe(OAuthProviders.Google);
      expect(stateData!.authType).toBe('signin');
      expect(stateData!.callbackUrl).toBe('http://localhost:3000/callback');
      expect(stateData!.mockAccountEmail).toBe('test@example.com');
    });

    it('should return null for non-existent state', () => {
      const stateData = oauthMockService.getOAuthState('non-existent-state');
      expect(stateData).toBeNull();
    });

    it('should remove state', () => {
      const state = oauthMockService.saveOAuthState(OAuthProviders.Google, 'signin', 'http://localhost:3000/callback');

      oauthMockService.removeOAuthState(state);

      const stateData = oauthMockService.getOAuthState(state);
      expect(stateData).toBeNull();
    });

    it('should handle expired state', () => {
      const state = oauthMockService.saveOAuthState(OAuthProviders.Google, 'signin', 'http://localhost:3000/callback');

      // Mock expired state by setting past expiration
      const pastDate = new Date(Date.now() - 1000).toISOString();
      const stateData = oauthMockService.getOAuthState(state);
      if (stateData) {
        stateData.expiresAt = pastDate;
      }

      // Should return null for expired state
      const expiredStateData = oauthMockService.getOAuthState(state);
      expect(expiredStateData).toBeNull();
    });
  });

  describe('Account Management', () => {
    it('should find mock account by email', () => {
      const account = oauthMockService.findMockAccount('test@example.com');
      expect(account).toBeTruthy();
      expect(account!.email).toBe('test@example.com');
    });

    it('should find mock account by email and provider', () => {
      const account = oauthMockService.findMockAccount('test@example.com', OAuthProviders.Google);
      expect(account).toBeTruthy();
      expect(account!.provider).toBe(OAuthProviders.Google);
    });

    it('should return null for non-existent account', () => {
      const account = oauthMockService.findMockAccount('nonexistent@example.com');
      expect(account).toBeNull();
    });

    it('should get all mock accounts', () => {
      const accounts = oauthMockService.getAllMockAccounts();
      expect(accounts).toHaveLength(1);
      expect(accounts[0].email).toBe('test@example.com');
    });

    it('should filter accounts by provider', () => {
      const googleAccounts = oauthMockService.getAllMockAccounts(OAuthProviders.Google);
      expect(googleAccounts).toHaveLength(1);

      const microsoftAccounts = oauthMockService.getAllMockAccounts(OAuthProviders.Microsoft);
      expect(microsoftAccounts).toHaveLength(0);
    });
  });

  describe('Error Simulation', () => {
    it('should simulate errors for emails in failOnEmails list', () => {
      const shouldFail = oauthMockService.shouldSimulateError('fail@example.com');
      expect(shouldFail).toBe(true);
    });

    it('should not simulate errors for regular emails when disabled', () => {
      const shouldFail = oauthMockService.shouldSimulateError('test@example.com');
      expect(shouldFail).toBe(false);
    });

    it('should simulate random errors when enabled', () => {
      const configWithErrors = { ...mockConfig, simulateErrors: true, errorRate: 1.0 };
      vi.mocked(getOAuthMockConfig).mockReturnValue(configWithErrors);
      oauthMockService.refreshConfig();

      const shouldFail = oauthMockService.shouldSimulateError('test@example.com');
      expect(shouldFail).toBe(true);
    });

    it('should check if email is blocked', () => {
      const isBlocked = oauthMockService.isEmailBlocked('blocked@example.com');
      expect(isBlocked).toBe(true);

      const isNotBlocked = oauthMockService.isEmailBlocked('test@example.com');
      expect(isNotBlocked).toBe(false);
    });

    it('should simulate delay when enabled', async () => {
      const configWithDelay = { ...mockConfig, simulateDelay: true, delayMs: 50 };
      vi.mocked(getOAuthMockConfig).mockReturnValue(configWithDelay);
      oauthMockService.refreshConfig();

      const startTime = Date.now();
      await oauthMockService.simulateDelay();
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Authorization Code Flow', () => {
    it('should generate authorization code', () => {
      const state = 'test-state';
      const code = oauthMockService.generateAuthorizationCode(state, mockAccount, OAuthProviders.Google);

      expect(code).toBeTruthy();
      expect(typeof code).toBe('string');
    });

    it('should exchange authorization code for tokens', () => {
      const state = 'test-state';
      const code = oauthMockService.generateAuthorizationCode(state, mockAccount, OAuthProviders.Google);

      const result = oauthMockService.exchangeAuthorizationCode(code, OAuthProviders.Google);

      expect(result).toBeTruthy();
      expect(result!.tokens.access_token).toBe(mockAccount.accessToken);
      expect(result!.tokens.refresh_token).toBe(mockAccount.refreshToken);
      expect(result!.tokens.expires_in).toBe(mockAccount.expiresIn);
      expect(result!.tokens.token_type).toBe('Bearer');
      expect(result!.userInfo.email).toBe(mockAccount.email);
    });

    it('should return null for invalid authorization code', () => {
      const result = oauthMockService.exchangeAuthorizationCode('invalid-code', OAuthProviders.Google);
      expect(result).toBeNull();
    });

    it('should return null for wrong provider', () => {
      const state = 'test-state';
      const code = oauthMockService.generateAuthorizationCode(state, mockAccount, OAuthProviders.Google);

      const result = oauthMockService.exchangeAuthorizationCode(code, OAuthProviders.Microsoft);
      expect(result).toBeNull();
    });

    it('should handle one-time use of authorization codes', () => {
      const state = 'test-state';
      const code = oauthMockService.generateAuthorizationCode(state, mockAccount, OAuthProviders.Google);

      // First exchange should work
      const result1 = oauthMockService.exchangeAuthorizationCode(code, OAuthProviders.Google);
      expect(result1).toBeTruthy();

      // Second exchange should fail
      const result2 = oauthMockService.exchangeAuthorizationCode(code, OAuthProviders.Google);
      expect(result2).toBeNull();
    });
  });

  describe('Token Operations', () => {
    it('should get token info', () => {
      const tokenInfo = oauthMockService.getTokenInfo(mockAccount.accessToken, OAuthProviders.Google);

      expect(tokenInfo).toBeTruthy();
      expect(tokenInfo.user_id).toBe(mockAccount.id);
      expect(tokenInfo.email).toBe(mockAccount.email);
      expect(tokenInfo.expires_in).toBe(mockAccount.expiresIn);
    });

    it('should return null for invalid token', () => {
      const tokenInfo = oauthMockService.getTokenInfo('invalid-token', OAuthProviders.Google);
      expect(tokenInfo).toBeNull();
    });

    it('should get user info', () => {
      const userInfo = oauthMockService.getUserInfo(mockAccount.accessToken, OAuthProviders.Google);

      expect(userInfo).toBeTruthy();
      expect(userInfo!.id).toBe(mockAccount.id);
      expect(userInfo!.email).toBe(mockAccount.email);
      expect(userInfo!.name).toBe(mockAccount.name);
      expect(userInfo!.email_verified).toBe(mockAccount.emailVerified);
    });

    it('should refresh access token', () => {
      const refreshedTokens = oauthMockService.refreshAccessToken(mockAccount.refreshToken, OAuthProviders.Google);

      expect(refreshedTokens).toBeTruthy();
      expect(refreshedTokens!.access_token).toContain('refreshed');
      expect(refreshedTokens!.refresh_token).toBe(mockAccount.refreshToken);
      expect(refreshedTokens!.expires_in).toBe(mockAccount.expiresIn);
    });

    it('should return null for invalid refresh token', () => {
      const refreshedTokens = oauthMockService.refreshAccessToken('invalid-refresh-token', OAuthProviders.Google);
      expect(refreshedTokens).toBeNull();
    });

    it('should revoke token', () => {
      const success = oauthMockService.revokeToken(mockAccount.accessToken, OAuthProviders.Google);
      expect(success).toBe(true);

      const failRevoke = oauthMockService.revokeToken('invalid-token', OAuthProviders.Google);
      expect(failRevoke).toBe(false);
    });
  });

  describe('Client Validation', () => {
    it('should validate correct client credentials', () => {
      const isValid = oauthMockService.validateClientCredentials(
        'test-google-client-id',
        'test-google-client-secret',
        OAuthProviders.Google,
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
  });

  describe('Statistics and Management', () => {
    beforeEach(() => {
      // Create some test data
      oauthMockService.saveOAuthState(OAuthProviders.Google, 'signin', 'http://localhost:3000/callback');
      oauthMockService.generateAuthorizationCode('test-state', mockAccount, OAuthProviders.Google);
    });

    it('should provide statistics', () => {
      const stats = oauthMockService.getStats();

      expect(stats.activeStates).toBeGreaterThan(0);
      expect(stats.activeCodes).toBeGreaterThan(0);
      expect(stats.mockAccounts).toBe(1);
      expect(stats.accountsByProvider[OAuthProviders.Google]).toBe(1);
      expect(stats.supportedProviders).toContain(OAuthProviders.Google);
      expect(stats.config).toEqual(mockConfig);
    });

    it('should clear cache', () => {
      oauthMockService.clearCache();

      const stats = oauthMockService.getStats();
      expect(stats.activeStates).toBe(0);
      expect(stats.activeCodes).toBe(0);
    });
  });

  describe('Provider Integration', () => {
    it('should get provider instance', () => {
      const googleProvider = oauthMockService.getProvider(OAuthProviders.Google);
      expect(googleProvider).toBeTruthy();

      const microsoftProvider = oauthMockService.getProvider(OAuthProviders.Microsoft);
      expect(microsoftProvider).toBeTruthy();

      const facebookProvider = oauthMockService.getProvider(OAuthProviders.Facebook);
      expect(facebookProvider).toBeTruthy();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle multiple accounts for same provider', () => {
      const secondAccount: MockOAuthAccount = {
        ...mockAccount,
        id: 'mock_user_2',
        email: 'test2@example.com',
        accessToken: 'mock_access_token_789',
        refreshToken: 'mock_refresh_token_012',
      };

      const configWithMultipleAccounts = {
        ...mockConfig,
        mockAccounts: [mockAccount, secondAccount],
      };

      vi.mocked(getOAuthMockConfig).mockReturnValue(configWithMultipleAccounts);
      oauthMockService.refreshConfig();

      const googleAccounts = oauthMockService.getAllMockAccounts(OAuthProviders.Google);
      expect(googleAccounts).toHaveLength(2);
    });

    it('should handle empty mock accounts', () => {
      const emptyConfig = { ...mockConfig, mockAccounts: [] };
      vi.mocked(getOAuthMockConfig).mockReturnValue(emptyConfig);
      oauthMockService.refreshConfig();

      const account = oauthMockService.findMockAccount('test@example.com');
      expect(account).toBeNull();

      const accounts = oauthMockService.getAllMockAccounts();
      expect(accounts).toHaveLength(0);
    });

    it('should handle state with scopes', () => {
      const scopes = ['email', 'profile', 'calendar'];
      const state = oauthMockService.saveOAuthState(
        OAuthProviders.Google,
        'permission',
        'http://localhost:3000/callback',
        'test@example.com',
        scopes,
      );

      const stateData = oauthMockService.getOAuthState(state);
      expect(stateData).toBeTruthy();
      expect(stateData!.scopes).toEqual(scopes);
    });

    it('should handle missing environment variables gracefully', () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;

      const isValid = oauthMockService.validateClientCredentials(
        'any-client-id',
        'any-client-secret',
        OAuthProviders.Google,
      );
      expect(isValid).toBe(false);
    });
  });
});
