import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { TestServer } from '../helpers/test-server';
import { InternalApiSdk } from '../../src';
import { InternalHttpClient } from '../../src';
import { mockTokenVerificationResponse, mockUserResponse, mockAccount } from '../helpers/mock-data';

describe('SDK Integration Tests', () => {
  let app: express.Application;
  let testServer: TestServer;
  let serverPort: number;
  let sdk: InternalApiSdk;

  beforeEach(async () => {
    testServer = new TestServer();
    serverPort = await testServer.start();

    const httpClient = new InternalHttpClient({
      baseUrl: `http://localhost:${serverPort}`,
      serviceId: 'test-service',
      serviceSecret: 'test-secret',
      enableLogging: false,
    });

    sdk = new InternalApiSdk({
      httpClient,
      enableLogging: false,
      accountServerBaseUrl: `http://localhost:${serverPort}`,
    });

    app = express();
    app.use(express.json());
    app.use(cookieParser());
  });

  afterEach(async () => {
    await testServer.stop();
  });

  it('should handle complete authentication flow', async () => {
    app.use(...sdk.authenticate());
    app.get('/protected', (req, res) => {
      res.json({
        success: true,
        user: req.currentUser,
        tokenData: req.tokenData,
      });
    });

    const response = await request(app).get('/protected').set('Authorization', 'Bearer valid_token').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.user).toBeDefined();
    expect(response.body.tokenData.valid).toBe(true);
  });

  it('should handle complete authorization flow', async () => {
    app.use(...sdk.authorize());
    app.get('/admin/:accountId', (req, res) => {
      res.json({
        success: true,
        user: req.currentUser,
        session: req.sessionInfo,
        accountId: req.params.accountId,
      });
    });

    const response = await request(app)
      .get('/admin/507f1f77bcf86cd799439011')
      .set('Authorization', 'Bearer valid_token')
      .set('Cookie', 'account_session=session_cookie')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.user).toBeDefined();
    expect(response.body.session).toBeDefined();
    expect(response.body.accountId).toBe('507f1f77bcf86cd799439011');
  });

  it('should handle invalid tokens with proper error responses', async () => {
    app.use(...sdk.authenticate());
    app.get('/protected', (req, res) => {
      res.json({ success: true });
    });

    const response = await request(app).get('/protected').set('Authorization', 'Bearer invalid_token').expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('TOKEN_INVALID');
  });

  it('should handle service unavailability gracefully', async () => {
    // Stop the test server to simulate service unavailability
    await testServer.stop();

    app.use(...sdk.authenticate());
    app.get('/protected', (req, res) => {
      res.json({ success: true });
    });

    const response = await request(app).get('/protected').set('Authorization', 'Bearer valid_token').expect(503);

    expect(response.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  describe('verifyAccessToken middleware', () => {
    let httpClient: InternalHttpClient;

    beforeEach(() => {
      httpClient = sdk.httpClient;
      app.use(sdk.injectClients());
    });

    it('should verify token from Authorization header', async () => {
      app.use(sdk.verifyAccessToken());
      app.get('/test', (req, res) => {
        expect(req.accessToken).toBe('valid_token');
        expect(req.tokenData?.valid).toBe(true);
        expect(req.tokenData?.accountId).toBe('507f1f77bcf86cd799439011');
        res.json({ success: true });
      });

      await request(app).get('/test').set('Authorization', 'Bearer valid_token').expect(200);

      expect(httpClient.verifyToken).toHaveBeenCalledWith('valid_token', 'access');
    });

    it('should verify token from cookies', async () => {
      app.use(
        sdk.verifyAccessToken({
          fromHeader: false,
          fromCookie: true,
          accountIdParam: 'accountId',
        }),
      );
      app.get('/test/:accountId', (req, res) => {
        expect(req.accessToken).toBe('cookie_token');
        res.json({ success: true });
      });

      await request(app)
        .get('/test/507f1f77bcf86cd799439011')
        .set('Cookie', '507f1f77bcf86cd799439011_access_token=cookie_token')
        .expect(200);
    });

    it('should handle missing token when required', async () => {
      app.use(sdk.verifyAccessToken({ required: true }));
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test').expect(401);
      expect(response.body.error.code).toBe('TOKEN_INVALID');
      expect(response.body.error.message).toBe('Access token required');
    });

    it('should continue when token not required and missing', async () => {
      app.use(sdk.verifyAccessToken({ required: false }));
      app.get('/test', (req, res) => {
        expect(req.accessToken).toBeUndefined();
        res.json({ success: true });
      });

      await request(app).get('/test').expect(200);
    });

    it('should handle invalid token', async () => {
      vi.spyOn(httpClient, 'verifyToken').mockResolvedValue({
        ...mockTokenVerificationResponse,
        valid: false,
        error: 'Token expired',
      });

      app.use(sdk.verifyAccessToken());
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      await request(app).get('/test').set('Authorization', 'Bearer invalid_token').expect(401);
    });

    it('should redirect to token refresh on expired token', async () => {
      vi.spyOn(httpClient, 'verifyToken').mockRejectedValue(new Error('Token expired'));

      app.use(sdk.verifyAccessToken({ accountIdParam: 'accountId' }));
      app.get('/test/:accountId', (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/test/507f1f77bcf86cd799439011')
        .set('Authorization', 'Bearer expired_token')
        .expect(302);

      expect(response.headers.location).toContain('/tokens/refresh');
    });
  });

  describe('loadUser middleware', () => {
    let httpClient: InternalHttpClient;

    beforeEach(() => {
      httpClient = sdk.httpClient;
      app.use(sdk.injectClients());
      app.use((req, res, next) => {
        req.tokenData = {
          valid: true,
          accountId: '507f1f77bcf86cd799439011',
          accountType: 'oauth',
          isRefreshToken: false,
          expiresAt: Date.now() + 3600000,
        };
        next();
      });
    });

    it('should load user successfully', async () => {
      app.use(sdk.loadUser());
      app.get('/test', (req, res) => {
        expect(req.currentUser).toEqual(mockAccount);
        res.json({ success: true });
      });

      await request(app).get('/test').expect(200);
      expect(httpClient.getUserById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });

    it('should handle missing token data when required', async () => {
      app.use((req, res, next) => {
        req.tokenData = undefined;
        next();
      });
      app.use(sdk.loadUser({ required: true }));
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test').expect(401);
      expect(response.body.error.code).toBe('AUTH_FAILED');
    });

    it('should continue when user not required and token missing', async () => {
      app.use((req, res, next) => {
        req.tokenData = undefined;
        next();
      });
      app.use(sdk.loadUser({ required: false }));
      app.get('/test', (req, res) => {
        expect(req.currentUser).toBeUndefined();
        res.json({ success: true });
      });

      await request(app).get('/test').expect(200);
    });

    it('should handle user not found', async () => {
      vi.spyOn(httpClient, 'getUserById').mockRejectedValue(new Error('User not found'));

      app.use(sdk.loadUser());
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      await request(app).get('/test').expect(500);
    });
  });

  describe('validateAccountAccess middleware', () => {
    let httpClient: InternalHttpClient;

    beforeEach(() => {
      httpClient = sdk.httpClient;
      app.use(sdk.injectClients());
      app.use((req, res, next) => {
        req.tokenData = {
          valid: true,
          accountId: '507f1f77bcf86cd799439011',
          accountType: 'oauth',
          isRefreshToken: false,
          expiresAt: Date.now() + 3600000,
        };
        next();
      });
    });

    it('should validate account access successfully', async () => {
      app.use(sdk.validateAccountAccess('accountId'));
      app.get('/test/:accountId', (req, res) => {
        res.json({ success: true });
      });

      await request(app).get('/test/507f1f77bcf86cd799439011').expect(200);
      expect(httpClient.checkUserExists).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });

    it('should handle missing account ID parameter', async () => {
      app.use(sdk.validateAccountAccess('accountId'));
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test').expect(400);
      expect(response.body.error.code).toBe('MISSING_DATA');
    });

    it('should handle non-existent account', async () => {
      vi.spyOn(httpClient, 'checkUserExists').mockResolvedValue({
        exists: false,
        accountId: 'nonexistent',
      });

      app.use(sdk.validateAccountAccess('accountId'));
      app.get('/test/:accountId', (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test/nonexistent').expect(404);
      expect(response.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('should deny access to different account', async () => {
      app.use(sdk.validateAccountAccess('accountId'));
      app.get('/test/:accountId', (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test/different_account_id').expect(403);
      expect(response.body.error.code).toBe('PERMISSION_DENIED');
    });
  });

  describe('loadSession middleware', () => {
    let httpClient: InternalHttpClient;

    beforeEach(() => {
      httpClient = sdk.httpClient;
      app.use(sdk.injectClients());
    });

    it('should load session successfully', async () => {
      app.use(sdk.loadSession());
      app.get('/test', (req, res) => {
        expect(req.sessionInfo).toBeDefined();
        res.json({ success: true });
      });

      await request(app).get('/test').set('Cookie', 'account_session=session_cookie').expect(200);

      expect(httpClient.getSessionInfo).toHaveBeenCalledWith('session_cookie');
    });

    it('should handle missing session when required', async () => {
      app.use(sdk.loadSession({ required: true }));
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test').expect(401);
      expect(response.body.error.code).toBe('AUTH_FAILED');
    });

    it('should validate account in session', async () => {
      app.use((req, res, next) => {
        req.tokenData = {
          valid: true,
          accountId: '507f1f77bcf86cd799439011',
          accountType: 'oauth',
          isRefreshToken: false,
          expiresAt: Date.now() + 3600000,
        };
        next();
      });
      app.use(sdk.loadSession({ validateAccount: true }));
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      await request(app).get('/test').set('Cookie', 'account_session=session_cookie').expect(200);
    });

    it('should deny access when account not in session', async () => {
      vi.spyOn(httpClient, 'getSessionInfo').mockResolvedValue({
        session: {
          accountIds: ['different_account_id'],
          currentAccountId: 'different_account_id',
          sessionId: 'session_123',
          createdAt: '2024-01-01T00:00:00.000Z',
          lastActivity: '2024-01-01T01:00:00.000Z',
        },
      });

      app.use((req, res, next) => {
        req.tokenData = {
          valid: true,
          accountId: '507f1f77bcf86cd799439011',
          accountType: 'oauth',
          isRefreshToken: false,
          expiresAt: Date.now() + 3600000,
        };
        next();
      });
      app.use(sdk.loadSession({ validateAccount: true }));
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test').set('Cookie', 'account_session=session_cookie').expect(403);

      expect(response.body.error.code).toBe('PERMISSION_DENIED');
    });
  });

  describe('requirePermission middleware', () => {
    beforeEach(() => {
      app.use(sdk.injectClients());
      app.use((req, res, next) => {
        req.currentUser = mockAccount;
        next();
      });
    });

    it('should allow access with correct account type', async () => {
      app.use(sdk.requirePermission({ accountTypes: ['OAuth'] }));
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      await request(app).get('/test').expect(200);
    });

    it('should deny access with incorrect account type', async () => {
      app.use(sdk.requirePermission({ accountTypes: ['Local'] }));
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test').expect(403);
      expect(response.body.error.code).toBe('PERMISSION_DENIED');
    });

    it('should require email verification', async () => {
      app.use(sdk.requirePermission({ emailVerified: true }));
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      await request(app).get('/test').expect(200);
    });

    it('should deny access without email verification', async () => {
      app.use((req, res, next) => {
        req.currentUser = { ...mockAccount, isEmailVerified: false };
        next();
      });
      app.use(sdk.requirePermission({ emailVerified: true }));
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test').expect(403);
      expect(response.body.error.code).toBe('PERMISSION_DENIED');
    });

    it('should use custom validator', async () => {
      const customValidator = vi.fn().mockReturnValue(true);

      app.use(sdk.requirePermission({ customValidator }));
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      await request(app).get('/test').expect(200);
      expect(customValidator).toHaveBeenCalledWith(mockAccount);
    });

    it('should deny access with failing custom validator', async () => {
      const customValidator = vi.fn().mockReturnValue(false);

      app.use(sdk.requirePermission({ customValidator }));
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test').expect(403);
      expect(response.body.error.code).toBe('PERMISSION_DENIED');
    });

    it('should handle missing user data', async () => {
      app.use((req, res, next) => {
        req.currentUser = undefined;
        next();
      });
      app.use(sdk.requirePermission({ accountTypes: ['OAuth'] }));
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test').expect(401);
      expect(response.body.error.code).toBe('AUTH_FAILED');
    });
  });

  describe('convenience middleware combinations', () => {
    it('should authenticate with default options', async () => {
      const middlewares = sdk.authenticate();
      expect(middlewares).toHaveLength(3); // injectClients, verifyAccessToken, loadUser

      app.use(...middlewares);
      app.get('/test', (req, res) => {
        expect(req.internalApi).toBeDefined();
        expect(req.tokenData).toBeDefined();
        expect(req.currentUser).toBeDefined();
        res.json({ success: true });
      });

      await request(app).get('/test').set('Authorization', 'Bearer valid_token').expect(200);
    });
  });
});
