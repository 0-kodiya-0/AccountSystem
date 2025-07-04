import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { startMainServer, stopMainServer } from '../../app';
import { closeAllConnections, getModels } from '../../config/db.config';
import { emailMock } from '../../mocks/email/EmailServiceMock';
import { oauthMockService } from '../../mocks/oauth/OAuthMockService';
import { getDefaultAccounts } from '../../config/mock.config';
import { OAuthProviders } from '../../feature/account/Account.types';

const TEST_CALLBACK_URL = 'http://localhost:7000/auth/callback';

// Get seeded accounts (these exist in our DB)
const seededAccounts = getDefaultAccounts();

// Find suitable test accounts from seeded accounts
const EXISTING_LOCAL_USER = seededAccounts.find((acc) => acc.email === 'local.user@example.com');

const EXISTING_OAUTH_USER = seededAccounts.find((acc) => acc.email === 'oauth.user@example.com');

const EXISTING_2FA_LOCAL_USER = seededAccounts.find((acc) => acc.email === 'local.admin@example.com');

const EXISTING_2FA_OAUTH_USER = seededAccounts.find((acc) => acc.email === 'oauth.admin@example.com');

describe('User Signin Flow Integration Tests', () => {
  let app: Express;
  const REAL_ACCOUNT_IDS: { [key: string]: string } = {};

  beforeAll(async () => {
    app = await startMainServer();

    // Verify test accounts are available
    expect(EXISTING_LOCAL_USER).toBeDefined();
    expect(EXISTING_OAUTH_USER).toBeDefined();
    expect(EXISTING_2FA_LOCAL_USER).toBeDefined();
    expect(EXISTING_2FA_OAUTH_USER).toBeDefined();

    console.log('Using local test account:', EXISTING_LOCAL_USER?.email);
    console.log('Using OAuth test account:', EXISTING_OAUTH_USER?.email);
    console.log('Using 2FA local test account:', EXISTING_2FA_LOCAL_USER?.email);
    console.log('Using 2FA OAuth test account:', EXISTING_2FA_OAUTH_USER?.email);

    const models = await getModels();

    if (EXISTING_LOCAL_USER) {
      const localAccount = await models.accounts.Account.findOne({ 'userDetails.email': EXISTING_LOCAL_USER.email });
      REAL_ACCOUNT_IDS.LOCAL = localAccount?._id.toString() || '';
    }

    if (EXISTING_OAUTH_USER) {
      const oauthAccount = await models.accounts.Account.findOne({ 'userDetails.email': EXISTING_OAUTH_USER.email });
      REAL_ACCOUNT_IDS.OAUTH = oauthAccount?._id.toString() || '';
    }

    if (EXISTING_2FA_LOCAL_USER) {
      const local2faAccount = await models.accounts.Account.findOne({
        'userDetails.email': EXISTING_2FA_LOCAL_USER.email,
      });
      REAL_ACCOUNT_IDS.LOCAL_2FA = local2faAccount?._id.toString() || '';
    }

    if (EXISTING_2FA_OAUTH_USER) {
      const oauth2faAccount = await models.accounts.Account.findOne({
        'userDetails.email': EXISTING_2FA_OAUTH_USER.email,
      });
      REAL_ACCOUNT_IDS.OAUTH_2FA = oauth2faAccount?._id.toString() || '';
    }
  });

  afterAll(async () => {
    await stopMainServer();
    await closeAllConnections();
  });

  beforeEach(async () => {
    emailMock.clearSentEmails();
    oauthMockService.clearCaches();
  });

  describe('Local Account Signin Flow', () => {
    it('should successfully sign in with email and password', async () => {
      if (!EXISTING_LOCAL_USER) {
        throw new Error('No suitable local test account found');
      }

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: EXISTING_LOCAL_USER.email,
          password: EXISTING_LOCAL_USER.password,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accountId).toBe(REAL_ACCOUNT_IDS.LOCAL);
      expect(response.body.data.name).toBe(EXISTING_LOCAL_USER.name);

      // Verify session cookies were set
      const cookies = response.headers['set-cookie'] as string[];
      expect(cookies).toBeDefined();
      expect(cookies.some((cookie) => cookie.includes('access_token'))).toBe(true);
      expect(cookies.some((cookie) => cookie.includes('account_session'))).toBe(true);
    });

    it('should successfully sign in with username and password', async () => {
      if (!EXISTING_LOCAL_USER || !EXISTING_LOCAL_USER.username) {
        throw new Error('No suitable local test account with username found');
      }

      const response = await request(app)
        .post('/auth/login')
        .send({
          username: EXISTING_LOCAL_USER.username,
          password: EXISTING_LOCAL_USER.password,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accountId).toBe(REAL_ACCOUNT_IDS.LOCAL);
      expect(response.body.data.name).toBe(EXISTING_LOCAL_USER.name);
    });

    it('should set refresh token when rememberMe is true', async () => {
      if (!EXISTING_LOCAL_USER) {
        throw new Error('No suitable local test account found');
      }

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: EXISTING_LOCAL_USER.email,
          password: EXISTING_LOCAL_USER.password,
          rememberMe: true,
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify refresh token cookie was set
      const cookies = response.headers['set-cookie'] as string[];
      expect(cookies.some((cookie) => cookie.includes('refresh_token'))).toBe(true);
    });

    it('should reject invalid credentials', async () => {
      if (!EXISTING_LOCAL_USER) {
        throw new Error('No suitable local test account found');
      }

      // Wrong password
      await request(app)
        .post('/auth/login')
        .send({
          email: EXISTING_LOCAL_USER.email,
          password: 'wrongpassword',
        })
        .expect(401)
        .expect((res) => {
          expect(res.body.error.message).toContain('Invalid email/username or password');
        });

      // Wrong email
      await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: EXISTING_LOCAL_USER.password,
        })
        .expect(401)
        .expect((res) => {
          expect(res.body.error.message).toContain('Invalid email/username or password');
        });
    });

    it('should handle account lockout after failed attempts', async () => {
      if (!EXISTING_LOCAL_USER) {
        throw new Error('No suitable local test account found');
      }

      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/auth/login')
          .send({
            email: EXISTING_LOCAL_USER.email,
            password: 'wrongpassword',
          })
          .expect(401);
      }

      // 6th attempt should show account locked
      await request(app)
        .post('/auth/login')
        .send({
          email: EXISTING_LOCAL_USER.email,
          password: 'wrongpassword',
        })
        .expect(401)
        .expect((res) => {
          expect(res.body.error.message).toContain('Account is temporarily locked');
        });

      // Even correct password should fail when locked
      await request(app)
        .post('/auth/login')
        .send({
          email: EXISTING_LOCAL_USER.email,
          password: EXISTING_LOCAL_USER.password,
        })
        .expect(401)
        .expect((res) => {
          expect(res.body.error.message).toContain('Account is temporarily locked');
        });
    });
  });

  describe('Local Account 2FA Signin Flow', () => {
    it('should require 2FA for accounts with 2FA enabled', async () => {
      if (!EXISTING_2FA_LOCAL_USER) {
        throw new Error('No suitable 2FA local test account found');
      }

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: EXISTING_2FA_LOCAL_USER.email,
          password: EXISTING_2FA_LOCAL_USER.password,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.requiresTwoFactor).toBe(true);
      expect(response.body.data.tempToken).toBeDefined();
      expect(response.body.data.accountId).toBe(REAL_ACCOUNT_IDS.LOCAL_2FA);

      // Should not have auth cookies yet (2FA not completed)
      const cookies = response.headers['set-cookie'] as string[];
      expect(cookies?.some((cookie) => cookie.includes('access_token'))).toBeFalsy();
    });

    // Note: Actual 2FA verification would be tested in TwoFA.test.ts
  });

  describe('OAuth Account Signin Flow', () => {
    it('should successfully sign in with OAuth', async () => {
      if (!EXISTING_OAUTH_USER) {
        throw new Error('No suitable OAuth test account found');
      }

      // Step 1: Generate OAuth signin URL
      const signinResponse = await request(app)
        .get('/oauth/signin/google')
        .query({ callbackUrl: TEST_CALLBACK_URL })
        .expect(200);

      expect(signinResponse.body.success).toBe(true);
      expect(signinResponse.body.data.authorizationUrl).toBeDefined();
      expect(signinResponse.body.data.state).toBeDefined();

      const { state } = signinResponse.body.data;

      // Step 2: Simulate OAuth authorization
      const authCode = oauthMockService.generateAuthorizationCode(state, EXISTING_OAUTH_USER, OAuthProviders.Google);

      // Step 3: Complete OAuth callback
      const callbackResponse = await request(app)
        .get('/oauth/callback/google')
        .query({ code: authCode, state })
        .expect(302);

      expect(callbackResponse.headers.location).toContain(TEST_CALLBACK_URL);
      expect(callbackResponse.headers.location).toContain('code=oauth_signin_success');
      expect(callbackResponse.headers.location).toContain('provider=google');

      // Extract account ID from callback
      const urlParams = new URLSearchParams(callbackResponse.headers.location.split('?')[1]);
      const accountId = urlParams.get('accountId');
      expect(accountId).toBe(REAL_ACCOUNT_IDS.OAUTH);
    });

    it('should require 2FA for OAuth accounts with 2FA enabled', async () => {
      if (!EXISTING_2FA_OAUTH_USER) {
        throw new Error('No suitable 2FA OAuth test account found');
      }

      const signinResponse = await request(app)
        .get('/oauth/signin/google')
        .query({ callbackUrl: TEST_CALLBACK_URL })
        .expect(200);

      const { state } = signinResponse.body.data;
      const authCode = oauthMockService.generateAuthorizationCode(
        state,
        EXISTING_2FA_OAUTH_USER,
        OAuthProviders.Google,
      );

      const callbackResponse = await request(app)
        .get('/oauth/callback/google')
        .query({ code: authCode, state })
        .expect(302);

      expect(callbackResponse.headers.location).toContain('code=oauth_signin_requires_2fa');
      expect(callbackResponse.headers.location).toContain('tempToken=');
      expect(callbackResponse.headers.location).toContain('requiresTwoFactor=true');

      const urlParams = new URLSearchParams(callbackResponse.headers.location.split('?')[1]);
      const accountId = urlParams.get('accountId');
      expect(accountId).toBe(REAL_ACCOUNT_IDS.OAUTH_2FA);
    });

    it('should reject OAuth signin for non-existent accounts', async () => {
      // Use an account that exists in OAuth provider but not in our DB
      const nonExistentOAuthUser = {
        id: 'non_existent_user',
        email: 'nonexistent@example.com',
        name: 'Non Existent',
        provider: 'google' as const,
        accountType: 'oauth' as const,
        status: 'active' as const,
        emailVerified: true,
        twoFactorEnabled: false,
      };

      const signinResponse = await request(app)
        .get('/oauth/signin/google')
        .query({ callbackUrl: TEST_CALLBACK_URL })
        .expect(200);

      const { state } = signinResponse.body.data;
      const authCode = oauthMockService.generateAuthorizationCode(state, nonExistentOAuthUser, OAuthProviders.Google);

      const callbackResponse = await request(app)
        .get('/oauth/callback/google')
        .query({ code: authCode, state })
        .expect(302);

      expect(callbackResponse.headers.location).toContain('code=oauth_error');
      expect(callbackResponse.headers.location).toContain('error=User+not+found');
    });
  });

  describe('Signin Validation and Error Handling', () => {
    it('should validate required fields for local signin', async () => {
      // Missing password
      await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.error.message).toContain('Password is required');
        });

      // Missing email/username
      await request(app)
        .post('/auth/login')
        .send({
          password: 'password123',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.error.message).toContain('Email or username is required');
        });
    });

    it('should validate OAuth signin parameters', async () => {
      // Missing callback URL
      await request(app)
        .get('/oauth/signin/google')
        .expect(400)
        .expect((res) => {
          expect(res.body.error.message).toContain('callbackUrl query parameter is required');
        });

      // Invalid callback URL
      await request(app)
        .get('/oauth/signin/google')
        .query({ callbackUrl: 'not-a-url' })
        .expect(400)
        .expect((res) => {
          expect(res.body.error.message).toContain('Invalid Callback URL format');
        });

      // Invalid provider
      await request(app)
        .get('/oauth/signin/invalid-provider')
        .query({ callbackUrl: TEST_CALLBACK_URL })
        .expect(400)
        .expect((res) => {
          expect(res.body.error.message).toContain('Invalid OAuth provider');
        });
    });

    it('should handle OAuth callback errors gracefully', async () => {
      // Invalid state parameter
      await request(app)
        .get('/oauth/callback/google')
        .query({ code: 'test-code', state: 'invalid-state' })
        .expect(302)
        .expect((res) => {
          expect(res.headers.location).toContain('code=oauth_error');
          expect(res.headers.location).toContain('error=Invalid+or+expired+state+parameter');
        });

      // Missing authorization code
      await request(app)
        .get('/oauth/callback/google')
        .query({ state: 'test-state' })
        .expect(302)
        .expect((res) => {
          expect(res.headers.location).toContain('code=oauth_error');
        });

      // Missing state parameter
      await request(app)
        .get('/oauth/callback/google')
        .query({ code: 'test-code' })
        .expect(302)
        .expect((res) => {
          expect(res.headers.location).toContain('code=oauth_error');
        });
    });
  });

  describe('Account Status Validation', () => {
    it('should reject signin for suspended accounts', async () => {
      // This would require a suspended account in the mock config
      // For now, we'll test the concept with a mock
      const suspendedUser = seededAccounts.find((acc) => acc.status === 'suspended');

      if (suspendedUser && suspendedUser.accountType === 'local') {
        await request(app)
          .post('/auth/login')
          .send({
            email: suspendedUser.email,
            password: suspendedUser.password || 'TestPassword123!',
          })
          .expect(401)
          .expect((res) => {
            expect(res.body.error.message).toContain('suspended');
          });
      }
    });

    it('should reject signin for unverified local accounts', async () => {
      // This would require an unverified account in the mock config
      const unverifiedUser = seededAccounts.find((acc) => acc.status === 'unverified');

      if (unverifiedUser && unverifiedUser.accountType === 'local') {
        await request(app)
          .post('/auth/login')
          .send({
            email: unverifiedUser.email,
            password: unverifiedUser.password || 'TestPassword123!',
          })
          .expect(401)
          .expect((res) => {
            expect(res.body.error.message).toContain('verify your email');
          });
      }
    });
  });
});
