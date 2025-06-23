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
  });

  describe('Individual Middleware Components', () => {
    let httpClient: InternalHttpClient;

    beforeEach(() => {
      httpClient = sdk.httpClient;
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

      it('should deny access to different account', async () => {
        app.use(sdk.validateAccountAccess('accountId'));
        app.get('/test/:accountId', (req, res) => {
          res.json({ success: true });
        });

        const response = await request(app).get('/test/different_account_id').expect(403);
        expect(response.body.error.code).toBe('PERMISSION_DENIED');
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
  });
});
