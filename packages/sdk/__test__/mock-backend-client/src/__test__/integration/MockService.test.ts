import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MockService } from '../../../src/services/MockService';
import { AccountType, AuthSDKError, EmailTemplate, HealthStatus, MockClientConfig } from '../../../src/types';

// Test configuration - adjust these based on your actual server setup
const TEST_CONFIG: MockClientConfig = {
  baseUrl: process.env.MOCK_SERVER_URL || 'http://localhost:3000',
  timeout: 10000,
  enableLogging: false,
};

describe('MockService Integration Tests', () => {
  let mockService: MockService;
  let testAccountId: string;
  let testToken: string;

  beforeAll(async () => {
    mockService = new MockService(TEST_CONFIG);

    // Generate a proper MongoDB ObjectId format (24 hex characters)
    testAccountId = '507f1f77bcf86cd799439011';

    // Verify server is running by checking health
    try {
      const health = await mockService.ping();
      expect(health.status).toBe('ok');
    } catch (error) {
      throw new Error(`Test server not available at ${TEST_CONFIG.baseUrl}. Please start the mock server.`);
    }
  });

  //   beforeEach(async () => {
  //     // Clean up any existing state before each test
  //     try {
  //       await mockService.clearSession();
  //       await mockService.clearTokens(testAccountId);
  //       await mockService.clearAllEmails();
  //     } catch (error) {
  //       // Ignore cleanup errors
  //     }
  //   });

  afterAll(async () => {
    // Final cleanup
    try {
      await mockService.clearSession();
      await mockService.clearTokens(testAccountId);
      await mockService.clearAllEmails();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Configuration', () => {
    it('should create service with default configuration', () => {
      const service = new MockService({
        baseUrl: 'http://test.com',
      });

      expect(service).toBeInstanceOf(MockService);
    });

    it('should create service with custom headers', () => {
      const serviceConfig: MockClientConfig = {
        baseUrl: 'http://test.com',
        defaultHeaders: {
          'X-API-Key': 'test-key',
          'X-Client-Version': '1.0.0',
          Authorization: 'Bearer token',
        },
      };

      const service = new MockService(serviceConfig);
      expect(service).toBeInstanceOf(MockService);
    });

    it('should create service with authentication headers', () => {
      const authConfig: MockClientConfig = {
        baseUrl: 'http://test.com',
        defaultHeaders: {
          Authorization: 'Bearer eyJhbGciOiJIUzI1NiIs...',
          'X-Session-ID': 'session-123',
          'X-User-ID': 'user-456',
        },
      };

      const service = new MockService(authConfig);
      expect(service).toBeInstanceOf(MockService);
    });
  });

  describe('Session API', () => {
    it('should get session info', async () => {
      const sessionInfo = await mockService.getSessionInfo();

      expect(sessionInfo).toHaveProperty('session');
      expect(sessionInfo).toHaveProperty('authCookies');
      expect(sessionInfo).toHaveProperty('cookieCount');
      expect(sessionInfo).toHaveProperty('userAgent');
      expect(sessionInfo).toHaveProperty('ip');
      expect(sessionInfo).toHaveProperty('timestamp');
      expect(sessionInfo.session).toHaveProperty('hasSession');
      expect(sessionInfo.session).toHaveProperty('accountIds');
      expect(sessionInfo.session).toHaveProperty('currentAccountId');
      expect(sessionInfo.session).toHaveProperty('isValid');
    });

    it('should create a new session', async () => {
      const request = {
        accountIds: [testAccountId],
        currentAccountId: testAccountId,
      };

      const response = await mockService.createSession(request);
      testToken = response.token;

      expect(response).toHaveProperty('message');
      expect(response).toHaveProperty('token');
      expect(response).toHaveProperty('sessionData');
      expect(response.sessionData.accountIds).toContain(testAccountId);
      expect(response.sessionData.currentAccountId).toBe(testAccountId);
      expect(response.token).toBeTruthy();
    });

    it('should validate a session token', async () => {
      // First create a session
      const createRequest = {
        accountIds: [testAccountId],
        currentAccountId: testAccountId,
      };
      const createResponse = await mockService.createSession(createRequest);

      // Then validate it
      const validateRequest = { token: createResponse.token };
      const validateResponse = await mockService.validateSession(validateRequest);

      expect(validateResponse.valid).toBe(true);
      expect(validateResponse.sessionData).toBeTruthy();
      expect(validateResponse.sessionData?.accountIds).toContain(testAccountId);
    });

    it('should update a session', async () => {
      // Create initial session
      const createResponse = await mockService.createSession({
        accountIds: [testAccountId],
        currentAccountId: testAccountId,
      });

      const newAccountId = '507f1f77bcf86cd799439012';

      // Add account to session
      const updateResponse = await mockService.updateSession({
        action: 'add',
        accountId: newAccountId,
      });

      expect(updateResponse.action).toBe('add');
      expect(updateResponse.sessionData.accountIds).toContain(testAccountId);
      expect(updateResponse.sessionData.accountIds).toContain(newAccountId);
    });

    it('should generate multiple sessions', async () => {
      const request = { count: 3, accountsPerSession: 2 };
      const response = await mockService.generateSessions(request);

      expect(response.count).toBe(3);
      expect(response.sessions).toHaveLength(3);

      response.sessions.forEach((session) => {
        expect(session.token).toBeTruthy();
        expect(session.sessionData.accountIds).toHaveLength(2);
        expect(session.sessionData.currentAccountId).toBeTruthy();
      });
    });

    it('should corrupt a session', async () => {
      const request = { type: 'malformed' as const };
      const response = await mockService.corruptSession(request);

      expect(response.type).toBe('malformed');
      expect(response.corruptedToken).toBeTruthy();
      expect(response.message).toBeTruthy();
    });

    it('should clear session', async () => {
      // Create a session first
      await mockService.createSession({
        accountIds: [testAccountId],
        currentAccountId: testAccountId,
      });

      const response = await mockService.clearSession();
      expect(response.cleared).toBe(true);
      expect(response.message).toBeTruthy();
    });

    it('should throw error for invalid session validation', async () => {
      const invalidToken = 'invalid-token';

      await expect(mockService.validateSession({ token: invalidToken })).rejects.toThrow(AuthSDKError);
    });
  });

  describe('Token API', () => {
    it('should get token info', async () => {
      const tokenInfo = await mockService.getTokenInfo();

      expect(tokenInfo).toHaveProperty('tokenCookies');
      expect(tokenInfo).toHaveProperty('tokenCount');
      expect(typeof tokenInfo.tokenCount).toBe('number');
    });

    it('should create access token', async () => {
      const request = {
        accountId: testAccountId,
        accountType: AccountType.Local,
        expiresIn: 3600,
        setCookie: true,
      };

      const response = await mockService.createAccessToken(request);

      expect(response.token).toBeTruthy();
      expect(response.accountId).toBe(testAccountId);
      expect(response.accountType).toBe(AccountType.Local);
      expect(response.setCookie).toBe(true);
    });

    it('should create refresh token', async () => {
      const request = {
        accountId: testAccountId,
        accountType: AccountType.Local,
        setCookie: true,
      };

      const response = await mockService.createRefreshToken(request);

      expect(response.token).toBeTruthy();
      expect(response.accountId).toBe(testAccountId);
      expect(response.accountType).toBe(AccountType.Local);
    });

    it('should create token pair', async () => {
      const request = {
        accountId: testAccountId,
        accountType: AccountType.Local,
        accessTokenExpiresIn: 3600,
        setCookies: true,
      };

      const response = await mockService.createTokenPair(request);

      expect(response.accessToken).toBeTruthy();
      expect(response.refreshToken).toBeTruthy();
      expect(response.accountId).toBe(testAccountId);
      expect(response.accountType).toBe(AccountType.Local);
      expect(response.setCookies).toBe(true);
    });

    it('should validate token', async () => {
      // Create a token first
      const createResponse = await mockService.createAccessToken({
        accountId: testAccountId,
        accountType: AccountType.Local,
      });

      // Validate the token
      const validateResponse = await mockService.validateToken({
        token: createResponse.token,
      });

      expect(validateResponse.valid).toBe(true);
      expect(validateResponse.expired).toBe(false);
      expect(validateResponse.tokenInfo?.accountId).toBe(testAccountId);
    });

    it('should create expired token', async () => {
      const request = {
        accountId: testAccountId,
        accountType: AccountType.Local,
        tokenType: 'access' as const,
        pastSeconds: 3600,
      };

      const response = await mockService.createExpiredToken(request);

      expect(response.token).toBeTruthy();
      expect(response.accountId).toBe(testAccountId);
      expect(response.expiredSeconds).toBe(3600);
    });

    it('should create malformed token', async () => {
      const request = { type: 'invalid_signature' as const };
      const response = await mockService.createMalformedToken(request);

      expect(response.token).toBeTruthy();
      expect(response.type).toBe('invalid_signature');
      expect(response.message).toBeTruthy();
    });

    it('should get token info for account', async () => {
      // Create tokens for the account first
      await mockService.createTokenPair({
        accountId: testAccountId,
        accountType: AccountType.Local,
        setCookies: true,
      });

      const response = await mockService.getTokenInfoForAccount(testAccountId);

      expect(response.accountId).toBe(testAccountId);
      expect(response.accessToken).toHaveProperty('present');
      expect(response.refreshToken).toHaveProperty('present');
    });

    it('should clear tokens for account', async () => {
      // Create tokens first
      await mockService.createTokenPair({
        accountId: testAccountId,
        accountType: AccountType.Local,
        setCookies: true,
      });

      const response = await mockService.clearTokens(testAccountId);

      expect(response.accountId).toBe(testAccountId);
      expect(response.cleared).toBeDefined();
      expect(response.message).toBeTruthy();
    });

    it('should handle OAuth token creation', async () => {
      const request = {
        accountId: testAccountId,
        accountType: AccountType.OAuth,
        oauthAccessToken: 'oauth-access-token',
        oauthRefreshToken: 'oauth-refresh-token',
      };

      const response = await mockService.createAccessToken(request);

      expect(response.token).toBeTruthy();
      expect(response.accountType).toBe(AccountType.OAuth);
    });
  });

  describe('OAuth API', () => {
    it('should get OAuth provider info', async () => {
      const provider = 'google';
      const response = await mockService.getOAuthProviderInfo(provider);

      expect(response.provider).toBe(provider);
      expect(response).toHaveProperty('accountCount');
      expect(response).toHaveProperty('accounts');
      expect(response).toHaveProperty('endpoints');
      expect(response).toHaveProperty('supported');
    });

    it('should clear OAuth mock cache', async () => {
      const response = await mockService.clearOAuthMockCache();
      expect(response.message).toBeTruthy();
    });
  });

  describe('TwoFA API', () => {
    const testSecret = 'JBSWY3DPEHPK3PXP'; // Base32 encoded test secret

    it('should generate TOTP code', async () => {
      const response = await mockService.generateTotpCode(testSecret);

      expect(response.token).toMatch(/^\d{6}$/); // 6-digit code
      expect(response.secret).toBe(testSecret);
      expect(typeof response.timeRemaining).toBe('number');
      expect(typeof response.timeUsed).toBe('number');
    });

    it('should validate TOTP token', async () => {
      // Generate a code first
      const generateResponse = await mockService.generateTotpCode(testSecret);

      // Validate the generated code
      const validateResponse = await mockService.validateTotpToken(testSecret, generateResponse.token);

      expect(validateResponse.valid).toBe(true);
      expect(validateResponse.token).toBe(generateResponse.token);
      expect(validateResponse.secret).toBe(testSecret);
    });

    it('should get account secret', async () => {
      try {
        const response = await mockService.getAccountSecret(testAccountId);

        expect(response.accountId).toBe(testAccountId);
        expect(response.secret).toBeTruthy();
        expect(typeof response.twoFactorEnabled).toBe('boolean');
      } catch (error) {
        // Skip test if account doesn't exist in mock data
        if (error instanceof AuthSDKError && error.message.includes('Account not found')) {
          console.warn('Skipping account secret test - account not found in mock data');
          return;
        }
        throw error;
      }
    });

    it('should generate account TOTP code', async () => {
      try {
        const response = await mockService.generateAccountTotpCode(testAccountId);

        expect(response.accountId).toBe(testAccountId);
        expect(response.token).toMatch(/^\d{6}$/);
        expect(typeof response.twoFactorEnabled).toBe('boolean');
      } catch (error) {
        // Skip test if account doesn't exist in mock data
        if (error instanceof AuthSDKError && error.message.includes('Account not found')) {
          console.warn('Skipping account TOTP test - account not found in mock data');
          return;
        }
        throw error;
      }
    });

    it('should get 2FA cache stats', async () => {
      const response = await mockService.getTwoFACacheStats();

      expect(response.temp).toHaveProperty('size');
      expect(response.temp).toHaveProperty('max');
      expect(response.setup).toHaveProperty('size');
      expect(response.setup).toHaveProperty('max');
    });

    it('should get temp tokens', async () => {
      const response = await mockService.getTwoFATempTokens();

      expect(response.count).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(response.tokens)).toBe(true);
    });

    it('should get setup tokens', async () => {
      const response = await mockService.getTwoFASetupTokens();

      expect(response.count).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(response.tokens)).toBe(true);
    });

    it('should generate backup codes', async () => {
      const request = { count: 8 };
      const response = await mockService.generateTwoFABackupCodes(request);

      expect(response.count).toBe(8);
      expect(response.backupCodes).toHaveLength(8);
      response.backupCodes.forEach((code) => {
        expect(typeof code).toBe('string');
        expect(code.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Email API', () => {
    beforeEach(async () => {
      // Clear emails before each test
      await mockService.clearAllEmails();
    });

    it('should send test email', async () => {
      const emailData = {
        to: 'test@example.com',
        template: EmailTemplate.WELCOME,
        variables: {
          FIRST_NAME: 'Test User',
          WELCOME_MESSAGE: 'Welcome to our platform!',
        },
        metadata: { testId: 'integration-test' },
      };

      const response = await mockService.testSendEmail(emailData);

      expect(response.to).toBe(emailData.to);
      expect(response.template).toBe(emailData.template);
      expect(response.metadata).toEqual(emailData.metadata);
    });

    it('should get sent emails', async () => {
      // Send a test email first
      await mockService.testSendEmail({
        to: 'test@example.com',
        template: EmailTemplate.EMAIL_VERIFICATION,
        variables: {
          FIRST_NAME: 'Test User',
          VERIFICATION_URL: 'https://example.com/verify?token=abc123',
        },
        metadata: { testId: 'get-emails-test' },
      });

      const response = await mockService.getSentEmails();

      expect(response.count).toBeGreaterThan(0);
      expect(Array.isArray(response.emails)).toBe(true);
      expect(response.emails[0]).toHaveProperty('id');
      expect(response.emails[0]).toHaveProperty('to');
      expect(response.emails[0]).toHaveProperty('template');
    });

    it('should get latest email', async () => {
      const testEmail = 'latest@example.com';

      // Send a test email with required variables
      await mockService.testSendEmail({
        to: testEmail,
        template: EmailTemplate.PASSWORD_RESET,
        variables: {
          FIRST_NAME: 'Test User',
          RESET_URL: 'https://example.com/reset?token=abc123',
        },
      });

      const response = await mockService.getLatestEmail(testEmail);

      expect(response.found).toBe(true);
      expect(response.email).toBeTruthy();
      expect(response.email?.to).toBe(testEmail);
      expect(response.email?.template).toBe(EmailTemplate.PASSWORD_RESET);
    });

    it('should get emails by template', async () => {
      const template = EmailTemplate.LOGIN_NOTIFICATION;

      // Send test emails with the template and required variables
      await mockService.testSendEmail({
        to: 'template-test1@example.com',
        template,
        variables: {
          FIRST_NAME: 'Test User 1',
          LOGIN_TIME: new Date().toISOString(),
          IP_ADDRESS: '192.168.1.1',
          DEVICE: 'Chrome on Windows',
        },
      });
      await mockService.testSendEmail({
        to: 'template-test2@example.com',
        template,
        variables: {
          FIRST_NAME: 'Test User 2',
          LOGIN_TIME: new Date().toISOString(),
          IP_ADDRESS: '192.168.1.2',
          DEVICE: 'Firefox on Mac',
        },
      });

      const response = await mockService.getEmailsByTemplate(template);

      expect(response.template).toBe(template);
      expect(response.count).toBeGreaterThanOrEqual(2);
      response.emails.forEach((email) => {
        expect(email.template).toBe(template);
      });
    });

    it('should search emails by metadata', async () => {
      const metadata = { testSuite: 'integration', feature: 'auth' };

      // Send test email with metadata and required variables
      await mockService.testSendEmail({
        to: 'metadata-test@example.com',
        template: EmailTemplate.WELCOME,
        variables: {
          FIRST_NAME: 'Metadata User',
          WELCOME_MESSAGE: 'Welcome!',
        },
        metadata,
      });

      const response = await mockService.searchEmailsByMetadata(metadata);

      expect(response.count).toBeGreaterThan(0);
      response.emails.forEach((email) => {
        expect(email.metadata).toMatchObject(metadata);
      });
    });

    it('should get available templates', async () => {
      const response = await mockService.getAvailableTemplates();

      expect(response.totalTemplates).toBeGreaterThan(0);
      expect(Array.isArray(response.templates)).toBe(true);
      response.templates.forEach((template) => {
        expect(template).toHaveProperty('name');
        expect(template).toHaveProperty('displayName');
        expect(template).toHaveProperty('sentCount');
        expect(template).toHaveProperty('failedCount');
      });
    });

    it('should get metadata insights', async () => {
      // Send some emails with metadata first
      await mockService.testSendEmail({
        to: 'insights1@example.com',
        template: EmailTemplate.WELCOME,
        variables: {
          FIRST_NAME: 'Insights User',
          WELCOME_MESSAGE: 'Welcome to insights!',
        },
        metadata: { testSuite: 'integration', emailFlow: 'signup' },
      });

      const response = await mockService.getMetadataInsights();

      expect(typeof response.totalEmails).toBe('number');
      expect(typeof response.emailsWithMetadata).toBe('number');
      expect(response.uniqueValues).toHaveProperty('testSuites');
      expect(response.uniqueValues).toHaveProperty('emailFlows');
    });

    it('should clear emails with metadata filter', async () => {
      const metadata = { testId: 'clear-test' };

      // Send test email
      await mockService.testSendEmail({
        to: 'clear-test@example.com',
        template: EmailTemplate.WELCOME,
        variables: {
          FIRST_NAME: 'Clear User',
          WELCOME_MESSAGE: 'Welcome!',
        },
        metadata,
      });

      const response = await mockService.clearSentEmails(metadata);

      expect(response.cleared).toBe(true);
      expect(response.clearedCount).toBeGreaterThan(0);
    });

    it('should clear all emails', async () => {
      // Send test emails
      await mockService.testSendEmail({
        to: 'clear-all1@example.com',
        template: EmailTemplate.WELCOME,
        variables: {
          FIRST_NAME: 'Clear User 1',
          WELCOME_MESSAGE: 'Welcome!',
        },
      });
      await mockService.testSendEmail({
        to: 'clear-all2@example.com',
        template: EmailTemplate.WELCOME,
        variables: {
          FIRST_NAME: 'Clear User 2',
          WELCOME_MESSAGE: 'Welcome!',
        },
      });

      const response = await mockService.clearAllEmails();

      expect(response.cleared).toBe(true);
      expect(response.clearedCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Health API', () => {
    it('should get system health', async () => {
      const response = await mockService.getSystemHealth();

      expect(response.status).toBeOneOf([HealthStatus.HEALTHY, HealthStatus.DEGRADED, HealthStatus.UNHEALTHY]);
      expect(response).toHaveProperty('version');
      expect(response).toHaveProperty('timestamp');
      expect(response).toHaveProperty('uptime');
      expect(response).toHaveProperty('environment');
      expect(response).toHaveProperty('components');
      expect(response).toHaveProperty('summary');
    });

    it('should get component health', async () => {
      const component = 'database';
      const response = await mockService.getComponentHealth(component);

      expect(response.name).toBe(component);
      expect(response.status).toBeOneOf([HealthStatus.HEALTHY, HealthStatus.DEGRADED, HealthStatus.UNHEALTHY]);
      expect(response).toHaveProperty('lastCheck');
      expect(typeof response.critical).toBe('boolean');
    });

    it('should ping health endpoint', async () => {
      const response = await mockService.ping();

      expect(response.status).toBeOneOf(['ok', 'error']);
      expect(response).toHaveProperty('timestamp');
    });

    it('should get uptime', async () => {
      const response = await mockService.getUptime();

      expect(typeof response.uptime_ms).toBe('number');
      expect(typeof response.uptime_seconds).toBe('number');
      expect(response).toHaveProperty('uptime_human');
      expect(response).toHaveProperty('timestamp');
    });

    it('should get available checkers', async () => {
      const response = await mockService.getAvailableCheckers();

      expect(Array.isArray(response.checkers)).toBe(true);
      expect(typeof response.count).toBe('number');
      expect(response.count).toBe(response.checkers.length);
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors', async () => {
      await expect(mockService.validateSession({ token: '' })).rejects.toThrow(AuthSDKError);
    });

    it('should handle invalid account ID', async () => {
      await expect(mockService.getTokenInfoForAccount('invalid-id')).rejects.toThrow(AuthSDKError);
    });

    it('should handle missing required fields', async () => {
      await expect(
        mockService.createAccessToken({
          accountId: '',
          accountType: AccountType.Local,
        }),
      ).rejects.toThrow(AuthSDKError);
    });

    it('should handle network errors gracefully', async () => {
      const offlineService = new MockService({
        baseUrl: 'http://localhost:9999', // Non-existent server
        timeout: 1000,
      });

      await expect(offlineService.getSystemHealth()).rejects.toThrow(AuthSDKError);
    });
  });

  describe('Custom Headers', () => {
    it('should work with authentication headers', async () => {
      const authService = new MockService({
        baseUrl: TEST_CONFIG.baseUrl,
        defaultHeaders: {
          Authorization: 'Bearer test-token',
          'X-API-Key': 'test-api-key',
          'X-Session-ID': 'test-session',
        },
      });

      const response = await authService.ping();
      expect(response.status).toBe('ok');
    });

    it('should work with tracking headers', async () => {
      const trackingService = new MockService({
        baseUrl: TEST_CONFIG.baseUrl,
        defaultHeaders: {
          'X-Request-ID': 'req-12345',
          'X-Correlation-ID': 'corr-67890',
          'X-Trace-ID': 'trace-abcde',
        },
      });

      const response = await trackingService.ping();
      expect(response.status).toBe('ok');
    });

    it('should work with client headers', async () => {
      const clientService = new MockService({
        baseUrl: TEST_CONFIG.baseUrl,
        defaultHeaders: {
          'X-Client-Version': '1.2.3',
          'X-Application-ID': 'test-app',
          'User-Agent': 'TestApp/1.2.3',
        },
      });

      const response = await clientService.ping();
      expect(response.status).toBe('ok');
    });
  });
});
