import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { InternalApiSdk } from '../../src';
import { InternalHttpClient } from '../../src';
import { mockTokenVerificationResponse, mockUserResponse, mockAccount } from '../helpers/mock-data';

describe('SDK Integration Tests (Unit Level)', () => {
  let app: express.Application;
  let sdk: InternalApiSdk;
  let httpClient: InternalHttpClient;

  beforeEach(() => {
    // Create HTTP client with dummy config (won't make real requests)
    httpClient = new InternalHttpClient({
      baseUrl: 'http://localhost:3000',
      serviceId: 'test-service',
      serviceSecret: 'test-secret',
      enableLogging: false,
    });

    sdk = new InternalApiSdk({
      httpClient,
      enableLogging: false,
      accountServerBaseUrl: 'http://localhost:3000',
    });

    app = express();
    app.use(express.json());
    app.use(cookieParser());

    // Mock all HTTP client methods to avoid real network calls
    vi.spyOn(httpClient, 'verifyToken').mockResolvedValue(mockTokenVerificationResponse);
    vi.spyOn(httpClient, 'getUserById').mockResolvedValue(mockUserResponse);
    vi.spyOn(httpClient, 'checkUserExists').mockResolvedValue({ exists: true, accountId: '507f1f77bcf86cd799439011' });
    vi.spyOn(httpClient, 'getSessionInfo').mockResolvedValue({
      session: {
        accountIds: ['507f1f77bcf86cd799439011'],
        currentAccountId: '507f1f77bcf86cd799439011',
        sessionId: 'session_123',
        createdAt: '2024-01-01T00:00:00.000Z',
        lastActivity: '2024-01-01T01:00:00.000Z',
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Core Authentication Flows', () => {
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

    it('should handle authentication without loading user', async () => {
      app.use(...sdk.authenticate({ loadUser: false }));
      app.get('/protected', (req, res) => {
        res.json({
          success: true,
          tokenData: req.tokenData,
          user: req.currentUser,
        });
      });

      const response = await request(app).get('/protected').set('Authorization', 'Bearer valid_token').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.tokenData).toBeDefined();
      expect(response.body.user).toBeUndefined();
    });

    it('should handle invalid tokens with proper error responses', async () => {
      // Mock invalid token response
      vi.spyOn(httpClient, 'verifyToken').mockResolvedValue({
        ...mockTokenVerificationResponse,
        valid: false,
        error: 'Invalid token',
      });

      app.use(...sdk.authenticate());
      app.get('/protected', (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/protected').set('Authorization', 'Bearer invalid_token').expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TOKEN_INVALID');
    });
  });

  describe('Individual Middleware Components', () => {
    beforeEach(() => {
      app.use(sdk.injectClients());
    });

    describe('verifyAccessToken middleware', () => {
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
        app.get(
          '/test/:accountId',
          sdk.verifyAccessToken({
            fromHeader: false,
            fromCookie: true,
            accountIdParam: 'accountId',
          }),
          (req, res) => {
            expect(req.accessToken).toBe('cookie_token');
            res.json({ success: true });
          },
        );

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
    });

    describe('loadUser middleware', () => {
      beforeEach(() => {
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
    });

    describe('validateAccountAccess middleware', () => {
      beforeEach(() => {
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
        app.get('/test/:accountId', sdk.validateAccountAccess('accountId'), (req, res) => {
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

      it('should deny access to different account', async () => {
        app.get('/test/:accountId', sdk.validateAccountAccess('accountId'), (req, res) => {
          res.json({ success: true });
        });

        const response = await request(app).get('/test/different_account_id').expect(403);
        expect(response.body.error.code).toBe('PERMISSION_DENIED');
      });

      it('should handle non-existent account', async () => {
        vi.spyOn(httpClient, 'checkUserExists').mockResolvedValue({
          exists: false,
          accountId: 'nonexistent',
        });

        app.get('/test/:accountId', sdk.validateAccountAccess('accountId'), (req, res) => {
          res.json({ success: true });
        });

        const response = await request(app).get('/test/nonexistent').expect(404);
        expect(response.body.error.code).toBe('USER_NOT_FOUND');
      });
    });

    describe('requirePermission middleware', () => {
      beforeEach(() => {
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

    describe('loadSession middleware', () => {
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

      it('should continue when session not required and missing', async () => {
        app.use(sdk.loadSession({ required: false }));
        app.get('/test', (req, res) => {
          expect(req.sessionInfo).toBeUndefined();
          res.json({ success: true });
        });

        await request(app).get('/test').expect(200);
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
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      app.use(sdk.injectClients());
    });

    it('should handle service errors gracefully', async () => {
      vi.spyOn(httpClient, 'verifyToken').mockRejectedValue(new Error('Service unavailable'));

      app.use(sdk.verifyAccessToken());
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      await request(app).get('/test').set('Authorization', 'Bearer valid_token').expect(401);
    });

    it('should handle user loading errors', async () => {
      vi.spyOn(httpClient, 'getUserById').mockRejectedValue(new Error('Database connection failed'));

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
      app.use(sdk.loadUser());
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      await request(app).get('/test').expect(500);
    });

    it('should handle validation errors gracefully', async () => {
      vi.spyOn(httpClient, 'checkUserExists').mockRejectedValue(new Error('Database connection failed'));

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
      app.get('/test/:accountId', sdk.validateAccountAccess('accountId'), (req, res) => {
        res.json({ success: true });
      });

      await request(app).get('/test/507f1f77bcf86cd799439011').expect(500);
    });
  });
});
