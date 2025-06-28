import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GoogleMockProvider } from '../../../../src/mocks/google/GoogleMockProvider';
import { MockOAuthAccount, OAuthMockConfig } from '../../../../src/config/mock.config';
import { OAuthProviders } from '../../../../src/feature/account/Account.types';

// Mock the logger
vi.mock('../../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('GoogleMockProvider', () => {
  let googleProvider: GoogleMockProvider;

  const mockConfig: OAuthMockConfig = {
    enabled: true,
    simulateDelay: false,
    delayMs: 1000,
    simulateErrors: false,
    errorRate: 0.05,
    mockAccounts: [],
    failOnEmails: ['fail@example.com'],
    blockEmails: ['blocked@example.com'],
    autoApprove: true,
    requireConsent: false,
    logRequests: true,
    mockServerEnabled: true,
    mockServerPort: 8080,
  };

  const mockGoogleAccount: MockOAuthAccount = {
    id: 'google_user_1',
    email: 'test@example.com',
    name: 'Test User',
    firstName: 'Test',
    lastName: 'User',
    imageUrl: 'https://lh3.googleusercontent.com/test',
    emailVerified: true,
    provider: OAuthProviders.Google,
    accessToken: 'ya29.test_access_token',
    refreshToken: '1//test_refresh_token',
    expiresIn: 3600,
    twoFactorEnabled: false,
    status: 'active',
  };

  const suspendedGoogleAccount: MockOAuthAccount = {
    ...mockGoogleAccount,
    id: 'google_suspended',
    email: 'suspended@example.com',
    status: 'suspended',
  };

  const unverifiedGoogleAccount: MockOAuthAccount = {
    ...mockGoogleAccount,
    id: 'google_unverified',
    email: 'unverified@example.com',
    emailVerified: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';

    googleProvider = new GoogleMockProvider(mockConfig);
  });

  afterEach(() => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
  });

  describe('Token Operations', () => {
    it('should generate Google ID token', () => {
      const idToken = googleProvider.generateGoogleIdToken(mockGoogleAccount);

      expect(idToken).toBeTruthy();
      expect(typeof idToken).toBe('string');

      // Should be a JWT with 3 parts
      const parts = idToken.split('.');
      expect(parts).toHaveLength(3);

      // Decode and verify payload
      const payload = JSON.parse(atob(parts[1]));
      expect(payload.iss).toBe('https://accounts.google.com');
      expect(payload.sub).toBe(mockGoogleAccount.id);
      expect(payload.email).toBe(mockGoogleAccount.email);
      expect(payload.email_verified).toBe(mockGoogleAccount.emailVerified);
      expect(payload.name).toBe(mockGoogleAccount.name);
      expect(payload.given_name).toBe(mockGoogleAccount.firstName);
      expect(payload.family_name).toBe(mockGoogleAccount.lastName);
    });

    it('should throw error for non-Google account', () => {
      const nonGoogleAccount = { ...mockGoogleAccount, provider: OAuthProviders.Microsoft };

      expect(() => {
        googleProvider.generateGoogleIdToken(nonGoogleAccount as MockOAuthAccount);
      }).toThrow('Account is not a Google account');
    });

    it('should get Google token info', () => {
      const accounts = [mockGoogleAccount];
      const tokenInfo = googleProvider.getGoogleTokenInfo(mockGoogleAccount.accessToken, accounts);

      expect(tokenInfo).toBeTruthy();
      expect(tokenInfo!.user_id).toBe(mockGoogleAccount.id);
      expect(tokenInfo!.email).toBe(mockGoogleAccount.email);
      expect(tokenInfo!.verified_email).toBe(mockGoogleAccount.emailVerified);
      expect(tokenInfo!.expires_in).toBe(mockGoogleAccount.expiresIn);
      expect(tokenInfo!.scope).toContain('email');
      expect(tokenInfo!.scope).toContain('profile');
    });

    it('should return null for invalid access token', () => {
      const accounts = [mockGoogleAccount];
      const tokenInfo = googleProvider.getGoogleTokenInfo('invalid-token', accounts);

      expect(tokenInfo).toBeNull();
    });

    it('should get Google user info', () => {
      const accounts = [mockGoogleAccount];
      const userInfo = googleProvider.getGoogleUserInfo(mockGoogleAccount.accessToken, accounts);

      expect(userInfo).toBeTruthy();
      expect(userInfo!.id).toBe(mockGoogleAccount.id);
      expect(userInfo!.email).toBe(mockGoogleAccount.email);
      expect(userInfo!.name).toBe(mockGoogleAccount.name);
      expect(userInfo!.given_name).toBe(mockGoogleAccount.firstName);
      expect(userInfo!.family_name).toBe(mockGoogleAccount.lastName);
      expect(userInfo!.email_verified).toBe(mockGoogleAccount.emailVerified);
      expect(userInfo!.locale).toBe('en');
    });

    it('should include hosted domain in user info for enterprise accounts', () => {
      const enterpriseAccount = { ...mockGoogleAccount, email: 'user@company.com' };
      const accounts = [enterpriseAccount];
      const userInfo = googleProvider.getGoogleUserInfo(enterpriseAccount.accessToken, accounts);

      expect(userInfo).toBeTruthy();
      expect(userInfo!.hd).toBe('company.com');
    });
  });

  describe('Authorization Code Exchange', () => {
    it('should exchange authorization code for tokens', () => {
      const tokens = googleProvider.exchangeGoogleAuthorizationCode('auth-code', mockGoogleAccount);

      expect(tokens.access_token).toBe(mockGoogleAccount.accessToken);
      expect(tokens.refresh_token).toBe(mockGoogleAccount.refreshToken);
      expect(tokens.expires_in).toBe(mockGoogleAccount.expiresIn);
      expect(tokens.token_type).toBe('Bearer');
      expect(tokens.scope).toBe('openid email profile');
      expect(tokens.id_token).toBeTruthy();

      // Verify ID token
      const idTokenParts = tokens.id_token!.split('.');
      expect(idTokenParts).toHaveLength(3);
    });

    it('should throw error for non-Google account in code exchange', () => {
      const nonGoogleAccount = { ...mockGoogleAccount, provider: OAuthProviders.Microsoft };

      expect(() => {
        googleProvider.exchangeGoogleAuthorizationCode('auth-code', nonGoogleAccount as MockOAuthAccount);
      }).toThrow('Account is not a Google account');
    });
  });

  describe('Token Refresh', () => {
    it('should refresh Google access token', () => {
      const accounts = [mockGoogleAccount];
      const refreshedTokens = googleProvider.refreshGoogleAccessToken(mockGoogleAccount.refreshToken, accounts);

      expect(refreshedTokens).toBeTruthy();
      expect(refreshedTokens!.access_token).toContain('refreshed');
      expect(refreshedTokens!.refresh_token).toBe(mockGoogleAccount.refreshToken);
      expect(refreshedTokens!.expires_in).toBe(mockGoogleAccount.expiresIn);
      expect(refreshedTokens!.token_type).toBe('Bearer');
      expect(refreshedTokens!.scope).toBe('openid email profile');
    });

    it('should return null for invalid refresh token', () => {
      const accounts = [mockGoogleAccount];
      const refreshedTokens = googleProvider.refreshGoogleAccessToken('invalid-refresh-token', accounts);

      expect(refreshedTokens).toBeNull();
    });
  });

  describe('Token Revocation', () => {
    it('should revoke Google token', () => {
      const accounts = [mockGoogleAccount];
      const success = googleProvider.revokeGoogleToken(mockGoogleAccount.accessToken, accounts);

      expect(success).toBe(true);
    });

    it('should revoke Google refresh token', () => {
      const accounts = [mockGoogleAccount];
      const success = googleProvider.revokeGoogleToken(mockGoogleAccount.refreshToken, accounts);

      expect(success).toBe(true);
    });

    it('should return false for invalid token', () => {
      const accounts = [mockGoogleAccount];
      const success = googleProvider.revokeGoogleToken('invalid-token', accounts);

      expect(success).toBe(false);
    });
  });

  describe('Client Credentials Validation', () => {
    it('should validate correct Google client credentials', () => {
      const isValid = googleProvider.validateGoogleClientCredentials(
        'test-google-client-id',
        'test-google-client-secret',
      );

      expect(isValid).toBe(true);
    });

    it('should reject invalid client ID', () => {
      const isValid = googleProvider.validateGoogleClientCredentials('wrong-client-id', 'test-google-client-secret');

      expect(isValid).toBe(false);
    });

    it('should reject invalid client secret', () => {
      const isValid = googleProvider.validateGoogleClientCredentials('test-google-client-id', 'wrong-client-secret');

      expect(isValid).toBe(false);
    });
  });

  describe('Authorization Request Validation', () => {
    const validParams = {
      client_id: 'test-google-client-id',
      response_type: 'code',
      scope: 'email profile',
      state: 'test-state',
      redirect_uri: 'http://localhost:3000/callback',
    };

    it('should validate correct authorization request', () => {
      const result = googleProvider.validateGoogleAuthorizationRequest(validParams);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject missing required parameters', () => {
      const invalidParams = { ...validParams };
      delete (invalidParams as any).client_id;

      const result = googleProvider.validateGoogleAuthorizationRequest(invalidParams);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing required parameters');
    });

    it('should reject invalid client_id', () => {
      const invalidParams = { ...validParams, client_id: 'wrong-client-id' };

      const result = googleProvider.validateGoogleAuthorizationRequest(invalidParams);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid client_id');
    });

    it('should reject unsupported response_type', () => {
      const invalidParams = { ...validParams, response_type: 'token' };

      const result = googleProvider.validateGoogleAuthorizationRequest(invalidParams);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Unsupported response_type');
    });

    it('should reject missing required scopes', () => {
      const invalidParams = { ...validParams, scope: 'calendar' };

      const result = googleProvider.validateGoogleAuthorizationRequest(invalidParams);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing required scopes');
    });
  });

  describe('Account Selection', () => {
    const accounts = [mockGoogleAccount, suspendedGoogleAccount, unverifiedGoogleAccount];

    it('should select account by mock email', () => {
      const account = googleProvider.selectGoogleAccount(accounts, undefined, 'test@example.com');

      expect(account).toBeTruthy();
      expect(account!.email).toBe('test@example.com');
    });

    it('should select account by login hint', () => {
      const account = googleProvider.selectGoogleAccount(accounts, 'suspended@example.com');

      expect(account).toBeTruthy();
      expect(account!.email).toBe('suspended@example.com');
    });

    it('should prioritize mock email over login hint', () => {
      const account = googleProvider.selectGoogleAccount(accounts, 'suspended@example.com', 'test@example.com');

      expect(account).toBeTruthy();
      expect(account!.email).toBe('test@example.com');
    });

    it('should select first active account as fallback', () => {
      const accountsWithoutMockMatch = [suspendedGoogleAccount, mockGoogleAccount];
      const account = googleProvider.selectGoogleAccount(accountsWithoutMockMatch);

      expect(account).toBeTruthy();
      expect(account!.email).toBe('test@example.com');
      expect(account!.status).toBe('active');
    });

    it('should return null for empty accounts list', () => {
      const account = googleProvider.selectGoogleAccount([]);

      expect(account).toBeNull();
    });
  });

  describe('Account Status Validation', () => {
    it('should validate active Google account', () => {
      const result = googleProvider.validateGoogleAccountStatus(mockGoogleAccount);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject suspended account', () => {
      const result = googleProvider.validateGoogleAccountStatus(suspendedGoogleAccount);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Google account is suspended');
      expect(result.errorCode).toBe('account_suspended');
    });

    it('should reject unverified email account', () => {
      const result = googleProvider.validateGoogleAccountStatus(unverifiedGoogleAccount);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Google account email is not verified');
      expect(result.errorCode).toBe('email_not_verified');
    });

    it('should reject non-Google account', () => {
      const nonGoogleAccount = { ...mockGoogleAccount, provider: OAuthProviders.Microsoft };

      const result = googleProvider.validateGoogleAccountStatus(nonGoogleAccount as MockOAuthAccount);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Not a Google account');
      expect(result.errorCode).toBe('invalid_account');
    });
  });

  describe('Scope Parsing', () => {
    it('should parse basic Google scopes', () => {
      const result = googleProvider.parseGoogleScopes('openid email profile');

      expect(result.valid).toBe(true);
      expect(result.scopes).toEqual(['openid', 'email', 'profile']);
      expect(result.normalizedScopes).toContain('openid');
      expect(result.normalizedScopes).toContain('email');
      expect(result.normalizedScopes).toContain('profile');
    });

    it('should parse full Google API scopes', () => {
      const scopeString = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive';
      const result = googleProvider.parseGoogleScopes(scopeString);

      expect(result.valid).toBe(true);
      expect(result.normalizedScopes).toContain('https://www.googleapis.com/auth/calendar');
      expect(result.normalizedScopes).toContain('https://www.googleapis.com/auth/drive');
    });

    it('should normalize common scope names', () => {
      const result = googleProvider.parseGoogleScopes('userinfo.email userinfo.profile');

      expect(result.valid).toBe(true);
      expect(result.normalizedScopes).toContain('https://www.googleapis.com/auth/userinfo.email');
      expect(result.normalizedScopes).toContain('https://www.googleapis.com/auth/userinfo.profile');
    });

    it('should ensure minimum required scopes', () => {
      const result = googleProvider.parseGoogleScopes('calendar');

      expect(result.valid).toBe(true);
      expect(result.normalizedScopes).toContain('https://www.googleapis.com/auth/userinfo.email');
      expect(result.normalizedScopes).toContain('https://www.googleapis.com/auth/userinfo.profile');
    });
  });

  describe('Error Generation', () => {
    it('should generate Google-style error responses', () => {
      const error = googleProvider.generateGoogleErrorResponse('invalid_request');

      expect(error.error).toBe('invalid_request');
      expect(error.error_description).toContain('missing a required parameter');
    });

    it('should use custom error description', () => {
      const customDescription = 'Custom error message';
      const error = googleProvider.generateGoogleErrorResponse('server_error', customDescription);

      expect(error.error).toBe('server_error');
      expect(error.error_description).toBe(customDescription);
    });
  });

  describe('Behavior Simulation', () => {
    it('should not throw for normal email', async () => {
      await expect(googleProvider.simulateGoogleBehavior('normal@example.com')).resolves.toBeUndefined();
    });

    it('should throw for suspended account', async () => {
      await expect(googleProvider.simulateGoogleBehavior('suspended@example.com')).rejects.toThrow(
        'Google account suspended',
      );
    });

    it('should throw for not found account', async () => {
      await expect(googleProvider.simulateGoogleBehavior('notfound@example.com')).rejects.toThrow(
        'Google account not found',
      );
    });

    it('should throw for rate limited account', async () => {
      await expect(googleProvider.simulateGoogleBehavior('ratelimit@example.com')).rejects.toThrow(
        'Rate limit exceeded',
      );
    });

    it('should simulate random errors when enabled', async () => {
      const errorConfig = { ...mockConfig, simulateErrors: true, errorRate: 1.0 };
      const errorProvider = new GoogleMockProvider(errorConfig);

      await expect(errorProvider.simulateGoogleBehavior('test@example.com')).rejects.toThrow();
    });
  });

  describe('Account Capabilities', () => {
    it('should get capabilities for regular account', () => {
      const capabilities = googleProvider.getGoogleAccountCapabilities(mockGoogleAccount);

      expect(capabilities.canSignIn).toBe(true);
      expect(capabilities.canSignUp).toBe(true);
      expect(capabilities.requiresTwoFactor).toBe(false);
      expect(capabilities.supportedScopes).toContain('openid');
      expect(capabilities.supportedScopes).toContain('email');
      expect(capabilities.supportedScopes).toContain('profile');
    });

    it('should restrict capabilities for suspended account', () => {
      const capabilities = googleProvider.getGoogleAccountCapabilities(suspendedGoogleAccount);

      expect(capabilities.canSignIn).toBe(false);
      expect(capabilities.canSignUp).toBe(false);
    });

    it('should add enterprise scopes for company accounts', () => {
      const enterpriseAccount = { ...mockGoogleAccount, email: 'user@company.com' };
      const capabilities = googleProvider.getGoogleAccountCapabilities(enterpriseAccount);

      expect(capabilities.supportedScopes).toContain('https://www.googleapis.com/auth/admin.directory.user.readonly');
      expect(capabilities.supportedScopes).toContain('https://www.googleapis.com/auth/admin.directory.group.readonly');
    });
  });
});
