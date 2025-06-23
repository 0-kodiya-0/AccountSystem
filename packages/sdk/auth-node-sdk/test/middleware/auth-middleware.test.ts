import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InternalApiSdk, InternalHttpClient, InternalSocketClient } from '../../src';
import { mockTokenVerificationResponse, mockUserResponse, mockSessionResponse } from '../helpers/mock-data';

describe('InternalApiSdk Middleware (Unit Tests)', () => {
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

    // Mock all HTTP client methods to avoid real network calls
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

  describe('SDK configuration and setup', () => {
    it('should create SDK with correct configuration', () => {
      expect(sdk).toBeInstanceOf(InternalApiSdk);
      expect(sdk.httpClient).toBe(httpClient);
      expect(sdk.socketClient).toBe(socketClient);
    });

    it('should create SDK with minimal configuration', () => {
      const minimalSdk = new InternalApiSdk({
        httpClient,
        enableLogging: false,
      });

      expect(minimalSdk.httpClient).toBe(httpClient);
      expect(minimalSdk.socketClient).toBeUndefined();
    });
  });

  describe('Client selection logic', () => {
    it('should use HTTP client when socket not connected', () => {
      vi.spyOn(socketClient, 'isConnected').mockReturnValue(false);

      expect(sdk['shouldUseSocket']()).toBe(false);
    });

    it('should use socket client when connected and preferred', () => {
      const socketSdk = new InternalApiSdk({
        httpClient,
        socketClient,
        preferSocket: true,
      });

      vi.spyOn(socketClient, 'isConnected').mockReturnValue(true);

      expect(socketSdk['shouldUseSocket']()).toBe(true);
    });

    it('should use HTTP client when socket not available', () => {
      const httpOnlySdk = new InternalApiSdk({
        httpClient,
        preferSocket: true, // Prefer socket but none available
      });

      expect(httpOnlySdk['shouldUseSocket']()).toBe(false);
    });
  });

  describe('Token extraction utilities', () => {
    it('should extract token from Authorization header', () => {
      const extractTokenFromHeader = sdk['extractTokenFromHeader'].bind(sdk);
      const mockReq = {
        headers: {
          authorization: 'Bearer test_token',
        },
      } as any;

      expect(extractTokenFromHeader(mockReq, 'access')).toBe('test_token');
    });

    it('should extract refresh token from custom header', () => {
      const extractTokenFromHeader = sdk['extractTokenFromHeader'].bind(sdk);
      const mockReq = {
        headers: {
          'x-refresh-token': 'refresh_token',
        },
      } as any;

      expect(extractTokenFromHeader(mockReq, 'refresh')).toBe('refresh_token');
    });

    it('should return null for invalid Authorization header', () => {
      const extractTokenFromHeader = sdk['extractTokenFromHeader'].bind(sdk);
      const mockReq = {
        headers: {
          authorization: 'Invalid header format',
        },
      } as any;

      expect(extractTokenFromHeader(mockReq, 'access')).toBeNull();
    });

    it('should extract token from cookies', () => {
      const extractTokenFromCookie = sdk['extractTokenFromCookie'].bind(sdk);
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
      const extractTokenFromHeader = sdk['extractTokenFromHeader'].bind(sdk);
      const extractTokenFromCookie = sdk['extractTokenFromCookie'].bind(sdk);

      const mockReq = {
        headers: {},
        cookies: {},
      } as any;

      expect(extractTokenFromHeader(mockReq, 'access')).toBeNull();
      expect(extractTokenFromCookie(mockReq, undefined, 'access')).toBeNull();
    });

    it('should handle missing cookies object', () => {
      const extractTokenFromCookie = sdk['extractTokenFromCookie'].bind(sdk);
      const mockReq = {} as any;

      expect(extractTokenFromCookie(mockReq, undefined, 'access')).toBeNull();
    });
  });

  describe('Refresh URL building', () => {
    it('should build correct refresh URL', () => {
      const buildRefreshUrl = sdk['buildRefreshUrl'].bind(sdk);
      const mockReq = {
        originalUrl: '/api/test/endpoint',
      } as any;

      const accountId = '507f1f77bcf86cd799439011';
      const refreshUrl = buildRefreshUrl(mockReq, accountId);

      expect(refreshUrl).toBe(
        'https://account.example.com/507f1f77bcf86cd799439011/tokens/refresh?redirectUrl=%2Fapi%2Ftest%2Fendpoint',
      );
    });

    it('should handle URLs with query parameters', () => {
      const buildRefreshUrl = sdk['buildRefreshUrl'].bind(sdk);
      const mockReq = {
        originalUrl: '/api/test?param=value&other=123',
      } as any;

      const accountId = '507f1f77bcf86cd799439011';
      const refreshUrl = buildRefreshUrl(mockReq, accountId);

      expect(refreshUrl).toBe(
        'https://account.example.com/507f1f77bcf86cd799439011/tokens/refresh?redirectUrl=%2Fapi%2Ftest%3Fparam%3Dvalue%26other%3D123',
      );
    });

    it('should throw error when account server URL not configured', () => {
      const sdkWithoutUrl = new InternalApiSdk({
        httpClient,
        socketClient,
        enableLogging: false,
      });

      const buildRefreshUrl = sdkWithoutUrl['buildRefreshUrl'].bind(sdkWithoutUrl);
      const mockReq = { originalUrl: '/test' } as any;

      expect(() => buildRefreshUrl(mockReq, '123')).toThrow('Account server base URL not configured');
    });

    it('should throw error when account ID missing', () => {
      const buildRefreshUrl = sdk['buildRefreshUrl'].bind(sdk);
      const mockReq = { originalUrl: '/test' } as any;

      expect(() => buildRefreshUrl(mockReq, '')).toThrow('Account ID is required');
    });
  });

  describe('Middleware creation', () => {
    it('should create inject clients middleware', () => {
      const middleware = sdk.injectClients();
      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(3); // req, res, next
    });

    it('should create verify access token middleware', () => {
      const middleware = sdk.verifyAccessToken();
      expect(typeof middleware).toBe('function');
    });

    it('should create load user middleware', () => {
      const middleware = sdk.loadUser();
      expect(typeof middleware).toBe('function');
    });

    it('should create validate account access middleware', () => {
      const middleware = sdk.validateAccountAccess();
      expect(typeof middleware).toBe('function');
    });

    it('should create load session middleware', () => {
      const middleware = sdk.loadSession();
      expect(typeof middleware).toBe('function');
    });

    it('should create require permission middleware', () => {
      const middleware = sdk.requirePermission({ accountTypes: ['OAuth'] });
      expect(typeof middleware).toBe('function');
    });
  });

  describe('Middleware combinations', () => {
    it('should create authenticate middleware combination', () => {
      const middlewares = sdk.authenticate();
      expect(Array.isArray(middlewares)).toBe(true);
      expect(middlewares).toHaveLength(3); // injectClients, verifyAccessToken, loadUser
    });

    it('should create authenticate middleware without loading user', () => {
      const middlewares = sdk.authenticate({ loadUser: false });
      expect(middlewares).toHaveLength(2); // injectClients, verifyAccessToken
    });

    it('should create authorize middleware combination', () => {
      const middlewares = sdk.authorize();
      expect(Array.isArray(middlewares)).toBe(true);
      expect(middlewares).toHaveLength(5); // All middleware
    });

    it('should create authorize middleware with custom options', () => {
      const middlewares = sdk.authorize({
        accountIdParam: 'userId',
        sessionCookieName: 'custom_session',
        validateSessionAccount: false,
      });
      expect(middlewares).toHaveLength(5);
    });
  });

  describe('Client selection override', () => {
    it('should force HTTP client usage', () => {
      vi.spyOn(socketClient, 'isConnected').mockReturnValue(true);

      const httpSdk = sdk.useHttp();

      expect(typeof httpSdk.verifyAccessToken).toBe('function');
      expect(typeof httpSdk.loadUser).toBe('function');
      expect(typeof httpSdk.restore).toBe('function');

      // Should use HTTP even though socket is connected
      expect(sdk['shouldUseSocket']()).toBe(false);

      // Restore original preference
      httpSdk.restore();
      expect(sdk['shouldUseSocket']()).toBe(false); // Original was false
    });

    it('should force Socket client usage', () => {
      vi.spyOn(socketClient, 'isConnected').mockReturnValue(true);

      const socketSdk = sdk.useSocket();

      expect(typeof socketSdk.verifyAccessToken).toBe('function');
      expect(typeof socketSdk.loadUser).toBe('function');
      expect(typeof socketSdk.restore).toBe('function');

      // Should use socket when connected
      expect(sdk['shouldUseSocket']()).toBe(true);

      // Restore original preference
      socketSdk.restore();
      expect(sdk['shouldUseSocket']()).toBe(false); // Original was false
    });
  });

  describe('Error handling utilities', () => {
    it('should handle token errors with redirect', () => {
      const mockReq = { originalUrl: '/test' } as any;
      const mockRes = {
        redirect: vi.fn(),
      } as any;

      const handleTokenError = sdk['handleTokenError'].bind(sdk);

      // Should not throw but call redirect
      handleTokenError(mockReq, mockRes, new Error('TOKEN_EXPIRED'), '507f1f77bcf86cd799439011');

      // Since it's not an InternalApiError, should return status instead
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });

    it('should handle non-API errors', () => {
      const mockReq = { originalUrl: '/test' } as any;
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;

      const handleTokenError = sdk['handleTokenError'].bind(sdk);

      const result = handleTokenError(mockReq, mockRes, new Error('Generic error'));

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_FAILED',
          message: 'Token verification failed',
        },
      });
    });
  });

  describe('Client call methods', () => {
    it('should call HTTP client for token verification', async () => {
      const result = await sdk['callVerifyToken']('test_token', 'access');

      expect(httpClient.verifyToken).toHaveBeenCalledWith('test_token', 'access');
      expect(result).toEqual(mockTokenVerificationResponse);
    });

    it('should call HTTP client for user retrieval', async () => {
      const result = await sdk['callGetUserById']('123');

      expect(httpClient.getUserById).toHaveBeenCalledWith('123');
      expect(result).toEqual(mockUserResponse);
    });

    it('should call HTTP client for user existence check', async () => {
      const result = await sdk['callCheckUserExists']('123');

      expect(httpClient.checkUserExists).toHaveBeenCalledWith('123');
      expect(result).toEqual({ exists: true, accountId: '507f1f77bcf86cd799439011' });
    });

    it('should call HTTP client for session info', async () => {
      const result = await sdk['callGetSessionInfo']('cookie');

      expect(httpClient.getSessionInfo).toHaveBeenCalledWith('cookie');
      expect(result).toEqual(mockSessionResponse);
    });

    it('should call HTTP client for session validation', async () => {
      const result = await sdk['callValidateSession']('123', 'cookie');

      expect(httpClient.validateSession).toHaveBeenCalledWith('123', 'cookie');
      expect(result).toEqual({
        session: mockSessionResponse.session,
        accountId: '507f1f77bcf86cd799439011',
        isAccountInSession: true,
        isCurrentAccount: true,
      });
    });

    it('should call socket client when connected and preferred', async () => {
      const socketSdk = new InternalApiSdk({
        httpClient,
        socketClient,
        preferSocket: true,
      });

      vi.spyOn(socketClient, 'isConnected').mockReturnValue(true);
      vi.spyOn(socketClient, 'verifyToken').mockImplementation((token, type, callback) => {
        callback({ success: true, data: mockTokenVerificationResponse });
      });

      const result = await socketSdk['callVerifyToken']('test_token', 'access');

      expect(socketClient.verifyToken).toHaveBeenCalled();
      expect(result).toEqual(mockTokenVerificationResponse);
    });

    it('should handle socket client errors', async () => {
      const socketSdk = new InternalApiSdk({
        httpClient,
        socketClient,
        preferSocket: true,
      });

      vi.spyOn(socketClient, 'isConnected').mockReturnValue(true);
      vi.spyOn(socketClient, 'verifyToken').mockImplementation((token, type, callback) => {
        callback({ success: false, error: { code: 'TOKEN_INVALID', message: 'Invalid token' } });
      });

      await expect(socketSdk['callVerifyToken']('invalid_token', 'access')).rejects.toThrow('Invalid token');
    });
  });

  describe('Logging functionality', () => {
    it('should not log when logging disabled', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      sdk['log']('Test message');

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log when logging enabled', () => {
      const loggingSdk = new InternalApiSdk({
        httpClient,
        enableLogging: true,
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      loggingSdk['log']('Test message', { data: 'test' });

      expect(consoleSpy).toHaveBeenCalledWith('[Internal API SDK] Test message', { data: 'test' });
      consoleSpy.mockRestore();
    });

    it('should log errors when logging enabled', () => {
      const loggingSdk = new InternalApiSdk({
        httpClient,
        enableLogging: true,
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      loggingSdk['logError']('Error message', new Error('test'));

      expect(consoleSpy).toHaveBeenCalledWith('[Internal API SDK Error] Error message', new Error('test'));
      consoleSpy.mockRestore();
    });

    it('should handle logging without data', () => {
      const loggingSdk = new InternalApiSdk({
        httpClient,
        enableLogging: true,
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      loggingSdk['log']('Test message');

      expect(consoleSpy).toHaveBeenCalledWith('[Internal API SDK] Test message', '');
      consoleSpy.mockRestore();
    });
  });

  describe('Middleware options handling', () => {
    it('should handle verifyAccessToken with all options', () => {
      const middleware = sdk.verifyAccessToken({
        fromHeader: true,
        fromCookie: true,
        accountIdParam: 'userId',
        required: true,
        enableRefreshRedirect: true,
      });

      expect(typeof middleware).toBe('function');
    });

    it('should handle loadUser with options', () => {
      const middleware = sdk.loadUser({ required: false });
      expect(typeof middleware).toBe('function');
    });

    it('should handle validateAccountAccess with custom param', () => {
      const middleware = sdk.validateAccountAccess('userId');
      expect(typeof middleware).toBe('function');
    });

    it('should handle loadSession with all options', () => {
      const middleware = sdk.loadSession({
        cookieName: 'custom_session',
        required: false,
        validateAccount: true,
      });

      expect(typeof middleware).toBe('function');
    });

    it('should handle requirePermission with all options', () => {
      const customValidator = vi.fn().mockReturnValue(true);

      const middleware = sdk.requirePermission({
        accountTypes: ['OAuth', 'Local'],
        emailVerified: true,
        customValidator,
      });

      expect(typeof middleware).toBe('function');
    });
  });
});
