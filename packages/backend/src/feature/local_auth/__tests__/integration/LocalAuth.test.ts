import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { startMainServer, stopMainServer } from '../../../../app';
import { emailMock } from '../../../../mocks/email/EmailServiceMock';
import { EmailTemplate } from '../../../email/Email.types';
import { AccountType, AccountStatus } from '../../../account/Account.types';
import {
  getAllEmailVerificationTokens,
  getAllProfileCompletionTokens,
  getAllPasswordResetTokens,
  cleanupSignupData,
  clearUpPasswordResetDataByEmail,
} from '../../LocalAuth.cache';
import { closeAllConnections, getModels } from '../../../../config/db.config';

// Use existing test account from mock.config.json
const existingTestUser = {
  accountId: 'account_7', // local.user@example.com from mock config
  email: 'local.user@example.com',
  username: 'localuser',
  password: 'TestPassword123!',
  name: 'Local User',
};

// New test user for signup flow
const newTestUser = {
  email: 'newtest@example.com',
  firstName: 'New',
  lastName: 'Test',
  username: 'newtest123',
  password: 'NewTestPassword123!',
  confirmPassword: 'NewTestPassword123!',
  agreeToTerms: true,
};

const testCallbackUrl = 'http://localhost:3000/auth/callback';

describe('Local Auth Integration Tests', () => {
  let baseURL: string;

  beforeAll(async () => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.MOCK_ENABLED = 'true';
    process.env.USE_MEMORY_DB = 'true';
    process.env.TEST_DB_CLEAR_ON_START = 'true';
    process.env.TEST_DB_SEED_ON_START = 'true'; // Use seeded test accounts

    // Start the server
    await startMainServer();
    baseURL = 'http://localhost:3000';

    // Clear email mock
    emailMock.clearSentEmails();
  });

  afterAll(async () => {
    await stopMainServer();
    await closeAllConnections();
  });

  beforeEach(async () => {
    // Clear email mock and signup cache before each test
    emailMock.clearSentEmails();

    const models = await getModels();
    await models.accounts.Account.deleteMany({
      'userDetails.email': {
        $in: [
          newTestUser.email,
          'special@example.com',
          'unicode@example.com',
          'mocktest@example.com',
          // Add any other test emails used in the tests
        ],
      },
    });
  });

  describe('Signup Flow', () => {
    beforeEach(() => {
      cleanupSignupData(newTestUser.email);
    });
    describe('Step 1: Request Email Verification', () => {
      it('should successfully request email verification', async () => {
        const response = await request(baseURL).post('/auth/signup/request-email').send({
          email: newTestUser.email,
          callbackUrl: testCallbackUrl,
        });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.message).toContain('Verification email sent');
        expect(response.body.data.email).toBe(newTestUser.email);
        expect(response.body.data.callbackUrl).toBe(testCallbackUrl);

        // In mock mode, verification token should be included
        expect(response.body.data.mock).toBeDefined();
        expect(response.body.data.mock.verificationToken).toBeDefined();
        expect(response.body.data.mock.verifyUrl).toBeDefined();

        // Verify email was sent
        const sentEmails = emailMock.getSentEmails();
        expect(sentEmails).toHaveLength(1);
        expect(sentEmails[0].to).toBe(newTestUser.email);
        expect(sentEmails[0].template).toBe(EmailTemplate.EMAIL_SIGNUP_VERIFICATION);
        expect(sentEmails[0].status).toBe('sent');

        // Verify token was cached
        const emailTokens = getAllEmailVerificationTokens();
        expect(emailTokens).toHaveLength(1);
        expect(emailTokens[0].email).toBe(newTestUser.email);
        expect(emailTokens[0].step).toBe('email_verification');
      });

      it('should reject existing user email', async () => {
        const response = await request(baseURL).post('/auth/signup/request-email').send({
          email: existingTestUser.email, // Use existing user email
          callbackUrl: testCallbackUrl,
        });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toContain('Email already registered');
      });

      it('should reject invalid email format', async () => {
        const response = await request(baseURL).post('/auth/signup/request-email').send({
          email: 'invalid-email',
          callbackUrl: testCallbackUrl,
        });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toBe('Invalid email format');
      });

      it('should reject missing callback URL', async () => {
        const response = await request(baseURL).post('/auth/signup/request-email').send({
          email: newTestUser.email,
        });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toContain('Email and callbackUrl are required');
      });
    });

    describe('Step 2: Verify Email', () => {
      let verificationToken: string;

      beforeEach(async () => {
        // Request email verification first
        const response = await request(baseURL).post('/auth/signup/request-email').send({
          email: newTestUser.email,
          callbackUrl: testCallbackUrl,
        });

        verificationToken = response.body.data.mock.verificationToken;
      });

      it('should successfully verify email and return profile token', async () => {
        const response = await request(baseURL).get('/auth/signup/verify-email').query({ token: verificationToken });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.message).toContain('Email verified successfully');
        expect(response.body.data.profileToken).toBeDefined();
        expect(response.body.data.email).toBe(newTestUser.email);

        // Verify profile completion token was created
        const profileTokens = getAllProfileCompletionTokens();
        expect(profileTokens).toHaveLength(1);
        expect(profileTokens[0].email).toBe(newTestUser.email);
        expect(profileTokens[0].emailVerified).toBe(true);

        // Verify email verification token was removed
        const emailTokens = getAllEmailVerificationTokens();
        expect(emailTokens).toHaveLength(0);
      });

      it('should reject invalid verification token', async () => {
        const response = await request(baseURL).get('/auth/signup/verify-email').query({ token: 'invalid-token' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toBe('Invalid or expired verification token');
      });

      it('should reject missing verification token', async () => {
        const response = await request(baseURL).get('/auth/signup/verify-email');

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toContain('Verification token is required');
      });
    });

    describe('Step 3: Complete Profile', () => {
      let profileToken: string;

      beforeEach(async () => {
        // Complete steps 1 and 2
        const emailResponse = await request(baseURL).post('/auth/signup/request-email').send({
          email: newTestUser.email,
          callbackUrl: testCallbackUrl,
        });

        const verificationToken = emailResponse.body.data.mock.verificationToken;

        const verifyResponse = await request(baseURL)
          .get('/auth/signup/verify-email')
          .query({ token: verificationToken });

        profileToken = verifyResponse.body.data.profileToken;
      });

      it('should reject mismatched passwords', async () => {
        const response = await request(baseURL)
          .post('/auth/signup/complete-profile')
          .query({ token: profileToken })
          .send({
            firstName: newTestUser.firstName,
            lastName: newTestUser.lastName,
            password: newTestUser.password,
            confirmPassword: 'DifferentPassword123!',
            agreeToTerms: newTestUser.agreeToTerms,
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toBe('Passwords do not match');
      });

      it('should reject weak password', async () => {
        const response = await request(baseURL)
          .post('/auth/signup/complete-profile')
          .query({ token: profileToken })
          .send({
            firstName: newTestUser.firstName,
            lastName: newTestUser.lastName,
            password: 'weak',
            confirmPassword: 'weak',
            agreeToTerms: newTestUser.agreeToTerms,
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toBe('Password must be at least 8 characters long');
      });

      it('should reject if terms not agreed', async () => {
        const response = await request(baseURL)
          .post('/auth/signup/complete-profile')
          .query({ token: profileToken })
          .send({
            firstName: newTestUser.firstName,
            lastName: newTestUser.lastName,
            password: newTestUser.password,
            confirmPassword: newTestUser.password,
            agreeToTerms: false,
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toBe('You must agree to the terms and conditions');
      });

      it('should successfully complete profile and create account', async () => {
        const response = await request(baseURL)
          .post('/auth/signup/complete-profile')
          .query({ token: profileToken })
          .send({
            firstName: newTestUser.firstName,
            lastName: newTestUser.lastName,
            username: newTestUser.username,
            password: newTestUser.password,
            confirmPassword: newTestUser.confirmPassword,
            agreeToTerms: newTestUser.agreeToTerms,
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.message).toContain('Account created successfully');
        expect(response.body.data.accountId).toBeDefined();
        expect(response.body.data.name).toBe(`${newTestUser.firstName} ${newTestUser.lastName}`);

        // Verify profile completion token was removed
        const profileTokens = getAllProfileCompletionTokens();
        expect(profileTokens).toHaveLength(0);
      });
    });

    describe('Signup Status and Cancellation', () => {
      it('should return correct signup status for email verification step', async () => {
        await request(baseURL).post('/auth/signup/request-email').send({
          email: newTestUser.email,
          callbackUrl: testCallbackUrl,
        });

        const response = await request(baseURL).get('/auth/signup/status').query({ email: newTestUser.email });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.step).toBe('email_verification');
        expect(response.body.data.email).toBe(newTestUser.email);
        expect(response.body.data.token).toBeDefined();
        expect(response.body.data.expiresAt).toBeDefined();
      });

      it('should successfully cancel email verification', async () => {
        await request(baseURL).post('/auth/signup/request-email').send({
          email: newTestUser.email,
          callbackUrl: testCallbackUrl,
        });

        const response = await request(baseURL).delete('/auth/signup/cancel').query({ email: newTestUser.email });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.message).toContain('Email verification cancelled successfully');

        // Verify tokens were removed
        const emailTokens = getAllEmailVerificationTokens();
        expect(emailTokens.filter((t) => t.email === newTestUser.email)).toHaveLength(0);
      });
    });
  });

  describe('Signin Flow (Using Existing Account)', () => {
    it('should successfully login with email and password', async () => {
      const response = await request(baseURL).post('/auth/login').send({
        email: existingTestUser.email,
        password: existingTestUser.password,
        rememberMe: false,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accountId).toBeDefined();
      expect(response.body.data.name).toBe(existingTestUser.name);

      // Check that cookies were set
      const cookies = response.headers['set-cookie'] as string[];
      expect(cookies).toBeDefined();
      expect(cookies.some((cookie) => cookie.includes('access_token'))).toBe(true);
      expect(cookies.some((cookie) => cookie.includes('account_session'))).toBe(true);
    });

    it('should successfully login with username and password', async () => {
      const response = await request(baseURL).post('/auth/login').send({
        username: existingTestUser.username,
        password: existingTestUser.password,
        rememberMe: false,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accountId).toBeDefined();
      expect(response.body.data.name).toBe(existingTestUser.name);
    });

    it('should set refresh token when rememberMe is true', async () => {
      const response = await request(baseURL).post('/auth/login').send({
        email: existingTestUser.email,
        password: existingTestUser.password,
        rememberMe: true,
      });

      expect(response.status).toBe(200);

      const cookies = response.headers['set-cookie'] as string[];
      expect(cookies.some((cookie) => cookie.includes('refresh_token'))).toBe(true);
    });

    it('should reject invalid email', async () => {
      const response = await request(baseURL).post('/auth/login').send({
        email: 'nonexistent@example.com',
        password: existingTestUser.password,
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid email/username or password');
    });

    it('should reject invalid password', async () => {
      const response = await request(baseURL).post('/auth/login').send({
        email: existingTestUser.email,
        password: 'wrongpassword',
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid email/username or password');
    });

    it('should reject missing credentials', async () => {
      const response = await request(baseURL).post('/auth/login').send({
        password: existingTestUser.password,
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Email or username is required');
    });
  });

  describe('Password Reset Flow (Using Existing Account)', () => {
    beforeEach(() => {
      // Clear emails from any previous tests
      emailMock.clearSentEmails();
      clearUpPasswordResetDataByEmail(existingTestUser.email);
    });

    it('should successfully request password reset', async () => {
      const response = await request(baseURL).post('/auth/reset-password-request').send({
        email: existingTestUser.email,
        callbackUrl: testCallbackUrl,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('If your email is registered');
      expect(response.body.data.callbackUrl).toBe(testCallbackUrl);

      // In mock mode, reset token should be included
      expect(response.body.data.mock).toBeDefined();
      expect(response.body.data.mock.resetToken).toBeDefined();
      expect(response.body.data.mock.resetUrl).toBeDefined();

      // Verify email was sent
      const sentEmails = emailMock.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].to).toBe(existingTestUser.email);
      expect(sentEmails[0].template).toBe(EmailTemplate.PASSWORD_RESET);
      expect(sentEmails[0].status).toBe('sent');

      // Verify token was cached
      const resetTokens = getAllPasswordResetTokens();
      expect(resetTokens).toHaveLength(1);
      expect(resetTokens[0].email).toBe(existingTestUser.email);
    });

    it('should successfully reset password with valid token', async () => {
      // Request password reset first
      const resetResponse = await request(baseURL).post('/auth/reset-password-request').send({
        email: existingTestUser.email,
        callbackUrl: testCallbackUrl,
      });

      const resetToken = resetResponse.body.data.mock.resetToken;
      const newPassword = 'NewPassword123!';

      const response = await request(baseURL).post('/auth/reset-password').query({ token: resetToken }).send({
        password: newPassword,
        confirmPassword: newPassword,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('Password reset successfully');

      // Verify old password doesn't work
      const oldPasswordResponse = await request(baseURL).post('/auth/login').send({
        email: existingTestUser.email,
        password: existingTestUser.password,
      });

      expect(oldPasswordResponse.status).toBe(401);

      // Verify new password works
      const newPasswordResponse = await request(baseURL).post('/auth/login').send({
        email: existingTestUser.email,
        password: newPassword,
      });

      expect(newPasswordResponse.status).toBe(200);

      // Verify reset token was removed
      const resetTokens = getAllPasswordResetTokens();
      expect(resetTokens.filter((t) => t.token === resetToken)).toHaveLength(0);

      // Verify password changed notification email was sent
      const sentEmails = emailMock.getSentEmails();
      const changeNotification = sentEmails.find((email) => email.template === EmailTemplate.PASSWORD_CHANGED);
      expect(changeNotification).toBeDefined();
      expect(changeNotification!.to).toBe(existingTestUser.email);
    });

    it('should reject invalid reset token', async () => {
      const response = await request(baseURL).post('/auth/reset-password').query({ token: 'invalid-token' }).send({
        password: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Password reset token is invalid or has expired');
    });

    it('should reject mismatched passwords in reset', async () => {
      const resetResponse = await request(baseURL).post('/auth/reset-password-request').send({
        email: existingTestUser.email,
        callbackUrl: testCallbackUrl,
      });

      const resetToken = resetResponse.body.data.mock.resetToken;

      const response = await request(baseURL).post('/auth/reset-password').query({ token: resetToken }).send({
        password: 'NewPassword123!',
        confirmPassword: 'DifferentPassword123!',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Passwords do not match');
    });

    it('should handle password reset for non-existent email gracefully', async () => {
      const response = await request(baseURL).post('/auth/reset-password-request').send({
        email: 'nonexistent@example.com',
        callbackUrl: testCallbackUrl,
      });

      // Should return error for non-existent email
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);

      // Should not send any emails
      const sentEmails = emailMock.getSentEmails();
      expect(sentEmails).toHaveLength(0);

      // Should not create any reset tokens
      const resetTokens = getAllPasswordResetTokens();
      expect(resetTokens).toHaveLength(0);
    });
  });

  describe('Password Change (Authenticated)', () => {
    let authCookies: string[];
    let accountId: string;

    beforeEach(async () => {
      // Login to get auth cookies
      const loginResponse = await request(baseURL).post('/auth/login').send({
        email: existingTestUser.email,
        password: existingTestUser.password,
      });

      accountId = loginResponse.body.data.accountId;
      authCookies = loginResponse.headers['set-cookie'] as string[];
    });

    it('should successfully change password when authenticated', async () => {
      const newPassword = 'NewPassword456!';

      const response = await request(baseURL)
        .post(`/${accountId}/auth/change-password`)
        .set('Cookie', authCookies)
        .send({
          oldPassword: existingTestUser.password,
          newPassword: newPassword,
          confirmPassword: newPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('Password changed successfully');

      // Verify old password doesn't work
      const oldPasswordResponse = await request(baseURL).post('/auth/login').send({
        email: existingTestUser.email,
        password: existingTestUser.password,
      });

      expect(oldPasswordResponse.status).toBe(401);

      // Verify new password works
      const newPasswordResponse = await request(baseURL).post('/auth/login').send({
        email: existingTestUser.email,
        password: newPassword,
      });

      expect(newPasswordResponse.status).toBe(200);
    });

    it('should reject incorrect old password', async () => {
      const response = await request(baseURL)
        .post(`/${accountId}/auth/change-password`)
        .set('Cookie', authCookies)
        .send({
          oldPassword: 'WrongPassword123!',
          newPassword: 'NewPassword456!',
          confirmPassword: 'NewPassword456!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Current password is incorrect');
    });

    it('should reject mismatched new passwords', async () => {
      const response = await request(baseURL)
        .post(`/${accountId}/auth/change-password`)
        .set('Cookie', authCookies)
        .send({
          oldPassword: existingTestUser.password,
          newPassword: 'NewPassword456!',
          confirmPassword: 'DifferentPassword456!',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('New passwords do not match');
    });

    it('should reject weak new password', async () => {
      const response = await request(baseURL)
        .post(`/${accountId}/auth/change-password`)
        .set('Cookie', authCookies)
        .send({
          oldPassword: existingTestUser.password,
          newPassword: 'weak',
          confirmPassword: 'weak',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Password must be at least 8 characters');
    });

    it('should reject same password as old password', async () => {
      const response = await request(baseURL)
        .post(`/${accountId}/auth/change-password`)
        .set('Cookie', authCookies)
        .send({
          oldPassword: existingTestUser.password,
          newPassword: existingTestUser.password,
          confirmPassword: existingTestUser.password,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('New password must be different from the current password');
    });

    it('should require authentication for password change', async () => {
      const response = await request(baseURL).post(`/${accountId}/auth/change-password`).send({
        oldPassword: existingTestUser.password,
        newPassword: 'NewPassword456!',
        confirmPassword: 'NewPassword456!',
      });

      expect(response.status).toBe(302); // Redirect to login due to missing auth
    });
  });

  describe('Token Expiration and Edge Cases', () => {
    it('should handle expired verification token gracefully', async () => {
      // Create an expired token using the mock service
      const expiredTokenResponse = await request(baseURL).post('/mock/token/expired/create').send({
        accountId: '507f1f77bcf86cd799439011', // Valid ObjectId format
        accountType: 'local',
        tokenType: 'access',
        pastSeconds: 3600, // 1 hour past expiration
      });

      const expiredToken = expiredTokenResponse.body.data.token;

      const response = await request(baseURL).get('/auth/signup/verify-email').query({ token: expiredToken });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid or expired verification token');
    });

    it('should handle malformed tokens gracefully', async () => {
      // Create a malformed token using the mock service
      const malformedTokenResponse = await request(baseURL).post('/mock/token/malformed/create').send({
        type: 'invalid_signature',
      });

      const malformedToken = malformedTokenResponse.body.data.token;

      const response = await request(baseURL).get('/auth/signup/verify-email').query({ token: malformedToken });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid or expired verification token');
    });
  });

  describe('Security Features', () => {
    it('should not expose sensitive information in error messages', async () => {
      const response = await request(baseURL).post('/auth/login').send({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      expect(response.status).toBe(401);
      expect(response.body.error.message).not.toContain('database');
      expect(response.body.error.message).not.toContain('mongodb');
      expect(response.body.error.message).not.toContain('hash');
    });

    it('should handle special characters in passwords', async () => {
      const specialPassword = 'P@ssw0rd!#$%^&*()_+-=[]{}|;:,.<>?';

      const emailResponse = await request(baseURL).post('/auth/signup/request-email').send({
        email: 'special@example.com',
        callbackUrl: testCallbackUrl,
      });

      const verificationToken = emailResponse.body.data.mock.verificationToken;

      const verifyResponse = await request(baseURL)
        .get('/auth/signup/verify-email')
        .query({ token: verificationToken });

      const response = await request(baseURL)
        .post('/auth/signup/complete-profile')
        .query({ token: verifyResponse.body.data.profileToken })
        .send({
          firstName: 'Special',
          lastName: 'User',
          password: specialPassword,
          confirmPassword: specialPassword,
          agreeToTerms: true,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      // Verify login works with special characters
      const loginResponse = await request(baseURL).post('/auth/login').send({
        email: 'special@example.com',
        password: specialPassword,
      });

      expect(loginResponse.status).toBe(200);
    });

    it('should handle unicode characters in names', async () => {
      const emailResponse = await request(baseURL).post('/auth/signup/request-email').send({
        email: 'unicode@example.com',
        callbackUrl: testCallbackUrl,
      });

      const verificationToken = emailResponse.body.data.mock.verificationToken;

      const verifyResponse = await request(baseURL)
        .get('/auth/signup/verify-email')
        .query({ token: verificationToken });

      const response = await request(baseURL)
        .post('/auth/signup/complete-profile')
        .query({ token: verifyResponse.body.data.profileToken })
        .send({
          firstName: 'José',
          lastName: 'García',
          password: 'UnicodeTest123!',
          confirmPassword: 'UnicodeTest123!',
          agreeToTerms: true,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('José García');
    });

    it('should lock account after multiple failed login attempts', async () => {
      // Use existing test account
      const email = existingTestUser.email;

      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(baseURL).post('/auth/login').send({
          email,
          password: 'wrongpassword',
        });
      }

      // 6th attempt should show account locked
      const response = await request(baseURL).post('/auth/login').send({
        email,
        password: 'wrongpassword',
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain(
        'Account is temporarily locked. Try again later or reset your password.',
      );

      // Even correct password should fail when locked
      const lockedResponse = await request(baseURL).post('/auth/login').send({
        email,
        password: existingTestUser.password,
      });

      expect(lockedResponse.status).toBe(401);
      expect(lockedResponse.body.error.message).toContain('Account is temporarily locked');
    });
  });

  describe('Mock Service Integration', () => {
    it('should work properly with email mock service', async () => {
      // Verify mock is enabled and working
      expect(emailMock.isEnabled()).toBe(true);

      const response = await request(baseURL).post('/auth/signup/request-email').send({
        email: 'mocktest@example.com',
        callbackUrl: testCallbackUrl,
      });

      expect(response.status).toBe(200);

      // Check email mock captured the email
      const sentEmails = emailMock.getSentEmails();
      expect(sentEmails).toHaveLength(1);

      const email = sentEmails[0];
      expect(email.to).toBe('mocktest@example.com');
      expect(email.subject).toContain('Verify your email');
      expect(email.template).toBe(EmailTemplate.EMAIL_SIGNUP_VERIFICATION);
      expect(email.html).toContain('mocktest@example.com');
      expect(email.html).toContain(testCallbackUrl);

      // Verify email variables were substituted
      expect(email.variables).toBeDefined();
      expect(email.variables!.EMAIL).toBe('mocktest@example.com');
      expect(email.variables!.VERIFICATION_URL).toContain(testCallbackUrl);
    });

    it('should handle email mock failures gracefully', async () => {
      // Use a blocked email address from mock config
      const failEmail = 'blocked@example.com';

      const response = await request(baseURL).post('/auth/signup/request-email').send({
        email: failEmail,
        callbackUrl: testCallbackUrl,
      });

      // Should return error due to email service failure
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Failed to send verification email');
    });
  });

  describe('Integration with Token System', () => {
    it('should properly set and validate tokens on login', async () => {
      const loginResponse = await request(baseURL).post('/auth/login').send({
        email: existingTestUser.email,
        password: existingTestUser.password,
      });

      expect(loginResponse.status).toBe(200);
      const accountId = loginResponse.body.data.accountId;
      const cookies = loginResponse.headers['set-cookie'] as string[];

      // Verify token info using mock endpoint
      const tokenInfoResponse = await request(baseURL).get(`/mock/token/info/${accountId}`).set('Cookie', cookies);

      expect(tokenInfoResponse.status).toBe(200);
      expect(tokenInfoResponse.body.success).toBe(true);
      expect(tokenInfoResponse.body.data.accessToken.present).toBe(true);
      expect(tokenInfoResponse.body.data.accessToken.valid).toBe(true);
      expect(tokenInfoResponse.body.data.accessToken.expired).toBe(false);
    });

    it('should handle token refresh correctly', async () => {
      // Login with remember me to get refresh token
      const loginResponse = await request(baseURL).post('/auth/login').send({
        email: existingTestUser.email,
        password: existingTestUser.password,
        rememberMe: true,
      });

      const accountId = loginResponse.body.data.data.accountId;
      const cookies = loginResponse.headers['set-cookie'] as string[];

      // Test token refresh endpoint
      const refreshResponse = await request(baseURL)
        .get(`/${accountId}/tokens/refresh`)
        .query({ redirectUrl: '/dashboard' })
        .set('Cookie', cookies);

      expect(refreshResponse.status).toBe(302); // Redirect after refresh
      expect(refreshResponse.headers.location).toBe('/dashboard');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed requests gracefully', async () => {
      const response = await request(baseURL).post('/auth/signup/request-email').send('invalid json string');

      expect(response.status).toBe(400);
    });

    it('should handle very long email addresses', async () => {
      const longEmail = 'a'.repeat(100) + '@example.com';

      const response = await request(baseURL).post('/auth/signup/request-email').send({
        email: longEmail,
        callbackUrl: testCallbackUrl,
      });

      expect(response.status).toBe(200); // Should handle gracefully
    });

    it('should validate required fields properly', async () => {
      // Test missing email
      const missingEmailResponse = await request(baseURL).post('/auth/signup/request-email').send({
        callbackUrl: testCallbackUrl,
      });

      expect(missingEmailResponse.status).toBe(400);
      expect(missingEmailResponse.body.error.message).toContain('Email and callbackUrl are required');

      // Test missing callback URL
      const missingCallbackResponse = await request(baseURL).post('/auth/signup/request-email').send({
        email: 'test@example.com',
      });

      expect(missingCallbackResponse.status).toBe(400);
      expect(missingCallbackResponse.body.error.message).toContain('Email and callbackUrl are required');
    });

    it('should handle username edge cases', async () => {
      const testCases = [
        { username: 'user123', shouldPass: true },
        { username: 'user_name', shouldPass: true },
        { username: 'user-name', shouldPass: true },
        { username: 'u', shouldPass: false }, // Too short
        { username: 'a'.repeat(31), shouldPass: false }, // Too long
      ];

      for (const [index, testCase] of testCases.entries()) {
        const email = `usernametest${index}@example.com`;

        // Complete signup flow to username validation step
        const emailResponse = await request(baseURL).post('/auth/signup/request-email').send({
          email,
          callbackUrl: testCallbackUrl,
        });

        const verificationToken = emailResponse.body.data.mock.verificationToken;

        const verifyResponse = await request(baseURL)
          .get('/auth/signup/verify-email')
          .query({ token: verificationToken });

        const profileToken = verifyResponse.body.data.profileToken;

        const response = await request(baseURL)
          .post('/auth/signup/complete-profile')
          .query({ token: profileToken })
          .send({
            firstName: 'Test',
            lastName: 'User',
            username: testCase.username,
            password: 'TestPassword123!',
            confirmPassword: 'TestPassword123!',
            agreeToTerms: true,
          });

        if (testCase.shouldPass) {
          expect(response.status).toBe(201);
          expect(response.body.success).toBe(true);
        } else {
          expect(response.status).toBe(400);
          expect(response.body.success).toBe(false);
        }
      }
    });
  });

  describe('Data Consistency', () => {
    it('should maintain data consistency throughout signup flow', async () => {
      const testEmail = 'consistency@example.com';
      const testData = {
        firstName: 'Consistency',
        lastName: 'Test',
        username: 'consistencytest',
        password: 'ConsistencyTest123!',
      };

      // Step 1: Request email verification
      const emailResponse = await request(baseURL).post('/auth/signup/request-email').send({
        email: testEmail,
        callbackUrl: testCallbackUrl,
      });

      const verificationToken = emailResponse.body.data.mock.verificationToken;

      // Step 2: Verify email
      const verifyResponse = await request(baseURL)
        .get('/auth/signup/verify-email')
        .query({ token: verificationToken });

      expect(verifyResponse.body.data.email).toBe(testEmail);

      // Step 3: Complete profile
      const createResponse = await request(baseURL)
        .post('/auth/signup/complete-profile')
        .query({ token: verifyResponse.body.data.profileToken })
        .send({
          firstName: testData.firstName,
          lastName: testData.lastName,
          username: testData.username,
          password: testData.password,
          confirmPassword: testData.password,
          agreeToTerms: true,
        });

      expect(createResponse.body.data.name).toBe(`${testData.firstName} ${testData.lastName}`);
      const accountId = createResponse.body.data.accountId;

      // Step 4: Verify login works with created account
      const loginResponse = await request(baseURL).post('/auth/login').send({
        email: testEmail,
        password: testData.password,
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.data.accountId).toBe(accountId);

      // Step 5: Verify account data is consistent
      const cookies = loginResponse.headers['set-cookie'] as string[];
      const accountResponse = await request(baseURL).get(`/${accountId}/account`).set('Cookie', cookies);

      expect(accountResponse.body.data.userDetails.email).toBe(testEmail);
      expect(accountResponse.body.data.userDetails.firstName).toBe(testData.firstName);
      expect(accountResponse.body.data.userDetails.lastName).toBe(testData.lastName);
      expect(accountResponse.body.data.userDetails.username).toBe(testData.username);
      expect(accountResponse.body.data.userDetails.emailVerified).toBe(true);
      expect(accountResponse.body.data.accountType).toBe(AccountType.Local);
      expect(accountResponse.body.data.status).toBe(AccountStatus.Active);
    });
  });
});
