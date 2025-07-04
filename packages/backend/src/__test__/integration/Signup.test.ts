import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { startMainServer, stopMainServer } from '../../app';
import { closeAllConnections, getModels } from '../../config/db.config';
import { emailMock } from '../../mocks/email/EmailServiceMock';
import { oauthMockService } from '../../mocks/oauth/OAuthMockService';
import { EmailTemplate } from '../../feature/email/Email.types';
import { getNonDefaultAccounts } from '../../config/mock.config';
import { OAuthProviders } from '../../feature/account/Account.types';

const TEST_CALLBACK_URL = 'http://localhost:7000/auth/callback';

// Get non-seeded accounts (these don't exist in our DB but exist in OAuth provider)
const nonSeededAccounts = getNonDefaultAccounts();

// Find suitable test accounts from non-seeded accounts
const NEW_LOCAL_USER = nonSeededAccounts.find((acc) => acc.email === 'newsignup.local@example.com');

const NEW_OAUTH_USER = nonSeededAccounts.find((acc) => acc.email === 'newsignup.oauth@example.com');

describe('User Signup Flow Integration Tests', () => {
  let app: Express;

  beforeAll(async () => {
    app = await startMainServer();

    // Verify test accounts are available
    expect(NEW_LOCAL_USER).toBeDefined();
    expect(NEW_OAUTH_USER).toBeDefined();

    console.log('Using local test account:', NEW_LOCAL_USER?.email);
    console.log('Using OAuth test account:', NEW_OAUTH_USER?.email);
  });

  afterAll(async () => {
    await stopMainServer();
    await closeAllConnections();
  });

  beforeEach(async () => {
    emailMock.clearSentEmails();
    oauthMockService.clearCaches();

    // Verify our test accounts don't exist in DB
    const models = await getModels();
    const localExists = await models.accounts.Account.findOne({ 'userDetails.email': NEW_LOCAL_USER?.email });
    const oauthExists = await models.accounts.Account.findOne({ 'userDetails.email': NEW_OAUTH_USER?.email });

    if (localExists) await models.accounts.Account.deleteOne({ 'userDetails.email': NEW_LOCAL_USER?.email });
    if (oauthExists) await models.accounts.Account.deleteOne({ 'userDetails.email': NEW_OAUTH_USER?.email });
  });

  describe('Local Account Signup Flow', () => {
    it('should complete full local signup flow successfully', async () => {
      if (!NEW_LOCAL_USER) {
        throw new Error('No suitable local test account found in non-seeded accounts');
      }

      // Step 1: Request email verification
      const emailResponse = await request(app)
        .post('/auth/signup/request-email')
        .send({
          email: NEW_LOCAL_USER.email,
          callbackUrl: TEST_CALLBACK_URL,
        })
        .expect(200);

      expect(emailResponse.body.success).toBe(true);
      expect(emailResponse.body.data.mock.verificationToken).toBeDefined();

      // Verify email was sent
      const sentEmails = emailMock.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].to).toBe(NEW_LOCAL_USER.email);
      expect(sentEmails[0].template).toBe(EmailTemplate.EMAIL_SIGNUP_VERIFICATION);

      const verificationToken = emailResponse.body.data.mock.verificationToken;

      // Step 2: Verify email
      const verifyResponse = await request(app)
        .get('/auth/signup/verify-email')
        .query({ token: verificationToken })
        .expect(200);

      expect(verifyResponse.body.success).toBe(true);
      expect(verifyResponse.body.data.profileToken).toBeDefined();
      expect(verifyResponse.body.data.email).toBe(NEW_LOCAL_USER.email);

      const profileToken = verifyResponse.body.data.profileToken;

      // Step 3: Complete profile
      const profileResponse = await request(app)
        .post('/auth/signup/complete-profile')
        .query({ token: profileToken })
        .send({
          firstName: NEW_LOCAL_USER.firstName,
          lastName: NEW_LOCAL_USER.lastName,
          username: NEW_LOCAL_USER.username,
          password: NEW_LOCAL_USER.password,
          confirmPassword: NEW_LOCAL_USER.password,
          agreeToTerms: true,
        })
        .expect(201);

      expect(profileResponse.body.success).toBe(true);
      expect(profileResponse.body.data.accountId).toBeDefined();
      expect(profileResponse.body.data.name).toBe(`${NEW_LOCAL_USER.firstName} ${NEW_LOCAL_USER.lastName}`);

      // Step 4: Verify account exists in database
      const models = await getModels();
      const createdAccount = await models.accounts.Account.findById(profileResponse.body.data.accountId);

      expect(createdAccount).toBeTruthy();
      expect(createdAccount.userDetails.email).toBe(NEW_LOCAL_USER.email);
      expect(createdAccount.userDetails.username).toBe(NEW_LOCAL_USER.username);
      expect(createdAccount.accountType).toBe('local');
      expect(createdAccount.status).toBe('active');
      expect(createdAccount.userDetails.emailVerified).toBe(true);

      // Signup complete - account should be ready for signin (tested in Signin.test.ts)
    });

    it('should reject signup with existing email', async () => {
      if (!NEW_LOCAL_USER) {
        throw new Error('No suitable local test account found in non-seeded accounts');
      }

      // First, complete a successful signup
      const emailResponse = await request(app)
        .post('/auth/signup/request-email')
        .send({
          email: NEW_LOCAL_USER.email,
          callbackUrl: TEST_CALLBACK_URL,
        })
        .expect(200);

      const verificationToken = emailResponse.body.data.mock.verificationToken;

      const verifyResponse = await request(app)
        .get('/auth/signup/verify-email')
        .query({ token: verificationToken })
        .expect(200);

      await request(app)
        .post('/auth/signup/complete-profile')
        .query({ token: verifyResponse.body.data.profileToken })
        .send({
          firstName: NEW_LOCAL_USER.firstName,
          lastName: NEW_LOCAL_USER.lastName,
          username: NEW_LOCAL_USER.username,
          password: NEW_LOCAL_USER.password,
          confirmPassword: NEW_LOCAL_USER.password,
          agreeToTerms: true,
        })
        .expect(201);

      // Now try to signup again with same email
      await request(app)
        .post('/auth/signup/request-email')
        .send({
          email: NEW_LOCAL_USER.email,
          callbackUrl: TEST_CALLBACK_URL,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.message).toContain('Email already registered');
        });
    });

    it('should handle signup validation errors', async () => {
      if (!NEW_LOCAL_USER) {
        throw new Error('No suitable local test account found in non-seeded accounts');
      }

      // Test invalid email format
      await request(app)
        .post('/auth/signup/request-email')
        .send({
          email: 'invalid-email',
          callbackUrl: TEST_CALLBACK_URL,
        })
        .expect(400);

      // Test missing callback URL
      await request(app)
        .post('/auth/signup/request-email')
        .send({
          email: NEW_LOCAL_USER.email,
        })
        .expect(400);

      // Test weak password in profile completion
      const emailResponse = await request(app)
        .post('/auth/signup/request-email')
        .send({
          email: NEW_LOCAL_USER.email,
          callbackUrl: TEST_CALLBACK_URL,
        })
        .expect(200);

      const verificationToken = emailResponse.body.data.mock.verificationToken;

      const verifyResponse = await request(app)
        .get('/auth/signup/verify-email')
        .query({ token: verificationToken })
        .expect(200);

      await request(app)
        .post('/auth/signup/complete-profile')
        .query({ token: verifyResponse.body.data.profileToken })
        .send({
          firstName: NEW_LOCAL_USER.firstName,
          lastName: NEW_LOCAL_USER.lastName,
          password: 'weak',
          confirmPassword: 'weak',
          agreeToTerms: true,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.error.message).toContain('Password must be at least 8 characters');
        });
    });
  });

  describe('OAuth Account Signup Flow', () => {
    it('should complete full OAuth signup flow successfully', async () => {
      if (!NEW_OAUTH_USER) {
        throw new Error('No suitable OAuth test account found in non-seeded accounts');
      }

      // Step 1: Generate OAuth signup URL
      const signupUrlResponse = await request(app)
        .get('/oauth/signup/google')
        .query({ callbackUrl: TEST_CALLBACK_URL })
        .expect(200);

      expect(signupUrlResponse.body.success).toBe(true);
      expect(signupUrlResponse.body.data.authorizationUrl).toBeDefined();
      expect(signupUrlResponse.body.data.state).toBeDefined();

      const { state } = signupUrlResponse.body.data;

      // Step 2: Simulate OAuth authorization with non-seeded account
      const authCode = oauthMockService.generateAuthorizationCode(state, NEW_OAUTH_USER, OAuthProviders.Google);

      // Step 3: Complete OAuth callback
      const callbackResponse = await request(app)
        .get('/oauth/callback/google')
        .query({ code: authCode, state })
        .expect(302);

      expect(callbackResponse.headers.location).toContain(TEST_CALLBACK_URL);
      expect(callbackResponse.headers.location).toContain('code=oauth_signup_success');
      expect(callbackResponse.headers.location).toContain('provider=google');

      // Extract account ID from callback
      const urlParams = new URLSearchParams(callbackResponse.headers.location.split('?')[1]);
      const accountId = urlParams.get('accountId');
      expect(accountId).toBeDefined();

      // Step 4: Verify account was created in database
      const models = await getModels();
      const createdAccount = await models.accounts.Account.findById(accountId);

      expect(createdAccount).toBeTruthy();
      expect(createdAccount.userDetails.email).toBe(NEW_OAUTH_USER.email);
      expect(createdAccount.userDetails.name).toBe(NEW_OAUTH_USER.name);
      expect(createdAccount.accountType).toBe('oauth');
      expect(createdAccount.provider).toBe('google');
      expect(createdAccount.status).toBe('active');
      expect(createdAccount.userDetails.emailVerified).toBe(true);

      // Signup complete - account should be ready for signin (tested in Signin.test.ts)
    });

    it('should reject OAuth signup for existing account', async () => {
      if (!NEW_OAUTH_USER) {
        throw new Error('No suitable OAuth test account found in non-seeded accounts');
      }

      // First, complete a successful OAuth signup
      const signupUrlResponse = await request(app)
        .get('/oauth/signup/google')
        .query({ callbackUrl: TEST_CALLBACK_URL })
        .expect(200);

      const { state } = signupUrlResponse.body.data;
      const authCode = oauthMockService.generateAuthorizationCode(state, NEW_OAUTH_USER, OAuthProviders.Google);

      await request(app).get('/oauth/callback/google').query({ code: authCode, state }).expect(302);

      // Now try to signup again with same account
      const secondSignupResponse = await request(app)
        .get('/oauth/signup/google')
        .query({ callbackUrl: TEST_CALLBACK_URL })
        .expect(200);

      const secondState = secondSignupResponse.body.data.state;
      const secondAuthCode = oauthMockService.generateAuthorizationCode(
        secondState,
        NEW_OAUTH_USER,
        OAuthProviders.Google,
      );

      const secondCallbackResponse = await request(app)
        .get('/oauth/callback/google')
        .query({ code: secondAuthCode, state: secondState })
        .expect(302);

      expect(secondCallbackResponse.headers.location).toContain('code=oauth_error');
      expect(secondCallbackResponse.headers.location).toContain('error=User+already+exists');
    });

    it('should handle OAuth provider errors during signup', async () => {
      // Test invalid provider
      await request(app)
        .get('/oauth/signup/invalid-provider')
        .query({ callbackUrl: TEST_CALLBACK_URL })
        .expect(400)
        .expect((res) => {
          expect(res.body.error.message).toContain('Invalid OAuth provider');
        });

      // Test missing callback URL
      await request(app)
        .get('/oauth/signup/google')
        .expect(400)
        .expect((res) => {
          expect(res.body.error.message).toContain('callbackUrl query parameter is required');
        });

      // Test invalid callback URL
      await request(app)
        .get('/oauth/signup/google')
        .query({ callbackUrl: 'not-a-url' })
        .expect(400)
        .expect((res) => {
          expect(res.body.error.message).toContain('Invalid Callback URL format');
        });
    });
  });
  describe('Mixed Signup Edge Cases', () => {
    it('should handle email verification token expiration', async () => {
      if (!NEW_LOCAL_USER) {
        throw new Error('No suitable local test account found');
      }

      // Request email verification
      const emailResponse = await request(app)
        .post('/auth/signup/request-email')
        .send({
          email: NEW_LOCAL_USER.email,
          callbackUrl: TEST_CALLBACK_URL,
        })
        .expect(200);

      const verificationToken = emailResponse.body.data.mock.verificationToken;

      // Try to use an invalid/expired token
      await request(app)
        .get('/auth/signup/verify-email')
        .query({ token: 'invalid-token' })
        .expect(400)
        .expect((res) => {
          expect(res.body.error.message).toContain('Invalid or expired verification token');
        });

      // Valid token should still work
      await request(app).get('/auth/signup/verify-email').query({ token: verificationToken }).expect(200);
    });

    it('should handle duplicate username during profile completion', async () => {
      if (!NEW_LOCAL_USER) {
        throw new Error('No suitable local test account found');
      }

      // First, create an account with a username
      const emailResponse = await request(app)
        .post('/auth/signup/request-email')
        .send({
          email: NEW_LOCAL_USER.email,
          callbackUrl: TEST_CALLBACK_URL,
        })
        .expect(200);

      const verificationToken = emailResponse.body.data.mock.verificationToken;
      const verifyResponse = await request(app)
        .get('/auth/signup/verify-email')
        .query({ token: verificationToken })
        .expect(200);

      await request(app)
        .post('/auth/signup/complete-profile')
        .query({ token: verifyResponse.body.data.profileToken })
        .send({
          firstName: NEW_LOCAL_USER.firstName,
          lastName: NEW_LOCAL_USER.lastName,
          username: NEW_LOCAL_USER.username,
          password: NEW_LOCAL_USER.password,
          confirmPassword: NEW_LOCAL_USER.password,
          agreeToTerms: true,
        })
        .expect(201);

      // Find another non-seeded local account for the duplicate test
      const anotherLocalUser = nonSeededAccounts.find(
        (acc) => acc.accountType === 'local' && acc.email !== NEW_LOCAL_USER.email && acc.status === 'active',
      );

      if (anotherLocalUser) {
        // Try to create another account with the same username
        const emailResponse2 = await request(app)
          .post('/auth/signup/request-email')
          .send({
            email: anotherLocalUser.email,
            callbackUrl: TEST_CALLBACK_URL,
          })
          .expect(200);

        const verificationToken2 = emailResponse2.body.data.mock.verificationToken;
        const verifyResponse2 = await request(app)
          .get('/auth/signup/verify-email')
          .query({ token: verificationToken2 })
          .expect(200);

        await request(app)
          .post('/auth/signup/complete-profile')
          .query({ token: verifyResponse2.body.data.profileToken })
          .send({
            firstName: anotherLocalUser.firstName,
            lastName: anotherLocalUser.lastName,
            username: NEW_LOCAL_USER.username, // Same username
            password: anotherLocalUser.password,
            confirmPassword: anotherLocalUser.password,
            agreeToTerms: true,
          })
          .expect(400)
          .expect((res) => {
            expect(res.body.error.message).toContain('Username already in use');
          });
      }
    });
  });
});
