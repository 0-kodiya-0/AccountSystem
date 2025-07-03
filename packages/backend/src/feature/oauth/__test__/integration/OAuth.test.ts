import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { startMainServer, stopMainServer } from '../../../../app';
import { clearDatabase, seedTestDatabase, closeAllConnections, connectAuthDB } from '../../../../config/db.config';
import { OAuthProviders } from '../../../account/Account.types';
import { oauthMockService } from '../../../../mocks/oauth/OAuthMockService';
import { emailMock } from '../../../../mocks/email/EmailServiceMock';
import { getAccountsMockConfig } from '../../../../config/mock.config';
import express from 'express';

// Test configuration
const TEST_CALLBACK_URL = 'http://localhost:7000/auth/callback';

// Get test accounts from mock configuration
const mockAccounts = getAccountsMockConfig().accounts;
const TEST_ACCOUNTS = {
  // OAuth Google accounts from mock config
  GOOGLE_USER: mockAccounts.find((acc) => acc.email === 'test.user@example.com' && acc.provider === 'google'),
  GOOGLE_ADMIN: mockAccounts.find((acc) => acc.email === 'admin@example.com' && acc.provider === 'google'),
  GOOGLE_JOHN: mockAccounts.find((acc) => acc.email === 'john.doe@company.com' && acc.provider === 'google'),
  GOOGLE_JANE: mockAccounts.find((acc) => acc.email === 'jane.smith@company.com' && acc.provider === 'google'),
  SUSPENDED_USER: mockAccounts.find((acc) => acc.email === 'suspended@example.com' && acc.provider === 'google'),
  DEVELOPER_USER: mockAccounts.find((acc) => acc.email === 'developer@example.com' && acc.provider === 'google'),

  // For testing signup (account that doesn't exist in seeded data)
  NEW_USER: {
    email: 'newuser@example.com',
    name: 'New User',
    firstName: 'New',
    lastName: 'User',
    provider: OAuthProviders.Google,
  },
};

