import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { InternalApiSdk, InternalHttpClient, InternalSocketClient } from '../../src';
import { mockTokenVerificationResponse, mockUserResponse, mockSessionResponse } from '../helpers/mock-data';

describe('InternalApiSdk Middleware', () => {
  let app: express.Application;
  let httpClient: InternalHttpClient;
  let socketClient: InternalSocketClient;
  let sdk: InternalApiSdk;

  const config = {
    baseUrl: 'https://api.example.com',
    serviceId: 'test-service',
    serviceSecret: 'test-secret',
    timeout: 5000,
    enableLogging: false,
  };

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());

    httpClient = new InternalHttpClient(config);
    socketClient = new InternalSocketClient({
      ...config,
      serviceName: 'Test Service',
    });

    sdk = new InternalApiSdk({
      httpClient,
      socketClient,
      enableLogging: false,
      preferSocket: false,
      accountServerBaseUrl: 'https://account.example.com',
    });

    // Mock all HTTP client methods
    vi.spyOn(httpClient, 'verifyToken').mockResolvedValue(mockTokenVerificationResponse);
    vi.spyOn(httpClient, 'getUserById').mockResolvedValue(mockUserResponse);
    vi.spyOn(httpClient, 'checkUserExists').mockResolvedValue({ exists: true, accountId: '507f1f77bcf86cd799439011' });
    vi.spyOn(httpClient, 'getSessionInfo').mockResolvedValue(mockSessionResponse);
    vi.spyOn(httpClient, 'validateSession').mockResolvedValue({
      session: mockSessionResponse.session,
      accountId: '507f1f77bcf86cd799439011',
      isAccountInSession: true,
      isCurrentAccount: true,
    });

    // Mock socket client
    vi.spyOn(socketClient, 'isConnected').mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Core middleware functionality', () => {
    it('should inject HTTP and Socket clients into request', async () => {
      app.use(sdk.injectClients());
      app.get('/test', (req, res) => {
        expect(req.internalApi?.http).toBe(httpClient);
        expect(req.internalApi?.socket).toBe(socketClient);
        res.json({ success: true });
      });

      await request(app).get('/test').set('Authorization', 'Bearer valid_token').expect(200);
    });

    it('should authenticate without loading user', async () => {
      const middlewares = sdk.authenticate({ loadUser: false });
      expect(middlewares).toHaveLength(2); // injectClients, verifyAccessToken

      app.use(...middlewares);
      app.get('/test', (req, res) => {
        expect(req.internalApi).toBeDefined();
        expect(req.tokenData).toBeDefined();
        expect(req.currentUser).toBeUndefined();
        res.json({ success: true });
      });

      await request(app).get('/test').set('Authorization', 'Bearer valid_token').expect(200);
    });

    it('should authorize with full validation', async () => {
      const middlewares = sdk.authorize();
      expect(middlewares).toHaveLength(5); // All middleware

      app.use(...middlewares);
      app.get('/test/:accountId', (req, res) => {
        expect(req.internalApi).toBeDefined();
        expect(req.tokenData).toBeDefined();
        expect(req.currentUser).toBeDefined();
        expect(req.sessionInfo).toBeDefined();
        res.json({ success: true });
      });

      await request(app)
        .get('/test/507f1f77bcf86cd799439011')
        .set('Authorization', 'Bearer valid_token')
        .set('Cookie', 'account_session=session_cookie')
        .expect(200);
    });
  });

  describe('Client selection override', () => {
    it('should force HTTP client usage', async () => {
      vi.spyOn(socketClient, 'isConnected').mockReturnValue(true);

      const httpSdk = sdk.useHttp();

      app.use(httpSdk.verifyAccessToken());
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      await request(app).get('/test').set('Authorization', 'Bearer valid_token').expect(200);

      expect(httpClient.verifyToken).toHaveBeenCalled();

      // Restore original preference
      httpSdk.restore();
    });

    it('should force Socket client usage when connected', async () => {
      vi.spyOn(socketClient, 'isConnected').mockReturnValue(true);
      vi.spyOn(socketClient, 'verifyToken').mockImplementation((token, type, callback) => {
        callback({ success: true, data: mockTokenVerificationResponse });
      });

      const socketSdk = sdk.useSocket();

      app.use(socketSdk.verifyAccessToken());
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });

      await request(app).get('/test').set('Authorization', 'Bearer valid_token').expect(200);

      expect(socketClient.verifyToken).toHaveBeenCalled();

      // Restore original preference
      socketSdk.restore();
    });
  });

  describe('Token extraction utilities', () => {
    it('should extract token from Authorization header', () => {
      const extractTokenFromHeader = sdk['extractTokenFromHeader'];
      const mockReq = {
        headers: {
          authorization: 'Bearer test_token',
        },
      } as any;

      expect(extractTokenFromHeader(mockReq, 'access')).toBe('test_token');
    });

    it('should extract refresh token from custom header', () => {
      const extractTokenFromHeader = sdk['extractTokenFromHeader'];
      const mockReq = {
        headers: {
          'x-refresh-token': 'refresh_token',
        },
      } as any;

      expect(extractTokenFromHeader(mockReq, 'refresh')).toBe('refresh_token');
    });

    it('should extract token from cookies', () => {
      const extractTokenFromCookie = sdk['extractTokenFromCookie'];
      const mockReq = {
        cookies: {
          access_token: 'cookie_token',
          '507f1f77bcf86cd799439011_access_token': 'account_token',
        },
      } as any;

      expect(extractTokenFromCookie(mockReq, undefined, 'access')).toBe('cookie_token');
      expect(extractTokenFromCookie(mockReq, '507f1f77bcf86cd799439011', 'access')).toBe('account_token');
    });

    it('should return null when no token found', () => {
      const extractTokenFromHeader = sdk['extractTokenFromHeader'];
      const extractTokenFromCookie = sdk['extractTokenFromCookie'];

      const mockReq = {
        headers: {},
        cookies: {},
      } as any;

      expect(extractTokenFromHeader(mockReq, 'access')).toBeNull();
      expect(extractTokenFromCookie(mockReq, undefined, 'access')).toBeNull();
    });
  });

  describe('Refresh URL building', () => {
    it('should build correct refresh URL', () => {
      const buildRefreshUrl = sdk['buildRefreshUrl'];
      const mockReq = {
        originalUrl: '/api/test/endpoint',
      } as any;

      const accountId = '507f1f77bcf86cd799439011';
      const refreshUrl = buildRefreshUrl(mockReq, accountId);

      expect(refreshUrl).toBe(
        'https://account.example.com/507f1f77bcf86cd799439011/tokens/refresh?redirectUrl=%2Fapi%2Ftest%2Fendpoint',
      );
    });

    it('should throw error when account server URL not configured', () => {
      const sdkWithoutUrl = new InternalApiSdk({
        httpClient,
        socketClient,
        enableLogging: false,
      });

      const buildRefreshUrl = sdkWithoutUrl['buildRefreshUrl'];
      const mockReq = { originalUrl: '/test' } as any;

      expect(() => buildRefreshUrl(mockReq, '123')).toThrow('Account server base URL not configured');
    });
  });
});
