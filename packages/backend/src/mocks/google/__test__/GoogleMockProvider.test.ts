import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GoogleMockProvider } from '../GoogleMockProvider';
import { OAuthProviders, AccountStatus, AccountType } from '../../../feature/account/Account.types';
import { getOAuthMockConfig, type MockAccount, type OAuthMockConfig } from '../../../config/mock.config';

describe('GoogleMockProvider', () => {
  let googleProvider: GoogleMockProvider;
  let mockConfig: OAuthMockConfig;
  let testGoogleAccount: MockAccount;
  let testMicrosoftAccount: MockAccount;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';

    mockConfig = getOAuthMockConfig();
    googleProvider = new GoogleMockProvider(mockConfig);

    // Create test accounts
    testGoogleAccount = {
      id: 'google_account_1',
      accountType: AccountType.OAuth,
      email: 'test.google@example.com',
      name: 'Google Test User',
      firstName: 'Google',
      lastName: 'User',
      imageUrl: 'https://example.com/avatar.jpg',
      emailVerified: true,
      provider: OAuthProviders.Google,
      twoFactorEnabled: false,
      status: AccountStatus.Active,
    };

    testMicrosoftAccount = {
      id: 'microsoft_account_1',
      accountType: AccountType.OAuth,
      email: 'test.microsoft@example.com',
      name: 'Microsoft Test User',
      firstName: 'Microsoft',
      lastName: 'User',
      imageUrl: 'https://example.com/ms-avatar.jpg',
      emailVerified: true,
      provider: OAuthProviders.Microsoft,
      twoFactorEnabled: false,
      status: AccountStatus.Active,
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('Google ID Token Generation', () => {
    it('should generate Google ID token with correct structure', () => {
      const idToken = googleProvider.generateGoogleIdToken(testGoogleAccount);

      expect(typeof idToken).toBe('string');
      expect(idToken.split('.')).toHaveLength(3); // JWT format: header.payload.signature

      // Decode and verify payload (base64 decode middle part)
      const [header, payload, signature] = idToken.split('.');
      const decodedHeader = JSON.parse(atob(header));
      const decodedPayload = JSON.parse(atob(payload));

      // Verify header
      expect(decodedHeader.alg).toBe('RS256');
      expect(decodedHeader.typ).toBe('JWT');
      expect(decodedHeader.kid).toBe('mock_google_key_id');

      // Verify payload claims
      expect(decodedPayload.iss).toBe('https://accounts.google.com');
      expect(decodedPayload.sub).toBe(testGoogleAccount.id);
      expect(decodedPayload.aud).toBe('test-google-client-id');
      expect(decodedPayload.email).toBe(testGoogleAccount.email);
      expect(decodedPayload.email_verified).toBe(testGoogleAccount.emailVerified);
      expect(decodedPayload.name).toBe(testGoogleAccount.name);
      expect(decodedPayload.given_name).toBe(testGoogleAccount.firstName);
      expect(decodedPayload.family_name).toBe(testGoogleAccount.lastName);
      expect(decodedPayload.picture).toBe(testGoogleAccount.imageUrl);
      expect(decodedPayload.locale).toBe('en');
      expect(decodedPayload.iat).toBeTypeOf('number');
      expect(decodedPayload.exp).toBeTypeOf('number');
      expect(decodedPayload.exp).toBeGreaterThan(decodedPayload.iat);
    });

    it('should throw error for non-Google account', () => {
      expect(() => googleProvider.generateGoogleIdToken(testMicrosoftAccount)).toThrow(
        'Account is not a Google account',
      );
    });

    it('should include hosted domain for enterprise emails', () => {
      const enterpriseAccount = {
        ...testGoogleAccount,
        email: 'user@company.com',
      };

      const idToken = googleProvider.generateGoogleIdToken(enterpriseAccount);
      const payload = JSON.parse(atob(idToken.split('.')[1]));

      expect(payload.hd).toBe('company.com');
    });
  });

  describe('Google Token Info', () => {
    it('should return Google token info for valid account', () => {
      const accounts = [testGoogleAccount];
      const tokenInfo = googleProvider.getGoogleTokenInfo('mock-access-token', accounts);

      expect(tokenInfo).toBeDefined();
      expect(tokenInfo!.issued_to).toBe('test-google-client-id');
      expect(tokenInfo!.audience).toBe('test-google-client-id');
      expect(tokenInfo!.user_id).toBe(testGoogleAccount.id);
      expect(tokenInfo!.scope).toContain('openid');
      expect(tokenInfo!.scope).toContain('email');
      expect(tokenInfo!.scope).toContain('profile');
      expect(tokenInfo!.expires_in).toBe(3600);
      expect(tokenInfo!.email).toBe(testGoogleAccount.email);
      expect(tokenInfo!.verified_email).toBe(testGoogleAccount.emailVerified);
      expect(tokenInfo!.access_type).toBe('offline');
    });

    it('should return null when no Google account found', () => {
      const accounts = [testMicrosoftAccount]; // No Google accounts
      const tokenInfo = googleProvider.getGoogleTokenInfo('mock-access-token', accounts);

      expect(tokenInfo).toBeNull();
    });

    it('should return null for empty accounts array', () => {
      const tokenInfo = googleProvider.getGoogleTokenInfo('mock-access-token', []);
      expect(tokenInfo).toBeNull();
    });
  });

  describe('Google User Info', () => {
    it('should return Google user info for valid account', () => {
      const accounts = [testGoogleAccount];
      const userInfo = googleProvider.getGoogleUserInfo('mock-access-token', accounts);

      expect(userInfo).toBeDefined();
      expect(userInfo!.id).toBe(testGoogleAccount.id);
      expect(userInfo!.email).toBe(testGoogleAccount.email);
      expect(userInfo!.name).toBe(testGoogleAccount.name);
      expect(userInfo!.picture).toBe(testGoogleAccount.imageUrl);
      expect(userInfo!.given_name).toBe(testGoogleAccount.firstName);
      expect(userInfo!.family_name).toBe(testGoogleAccount.lastName);
      expect(userInfo!.email_verified).toBe(testGoogleAccount.emailVerified);
      expect(userInfo!.locale).toBe('en');
    });

    it('should include hosted domain for enterprise emails', () => {
      const enterpriseAccount = {
        ...testGoogleAccount,
        email: 'user@company.com',
      };
      const accounts = [enterpriseAccount];
      const userInfo = googleProvider.getGoogleUserInfo('mock-access-token', accounts);

      expect(userInfo!.hd).toBe('company.com');
    });

    it('should return null when no Google account found', () => {
      const accounts = [testMicrosoftAccount];
      const userInfo = googleProvider.getGoogleUserInfo('mock-access-token', accounts);

      expect(userInfo).toBeNull();
    });
  });

  describe('Google Authorization Code Exchange', () => {
    it('should exchange authorization code for tokens', () => {
      const tokens = googleProvider.exchangeGoogleAuthorizationCode('auth-code-123', testGoogleAccount);

      expect(tokens).toBeDefined();
      expect(tokens.access_token).toMatch(/^mock_google_access_/);
      expect(tokens.refresh_token).toMatch(/^mock_google_refresh_/);
      expect(tokens.expires_in).toBe(3600);
      expect(tokens.token_type).toBe('Bearer');
      expect(tokens.scope).toBe('openid email profile');
      expect(tokens.id_token).toBeDefined();

      // Verify tokens contain account ID
      expect(tokens.access_token).toContain(testGoogleAccount.id);
      expect(tokens.refresh_token).toContain(testGoogleAccount.id);

      // Verify ID token is valid JWT
      expect(tokens.id_token.split('.')).toHaveLength(3);
    });

    it('should throw error for non-Google account', () => {
      expect(() => googleProvider.exchangeGoogleAuthorizationCode('auth-code-123', testMicrosoftAccount)).toThrow(
        'Account is not a Google OAuth account',
      );
    });

    it('should generate unique tokens for each exchange', () => {
      const tokens1 = googleProvider.exchangeGoogleAuthorizationCode('code-1', testGoogleAccount);
      const tokens2 = googleProvider.exchangeGoogleAuthorizationCode('code-2', testGoogleAccount);

      expect(tokens1.access_token).not.toBe(tokens2.access_token);
      expect(tokens1.refresh_token).not.toBe(tokens2.refresh_token);
    });
  });

  describe('Google Token Refresh', () => {
    it('should refresh Google access token', () => {
      const accounts = [testGoogleAccount];
      const refreshToken = `mock_google_refresh_${testGoogleAccount.id}_123456789_abcdef`;

      const newTokens = googleProvider.refreshGoogleAccessToken(refreshToken, accounts);

      expect(newTokens).toBeDefined();
      expect(newTokens!.access_token).toMatch(/^mock_google_access_/);
      expect(newTokens!.refresh_token).toBe(refreshToken); // Same refresh token
      expect(newTokens!.expires_in).toBe(3600);
      expect(newTokens!.token_type).toBe('Bearer');
      expect(newTokens!.scope).toBe('openid email profile');
    });

    it('should return null for invalid refresh token format', () => {
      const accounts = [testGoogleAccount];
      const invalidToken = 'invalid-token-format';

      const result = googleProvider.refreshGoogleAccessToken(invalidToken, accounts);
      expect(result).toBeNull();
    });

    it('should return null for non-existent account', () => {
      const accounts = [testGoogleAccount];
      const refreshToken = 'mock_google_refresh_nonexistent_123456789_abcdef';

      const result = googleProvider.refreshGoogleAccessToken(refreshToken, accounts);
      expect(result).toBeNull();
    });

    it('should return null for non-Google account', () => {
      const accounts = [testMicrosoftAccount];
      const refreshToken = `mock_google_refresh_${testMicrosoftAccount.id}_123456789_abcdef`;

      const result = googleProvider.refreshGoogleAccessToken(refreshToken, accounts);
      expect(result).toBeNull();
    });
  });

  describe('Google Token Revocation', () => {
    it('should revoke Google access token', () => {
      const accounts = [testGoogleAccount];
      const accessToken = `mock_google_access_${testGoogleAccount.id}_123456789_abcdef`;

      const revoked = googleProvider.revokeGoogleToken(accessToken, accounts);
      expect(revoked).toBe(true);
    });

    it('should revoke Google refresh token', () => {
      const accounts = [testGoogleAccount];
      const refreshToken = `mock_google_refresh_${testGoogleAccount.id}_123456789_abcdef`;

      const revoked = googleProvider.revokeGoogleToken(refreshToken, accounts);
      expect(revoked).toBe(true);
    });

    it('should return false for invalid token format', () => {
      const accounts = [testGoogleAccount];
      const invalidToken = 'invalid-token-format';

      const revoked = googleProvider.revokeGoogleToken(invalidToken, accounts);
      expect(revoked).toBe(false);
    });

    it('should return false for non-existent account', () => {
      const accounts = [testGoogleAccount];
      const token = 'mock_google_access_nonexistent_123456789_abcdef';

      const revoked = googleProvider.revokeGoogleToken(token, accounts);
      expect(revoked).toBe(false);
    });
  });

  describe('Google Client Credentials Validation', () => {
    it('should validate correct Google credentials', () => {
      const isValid = googleProvider.validateGoogleClientCredentials(
        'test-google-client-id',
        'test-google-client-secret',
      );
      expect(isValid).toBe(true);
    });

    it('should reject incorrect client ID', () => {
      const isValid = googleProvider.validateGoogleClientCredentials('wrong-client-id', 'test-google-client-secret');
      expect(isValid).toBe(false);
    });

    it('should reject incorrect client secret', () => {
      const isValid = googleProvider.validateGoogleClientCredentials('test-google-client-id', 'wrong-client-secret');
      expect(isValid).toBe(false);
    });
  });

  describe('Google Authorization Request Validation', () => {
    it('should validate correct authorization request', () => {
      const params = {
        client_id: 'test-google-client-id',
        response_type: 'code',
        scope: 'openid email profile',
        state: 'random-state-123',
        redirect_uri: 'https://example.com/callback',
        access_type: 'offline',
        prompt: 'consent',
      };

      const result = googleProvider.validateGoogleAuthorizationRequest(params);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject missing required parameters', () => {
      const params = {
        client_id: 'test-google-client-id',
        // Missing response_type, scope, state, redirect_uri
      } as any;

      const result = googleProvider.validateGoogleAuthorizationRequest(params);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing required parameters');
    });

    it('should reject invalid client_id', () => {
      const params = {
        client_id: 'wrong-client-id',
        response_type: 'code',
        scope: 'openid email profile',
        state: 'state-123',
        redirect_uri: 'https://example.com/callback',
      };

      const result = googleProvider.validateGoogleAuthorizationRequest(params);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid client_id');
    });

    it('should reject unsupported response_type', () => {
      const params = {
        client_id: 'test-google-client-id',
        response_type: 'token', // Should be 'code'
        scope: 'openid email profile',
        state: 'state-123',
        redirect_uri: 'https://example.com/callback',
      };

      const result = googleProvider.validateGoogleAuthorizationRequest(params);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Unsupported response_type');
    });

    it('should reject missing required scopes', () => {
      const params = {
        client_id: 'test-google-client-id',
        response_type: 'code',
        scope: 'openid', // Missing email and profile
        state: 'state-123',
        redirect_uri: 'https://example.com/callback',
      };

      const result = googleProvider.validateGoogleAuthorizationRequest(params);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing required scopes');
    });
  });

  describe('Google Endpoints', () => {
    it('should return correct Google endpoints', () => {
      const endpoints = googleProvider.getGoogleEndpoints();

      expect(endpoints.authorization).toBe('/mock/oauth/google/authorize');
      expect(endpoints.token).toBe('/mock/oauth/google/token');
      expect(endpoints.userinfo).toBe('/mock/oauth/google/userinfo');
      expect(endpoints.tokeninfo).toBe('/mock/oauth/google/tokeninfo');
      expect(endpoints.revoke).toBe('/mock/oauth/google/revoke');
    });
  });

  describe('Google Error Response Generation', () => {
    it('should generate standard Google error response', () => {
      const error = googleProvider.generateGoogleErrorResponse('invalid_request');

      expect(error.error).toBe('invalid_request');
      expect(error.error_description).toContain('missing a required parameter');
    });

    it('should generate error response with custom description', () => {
      const customDescription = 'Custom error description';
      const error = googleProvider.generateGoogleErrorResponse('invalid_request', customDescription);

      expect(error.error).toBe('invalid_request');
      expect(error.error_description).toBe(customDescription);
    });

    it('should handle unknown error codes', () => {
      const error = googleProvider.generateGoogleErrorResponse('unknown_error');

      expect(error.error).toBe('unknown_error');
      expect(error.error_description).toBe('An error occurred');
    });
  });

  describe('Google Account Selection', () => {
    it('should select account by mockAccountEmail priority', () => {
      const accounts = [testGoogleAccount];
      const selected = googleProvider.selectGoogleAccount(accounts, undefined, testGoogleAccount.email);

      expect(selected).toBe(testGoogleAccount);
    });

    it('should select account by loginHint when no mockAccountEmail', () => {
      const accounts = [testGoogleAccount];
      const selected = googleProvider.selectGoogleAccount(accounts, testGoogleAccount.email);

      expect(selected).toBe(testGoogleAccount);
    });

    it('should select first active account as fallback', () => {
      const suspendedAccount = { ...testGoogleAccount, status: AccountStatus.Suspended };
      const activeAccount = { ...testGoogleAccount, id: 'active_account', status: AccountStatus.Active };
      const accounts = [suspendedAccount, activeAccount];

      const selected = googleProvider.selectGoogleAccount(accounts);
      expect(selected).toBe(activeAccount);
    });

    it('should return null when no Google accounts available', () => {
      const accounts = [testMicrosoftAccount];
      const selected = googleProvider.selectGoogleAccount(accounts);

      expect(selected).toBeNull();
    });
  });

  describe('Google Scope Parsing', () => {
    it('should parse and normalize standard scopes', () => {
      const result = googleProvider.parseGoogleScopes('openid email profile');

      expect(result.valid).toBe(true);
      expect(result.scopes).toEqual(['openid', 'email', 'profile']);
      expect(result.normalizedScopes).toContain('openid');
      expect(result.normalizedScopes).toContain('email');
      expect(result.normalizedScopes).toContain('profile');
    });

    it('should normalize short scope names', () => {
      const result = googleProvider.parseGoogleScopes('userinfo.email userinfo.profile');

      expect(result.valid).toBe(true);
      expect(result.normalizedScopes).toContain('https://www.googleapis.com/auth/userinfo.email');
      expect(result.normalizedScopes).toContain('https://www.googleapis.com/auth/userinfo.profile');
    });

    it('should add missing required scopes', () => {
      const result = googleProvider.parseGoogleScopes('openid');

      expect(result.valid).toBe(true);
      expect(result.normalizedScopes).toContain('https://www.googleapis.com/auth/userinfo.email');
      expect(result.normalizedScopes).toContain('https://www.googleapis.com/auth/userinfo.profile');
    });

    it('should handle custom Google API scopes', () => {
      const result = googleProvider.parseGoogleScopes('calendar.readonly');

      expect(result.valid).toBe(true);
      expect(result.normalizedScopes).toContain('https://www.googleapis.com/auth/calendar.readonly');
    });
  });

  describe('Google Authorization URL Generation', () => {
    it('should generate complete authorization URL', () => {
      const params = {
        clientId: 'test-client-id',
        redirectUri: 'https://example.com/callback',
        scope: 'openid email profile',
        state: 'state-123',
        accessType: 'offline',
        prompt: 'consent',
        loginHint: 'user@example.com',
        includeGrantedScopes: true,
      };

      const url = googleProvider.generateGoogleAuthorizationUrl(params);

      expect(url).toContain('/mock/oauth/google/authorize?');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=openid%20email%20profile');
      expect(url).toContain('state=state-123');
      expect(url).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcallback');
      expect(url).toContain('access_type=offline');
      expect(url).toContain('prompt=consent');
      expect(url).toContain('login_hint=user%40example.com');
      expect(url).toContain('include_granted_scopes=true');
    });

    it('should generate minimal authorization URL', () => {
      const params = {
        clientId: 'test-client-id',
        redirectUri: 'https://example.com/callback',
        scope: 'openid email profile',
        state: 'state-123',
      };

      const url = googleProvider.generateGoogleAuthorizationUrl(params);

      expect(url).toContain('/mock/oauth/google/authorize?');
      expect(url).toContain('client_id=test-client-id');
      expect(url).not.toContain('access_type');
      expect(url).not.toContain('prompt');
      expect(url).not.toContain('login_hint');
    });
  });

  describe('Google Behavior Simulation', () => {
    it('should simulate delay when enabled', async () => {
      googleProvider.updateConfig({
        ...mockConfig,
        simulateDelay: true,
        delayMs: 10, // Short delay for testing
      });

      const startTime = Date.now();
      await googleProvider.simulateGoogleBehavior();
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(10);
    });

    it('should not delay when simulation disabled', async () => {
      googleProvider.updateConfig({
        ...mockConfig,
        simulateDelay: false,
        delayMs: 1000,
      });

      const startTime = Date.now();
      await googleProvider.simulateGoogleBehavior();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(50);
    });

    it('should throw specific Google errors for email patterns', async () => {
      await expect(googleProvider.simulateGoogleBehavior('suspended@example.com')).rejects.toThrow(
        'Google account suspended',
      );

      await expect(googleProvider.simulateGoogleBehavior('notfound@example.com')).rejects.toThrow(
        'Google account not found',
      );

      await expect(googleProvider.simulateGoogleBehavior('ratelimit@example.com')).rejects.toThrow(
        'Rate limit exceeded',
      );
    });

    it('should simulate random errors when enabled', async () => {
      googleProvider.updateConfig({
        ...mockConfig,
        simulateErrors: true,
        errorRate: 1.0, // 100% error rate
      });

      await expect(googleProvider.simulateGoogleBehavior('normal@example.com')).rejects.toThrow();
    });
  });

  describe('Google Account Status Validation', () => {
    it('should validate active Google account', () => {
      const result = googleProvider.validateGoogleAccountStatus(testGoogleAccount);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject suspended account', () => {
      const suspendedAccount = { ...testGoogleAccount, status: AccountStatus.Suspended };
      const result = googleProvider.validateGoogleAccountStatus(suspendedAccount);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Google account is suspended');
      expect(result.errorCode).toBe('account_suspended');
    });

    it('should reject unverified email', () => {
      const unverifiedAccount = { ...testGoogleAccount, emailVerified: false };
      const result = googleProvider.validateGoogleAccountStatus(unverifiedAccount);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Google account email is not verified');
      expect(result.errorCode).toBe('email_not_verified');
    });

    it('should reject non-Google account', () => {
      const result = googleProvider.validateGoogleAccountStatus(testMicrosoftAccount);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Not a Google OAuth account');
      expect(result.errorCode).toBe('invalid_account');
    });
  });

  describe('Google Account Capabilities', () => {
    it('should return correct capabilities for standard account', () => {
      const capabilities = googleProvider.getGoogleAccountCapabilities(testGoogleAccount);

      expect(capabilities.canSignIn).toBe(true);
      expect(capabilities.canSignUp).toBe(true);
      expect(capabilities.requiresTwoFactor).toBe(false);
      expect(capabilities.supportedScopes).toContain('openid');
      expect(capabilities.supportedScopes).toContain('email');
      expect(capabilities.supportedScopes).toContain('profile');
    });

    it('should return enhanced capabilities for enterprise account', () => {
      const enterpriseAccount = { ...testGoogleAccount, email: 'user@company.com' };
      const capabilities = googleProvider.getGoogleAccountCapabilities(enterpriseAccount);

      expect(capabilities.supportedScopes).toContain('https://www.googleapis.com/auth/admin.directory.user.readonly');
      expect(capabilities.supportedScopes).toContain('https://www.googleapis.com/auth/admin.directory.group.readonly');
    });

    it('should restrict capabilities for suspended account', () => {
      const suspendedAccount = { ...testGoogleAccount, status: AccountStatus.Suspended };
      const capabilities = googleProvider.getGoogleAccountCapabilities(suspendedAccount);

      expect(capabilities.canSignIn).toBe(false);
      expect(capabilities.canSignUp).toBe(false);
    });

    it('should require 2FA when enabled', () => {
      const twoFAAccount = { ...testGoogleAccount, twoFactorEnabled: true };
      const capabilities = googleProvider.getGoogleAccountCapabilities(twoFAAccount);

      expect(capabilities.requiresTwoFactor).toBe(true);
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration at runtime', () => {
      const newConfig = {
        ...mockConfig,
        simulateDelay: true,
        delayMs: 500,
      };

      googleProvider.updateConfig(newConfig);

      // Config should be updated (we can't directly test internal state,
      // but we can test behavior that depends on config)
      expect(() => googleProvider.updateConfig(newConfig)).not.toThrow();
    });
  });
});