describe('OAuth Integration Tests with Supertest', () => {
  let app: Express;

  beforeAll(async () => {
    // Set environment for testing
    process.env.NODE_ENV = 'test';
    process.env.MOCK_ENABLED = 'true';
    process.env.USE_MEMORY_DB = 'true';
    process.env.TEST_DB_CLEAR_ON_START = 'true';
    process.env.TEST_DB_SEED_ON_START = 'true';
    process.env.PORT = '0'; // Use random port to avoid conflicts

    // Start the server and get app instance
    await startMainServer();

    // Create Express app for supertest
    app = express();

    // Connect to test database
    await connectAuthDB();
    await clearDatabase();
    await seedTestDatabase();

    // Verify test accounts are available
    expect(TEST_ACCOUNTS.GOOGLE_USER).toBeDefined();
    expect(TEST_ACCOUNTS.GOOGLE_ADMIN).toBeDefined();
    expect(TEST_ACCOUNTS.SUSPENDED_USER).toBeDefined();
  });

  afterAll(async () => {
    await stopMainServer();
    await closeAllConnections();
  });

  beforeEach(async () => {
    // Clear mock service caches before each test to prevent test interference
    oauthMockService.clearCaches();
    emailMock.clearSentEmails();
  });

  describe('OAuth Signup Flow', () => {
    it('should generate a valid OAuth signup URL', async () => {
      const response = await request(app)
        .get('/oauth/signup/google')
        .query({ callbackUrl: TEST_CALLBACK_URL })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('authorizationUrl');
      expect(response.body.data).toHaveProperty('state');
      expect(response.body.data.provider).toBe(OAuthProviders.Google);
      expect(response.body.data.authType).toBe('signup');
      expect(response.body.data.callbackUrl).toBe(TEST_CALLBACK_URL);
      expect(response.body.data.authorizationUrl).toContain('/mock/oauth/google/authorize');
    });

    it('should successfully complete OAuth signup for new user', async () => {
      // Step 1: Generate signup URL
      const signupResponse = await request(app)
        .get('/oauth/signup/google')
        .query({ callbackUrl: TEST_CALLBACK_URL })
        .expect(200);

      const { state } = signupResponse.body.data;

      // Step 2: Simulate OAuth authorization (mock will generate auth code)
      const authCode = oauthMockService.generateAuthorizationCode(state, TEST_ACCOUNTS.NEW_USER, OAuthProviders.Google);

      // Step 3: Complete OAuth callback
      const callbackResponse = await request(app)
        .get('/oauth/callback/google')
        .query({ code: authCode, state })
        .expect(302); // Redirect response

      expect(callbackResponse.headers.location).toContain(TEST_CALLBACK_URL);
      expect(callbackResponse.headers.location).toContain('code=oauth_signup_success');
      expect(callbackResponse.headers.location).toContain('provider=google');
    });

    it('should reject OAuth signup for existing user', async () => {
      // Step 1: Generate signup URL
      const signupResponse = await request(app)
        .get('/oauth/signup/google')
        .query({ callbackUrl: TEST_CALLBACK_URL })
        .expect(200);

      const { state } = signupResponse.body.data;

      // Step 2: Try to sign up with existing user (from seeded data)
      const authCode = oauthMockService.generateAuthorizationCode(
        state,
        TEST_ACCOUNTS.GOOGLE_USER,
        OAuthProviders.Google,
      );

      // Step 3: Complete OAuth callback
      const callbackResponse = await request(app)
        .get('/oauth/callback/google')
        .query({ code: authCode, state })
        .expect(302);

      expect(callbackResponse.headers.location).toContain(TEST_CALLBACK_URL);
      expect(callbackResponse.headers.location).toContain('code=oauth_error');
      expect(callbackResponse.headers.location).toContain('error=User%20already%20exists');
    });

    it('should reject signup with missing callback URL', async () => {
      await request(app)
        .get('/oauth/signup/google')
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.message).toContain('callbackUrl query parameter is required');
        });
    });

    it('should reject signup with invalid callback URL', async () => {
      await request(app)
        .get('/oauth/signup/google')
        .query({ callbackUrl: 'not-a-url' })
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.message).toContain('Invalid Callback URL format');
        });
    });
  });

  describe('OAuth Signin Flow', () => {
    it('should generate a valid OAuth signin URL', async () => {
      const response = await request(app)
        .get('/oauth/signin/google')
        .query({ callbackUrl: TEST_CALLBACK_URL })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('authorizationUrl');
      expect(response.body.data).toHaveProperty('state');
      expect(response.body.data.provider).toBe(OAuthProviders.Google);
      expect(response.body.data.authType).toBe('signin');
      expect(response.body.data.callbackUrl).toBe(TEST_CALLBACK_URL);
      expect(response.body.data.authorizationUrl).toContain('/mock/oauth/google/authorize');
    });

    it('should successfully complete OAuth signin for existing user without 2FA', async () => {
      // Step 1: Generate signin URL
      const signinResponse = await request(app)
        .get('/oauth/signin/google')
        .query({ callbackUrl: TEST_CALLBACK_URL })
        .expect(200);

      const { state } = signinResponse.body.data;

      // Step 2: Simulate OAuth authorization with existing user (no 2FA)
      const authCode = oauthMockService.generateAuthorizationCode(
        state,
        TEST_ACCOUNTS.GOOGLE_USER, // This user has twoFactorEnabled: false
        OAuthProviders.Google,
      );

      // Step 3: Complete OAuth callback
      const callbackResponse = await request(app)
        .get('/oauth/callback/google')
        .query({ code: authCode, state })
        .expect(302);

      expect(callbackResponse.headers.location).toContain(TEST_CALLBACK_URL);
      expect(callbackResponse.headers.location).toContain('code=oauth_signin_success');
      expect(callbackResponse.headers.location).toContain('provider=google');
    });

    it('should require 2FA for existing user with 2FA enabled', async () => {
      // Step 1: Generate signin URL
      const signinResponse = await request(app)
        .get('/oauth/signin/google')
        .query({ callbackUrl: TEST_CALLBACK_URL })
        .expect(200);

      const { state } = signinResponse.body.data;

      // Step 2: Simulate OAuth authorization with 2FA-enabled user
      const authCode = oauthMockService.generateAuthorizationCode(
        state,
        TEST_ACCOUNTS.GOOGLE_ADMIN, // This user has twoFactorEnabled: true
        OAuthProviders.Google,
      );

      // Step 3: Complete OAuth callback
      const callbackResponse = await request(app)
        .get('/oauth/callback/google')
        .query({ code: authCode, state })
        .expect(302);

      expect(callbackResponse.headers.location).toContain(TEST_CALLBACK_URL);
      expect(callbackResponse.headers.location).toContain('code=oauth_signin_requires_2fa');
      expect(callbackResponse.headers.location).toContain('tempToken=');
      expect(callbackResponse.headers.location).toContain('requiresTwoFactor=true');
    });

    it('should reject OAuth signin for non-existent user', async () => {
      // Step 1: Generate signin URL
      const signinResponse = await request(app)
        .get('/oauth/signin/google')
        .query({ callbackUrl: TEST_CALLBACK_URL })
        .expect(200);

      const { state } = signinResponse.body.data;

      // Step 2: Try to sign in with non-existent user
      const authCode = oauthMockService.generateAuthorizationCode(
        state,
        TEST_ACCOUNTS.NEW_USER, // This user doesn't exist in seeded data
        OAuthProviders.Google,
      );

      // Step 3: Complete OAuth callback
      const callbackResponse = await request(app)
        .get('/oauth/callback/google')
        .query({ code: authCode, state })
        .expect(302);

      expect(callbackResponse.headers.location).toContain(TEST_CALLBACK_URL);
      expect(callbackResponse.headers.location).toContain('code=oauth_error');
      expect(callbackResponse.headers.location).toContain('error=User%20not%20found');
    });

    it('should reject OAuth signin for suspended user', async () => {
      // Step 1: Generate signin URL
      const signinResponse = await request(app)
        .get('/oauth/signin/google')
        .query({ callbackUrl: TEST_CALLBACK_URL })
        .expect(200);

      const { state } = signinResponse.body.data;

      // Step 2: Try to sign in with suspended user
      const authCode = oauthMockService.generateAuthorizationCode(
        state,
        TEST_ACCOUNTS.SUSPENDED_USER, // This user has status: 'suspended'
        OAuthProviders.Google,
      );

      // Step 3: Complete OAuth callback - should fail in validation
      const callbackResponse = await request(app)
        .get('/oauth/callback/google')
        .query({ code: authCode, state })
        .expect(302);

      expect(callbackResponse.headers.location).toContain(TEST_CALLBACK_URL);
      expect(callbackResponse.headers.location).toContain('code=oauth_error');
    });

    it('should reject signin with missing callback URL', async () => {
      await request(app)
        .get('/oauth/signin/google')
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.message).toContain('callbackUrl query parameter is required');
        });
    });
  });

  describe('OAuth Permission Flow', () => {
    it('should generate a valid OAuth permission URL', async () => {
      const accountId = '507f1f77bcf86cd799439011'; // Valid ObjectId format
      const scopeNames = JSON.stringify(['drive.readonly', 'calendar.readonly']);

      const response = await request(app)
        .get('/oauth/permission/google')
        .query({
          accountId,
          callbackUrl: TEST_CALLBACK_URL,
          scopeNames,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('authorizationUrl');
      expect(response.body.data).toHaveProperty('state');
      expect(response.body.data).toHaveProperty('scopes');
      expect(response.body.data.accountId).toBe(accountId);
      expect(response.body.data.callbackUrl).toBe(TEST_CALLBACK_URL);
      expect(response.body.data.authorizationUrl).toContain('/mock/oauth/google/authorize');
    });

    it('should reject permission request for invalid account ID', async () => {
      const invalidAccountId = 'invalid-id';
      const scopeNames = JSON.stringify(['drive.readonly']);

      await request(app)
        .get('/oauth/permission/google')
        .query({
          accountId: invalidAccountId,
          callbackUrl: TEST_CALLBACK_URL,
          scopeNames,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.message).toContain('Invalid Account ID format');
        });
    });

    it('should reject permission request with invalid scope names', async () => {
      const accountId = '507f1f77bcf86cd799439011';
      const scopeNames = 'invalid-json';

      await request(app)
        .get('/oauth/permission/google')
        .query({
          accountId,
          callbackUrl: TEST_CALLBACK_URL,
          scopeNames,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.message).toContain('Invalid scope name format');
        });
    });

    it('should reject permission request with missing required parameters', async () => {
      // Missing accountId
      await request(app)
        .get('/oauth/permission/google')
        .query({
          callbackUrl: TEST_CALLBACK_URL,
          scopeNames: JSON.stringify(['drive.readonly']),
        })
        .expect(400);

      // Missing callbackUrl
      await request(app)
        .get('/oauth/permission/google')
        .query({
          accountId: '507f1f77bcf86cd799439011',
          scopeNames: JSON.stringify(['drive.readonly']),
        })
        .expect(400);

      // Missing scopeNames
      await request(app)
        .get('/oauth/permission/google')
        .query({
          accountId: '507f1f77bcf86cd799439011',
          callbackUrl: TEST_CALLBACK_URL,
        })
        .expect(400);
    });

    it('should successfully complete permission callback', async () => {
      // Step 1: Generate permission URL
      const accountId = '507f1f77bcf86cd799439011';
      const scopeNames = JSON.stringify(['drive.readonly']);

      const permissionResponse = await request(app)
        .get('/oauth/permission/google')
        .query({
          accountId,
          callbackUrl: TEST_CALLBACK_URL,
          scopeNames,
        })
        .expect(200);

      const { state } = permissionResponse.body.data;

      // Step 2: Simulate OAuth authorization
      const authCode = oauthMockService.generateAuthorizationCode(
        state,
        TEST_ACCOUNTS.GOOGLE_USER,
        OAuthProviders.Google,
      );

      // Step 3: Complete permission callback
      const callbackResponse = await request(app)
        .get('/oauth/permission/callback/google')
        .query({ code: authCode, state })
        .expect(302);

      expect(callbackResponse.headers.location).toContain(TEST_CALLBACK_URL);
      expect(callbackResponse.headers.location).toContain('code=oauth_permission_success');
    });
  });

  describe('OAuth Reauthorization Flow', () => {
    it('should generate a valid OAuth reauthorization URL when account has stored scopes', async () => {
      const accountId = '507f1f77bcf86cd799439011';

      const response = await request(app)
        .get('/oauth/reauthorize/google')
        .query({
          accountId,
          callbackUrl: TEST_CALLBACK_URL,
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Response might have authorizationUrl if scopes exist, or null if no additional scopes needed
      if (response.body.data.authorizationUrl) {
        expect(response.body.data).toHaveProperty('authorizationUrl');
        expect(response.body.data).toHaveProperty('state');
        expect(response.body.data).toHaveProperty('scopes');
        expect(response.body.data.authorizationUrl).toContain('/mock/oauth/google/authorize');
      } else {
        expect(response.body.data.authorizationUrl).toBeNull();
        expect(response.body.data.message).toContain('No additional scopes needed');
      }
    });

    it('should reject reauthorization request for invalid account ID', async () => {
      const invalidAccountId = 'invalid-id';

      await request(app)
        .get('/oauth/reauthorize/google')
        .query({
          accountId: invalidAccountId,
          callbackUrl: TEST_CALLBACK_URL,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.message).toContain('Invalid Account ID format');
        });
    });

    it('should reject reauthorization request with missing parameters', async () => {
      // Missing accountId
      await request(app).get('/oauth/reauthorize/google').query({ callbackUrl: TEST_CALLBACK_URL }).expect(400);

      // Missing callbackUrl
      await request(app).get('/oauth/reauthorize/google').query({ accountId: '507f1f77bcf86cd799439011' }).expect(400);
    });
  });

  describe('OAuth Error Handling', () => {
    it('should handle invalid provider', async () => {
      await request(app)
        .get('/oauth/signup/invalid-provider')
        .query({ callbackUrl: TEST_CALLBACK_URL })
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.message).toContain('Invalid OAuth provider');
        });
    });

    it('should handle invalid state parameter in callback', async () => {
      const response = await request(app)
        .get('/oauth/callback/google')
        .query({ code: 'test-code', state: 'invalid-state' })
        .expect(302);

      expect(response.headers.location).toContain('code=oauth_error');
      expect(response.headers.location).toContain('error=Invalid%20or%20expired%20state%20parameter');
    });

    it('should handle missing authorization code in callback', async () => {
      const response = await request(app).get('/oauth/callback/google').query({ state: 'test-state' }).expect(302);

      expect(response.headers.location).toContain('code=oauth_error');
    });

    it('should handle missing state parameter in callback', async () => {
      const response = await request(app).get('/oauth/callback/google').query({ code: 'test-code' }).expect(302);

      expect(response.headers.location).toContain('code=oauth_error');
    });

    it('should handle expired authorization code', async () => {
      const response = await request(app)
        .get('/oauth/callback/google')
        .query({ code: 'expired-code', state: 'valid-state' })
        .expect(302);

      expect(response.headers.location).toContain('code=oauth_error');
    });
  });

  describe('OAuth State Management', () => {
    it('should generate unique states for multiple requests', async () => {
      const response1 = await request(app)
        .get('/oauth/signup/google')
        .query({ callbackUrl: TEST_CALLBACK_URL })
        .expect(200);

      const response2 = await request(app)
        .get('/oauth/signup/google')
        .query({ callbackUrl: TEST_CALLBACK_URL })
        .expect(200);

      expect(response1.body.data.state).not.toBe(response2.body.data.state);
      expect(response1.body.data.state).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(response2.body.data.state).toHaveLength(64);
    });

    it('should handle state parameter validation correctly', async () => {
      // Generate valid state
      const signupResponse = await request(app)
        .get('/oauth/signup/google')
        .query({ callbackUrl: TEST_CALLBACK_URL })
        .expect(200);

      const { state } = signupResponse.body.data;
      expect(state).toBeTruthy();
      expect(typeof state).toBe('string');
      expect(state.length).toBe(64);

      // Use valid state with invalid code should still work (code validation happens later)
      const callbackResponse = await request(app)
        .get('/oauth/callback/google')
        .query({ code: 'invalid-code', state })
        .expect(302);

      // Should redirect with error but not state error
      expect(callbackResponse.headers.location).toContain('code=oauth_error');
      expect(callbackResponse.headers.location).not.toContain('Invalid%20or%20expired%20state%20parameter');
    });
  });

  describe('OAuth Provider Validation', () => {
    it('should only accept Google provider', async () => {
      // Valid provider
      await request(app).get('/oauth/signup/google').query({ callbackUrl: TEST_CALLBACK_URL }).expect(200);

      // Invalid providers
      await request(app)
        .get('/oauth/signup/microsoft')
        .query({ callbackUrl: TEST_CALLBACK_URL })
        .expect(400)
        .expect((res) => {
          expect(res.body.error.message).toContain('Provider microsoft is not implemented yet');
        });

      await request(app)
        .get('/oauth/signup/facebook')
        .query({ callbackUrl: TEST_CALLBACK_URL })
        .expect(400)
        .expect((res) => {
          expect(res.body.error.message).toContain('Provider facebook is not implemented yet');
        });
    });

    it('should validate provider in all endpoints', async () => {
      const endpoints = [
        '/oauth/signup/microsoft',
        '/oauth/signin/microsoft',
        '/oauth/permission/microsoft',
        '/oauth/reauthorize/microsoft',
      ];

      for (const endpoint of endpoints) {
        await request(app)
          .get(endpoint)
          .query({
            callbackUrl: TEST_CALLBACK_URL,
            ...(endpoint.includes('permission') && {
              accountId: '507f1f77bcf86cd799439011',
              scopeNames: JSON.stringify(['test']),
            }),
            ...(endpoint.includes('reauthorize') && {
              accountId: '507f1f77bcf86cd799439011',
            }),
          })
          .expect(400)
          .expect((res) => {
            expect(res.body.error.message).toContain('Provider microsoft is not implemented yet');
          });
      }
    });
  });

  describe('OAuth Mock Service Integration', () => {
    it('should work with mock OAuth service in test environment', async () => {
      expect(oauthMockService.isEnabled()).toBe(true);
      expect(oauthMockService.getSupportedProviders()).toContain(OAuthProviders.Google);

      const stats = oauthMockService.getStats();
      expect(stats.enabledProviders).toContain(OAuthProviders.Google);
      expect(stats.mockAccounts).toBeGreaterThan(0);
    });

    it('should generate and exchange authorization codes correctly', async () => {
      const state = 'test-state';
      const authCode = oauthMockService.generateAuthorizationCode(
        state,
        TEST_ACCOUNTS.GOOGLE_USER,
        OAuthProviders.Google,
      );

      expect(authCode).toBeTruthy();
      expect(typeof authCode).toBe('string');

      const exchangeResult = oauthMockService.exchangeAuthorizationCode(authCode, OAuthProviders.Google);
      expect(exchangeResult).toBeTruthy();
      expect(exchangeResult.tokens).toHaveProperty('access_token');
      expect(exchangeResult.tokens).toHaveProperty('refresh_token');
      expect(exchangeResult.userInfo).toHaveProperty('email', TEST_ACCOUNTS.GOOGLE_USER.email);
    });

    it('should handle token operations correctly', async () => {
      const state = 'test-state';
      const authCode = oauthMockService.generateAuthorizationCode(
        state,
        TEST_ACCOUNTS.GOOGLE_USER,
        OAuthProviders.Google,
      );

      const exchangeResult = oauthMockService.exchangeAuthorizationCode(authCode, OAuthProviders.Google);
      const { access_token, refresh_token } = exchangeResult.tokens;

      // Test token info
      const tokenInfo = oauthMockService.getTokenInfo(access_token, OAuthProviders.Google);
      expect(tokenInfo).toBeTruthy();
      expect(tokenInfo.email).toBe(TEST_ACCOUNTS.GOOGLE_USER.email);

      // Test user info
      const userInfo = oauthMockService.getUserInfo(access_token, OAuthProviders.Google);
      expect(userInfo).toBeTruthy();
      expect(userInfo.email).toBe(TEST_ACCOUNTS.GOOGLE_USER.email);

      // Test token refresh
      const refreshResult = oauthMockService.refreshAccessToken(refresh_token, OAuthProviders.Google);
      expect(refreshResult).toBeTruthy();
      expect(refreshResult.access_token).toBeTruthy();
      expect(refreshResult.access_token).not.toBe(access_token); // Should be different

      // Test token revocation
      const revokeResult = oauthMockService.revokeToken(access_token, OAuthProviders.Google);
      expect(revokeResult).toBe(true);
    });

    it('should clear caches properly between tests', async () => {
      // Generate some data
      const state = 'test-state';
      const authCode = oauthMockService.generateAuthorizationCode(
        state,
        TEST_ACCOUNTS.GOOGLE_USER,
        OAuthProviders.Google,
      );

      const exchangeResult = oauthMockService.exchangeAuthorizationCode(authCode, OAuthProviders.Google);
      expect(exchangeResult).toBeTruthy();

      // Check stats before clear
      const statsBefore = oauthMockService.getStats();
      expect(statsBefore.activeTokens).toBeGreaterThan(0);

      // Clear caches
      oauthMockService.clearCaches();

      // Check stats after clear
      const statsAfter = oauthMockService.getStats();
      expect(statsAfter.activeTokens).toBe(0);
      expect(statsAfter.activeCodes).toBe(0);
    });
  });
});
