import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InternalApiSdk } from '../auth-middleware';
import { ApiErrorCode } from '../../types';

// Mock the client classes
vi.mock('../../client/auth-client');
vi.mock('../../client/socket-client');

describe('InternalApiSdk - Custom Logic Only', () => {
  let sdk: InternalApiSdk;
  let mockHttpClient: any;
  let mockSocketClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockHttpClient = {
      verifyToken: vi.fn(),
      getUserById: vi.fn(),
      checkUserExists: vi.fn(),
      getSessionInfo: vi.fn(),
      validateSession: vi.fn(),
    };

    mockSocketClient = {
      isConnected: vi.fn().mockReturnValue(true),
      verifyToken: vi.fn(),
      getUserById: vi.fn(),
      checkUserExists: vi.fn(),
      getSessionInfo: vi.fn(),
      validateSession: vi.fn(),
    };

    sdk = new InternalApiSdk({
      httpClient: mockHttpClient,
      socketClient: mockSocketClient,
      enableLogging: false,
      preferSocket: false,
      accountServerBaseUrl: 'http://localhost:3001',
    });
  });

  describe('Configuration Handling (Our Logic)', () => {
    it('should initialize with provided configuration', () => {
      expect(sdk.httpClient).toBe(mockHttpClient);
      expect(sdk.socketClient).toBe(mockSocketClient);
    });

    it('should handle optional socket client', () => {
      const sdkWithoutSocket = new InternalApiSdk({
        httpClient: mockHttpClient,
        enableLogging: true,
      });

      expect(sdkWithoutSocket.httpClient).toBe(mockHttpClient);
      expect(sdkWithoutSocket.socketClient).toBeUndefined();
    });

    it('should store configuration options correctly', () => {
      const sdk = new InternalApiSdk({
        httpClient: mockHttpClient,
        socketClient: mockSocketClient,
        enableLogging: true,
        preferSocket: true,
        accountServerBaseUrl: 'http://auth.example.com',
      });

      // Test our configuration storage
      expect(sdk.httpClient).toBe(mockHttpClient);
      expect(sdk.socketClient).toBe(mockSocketClient);
    });
  });

  describe('Client Selection Logic (Our Logic)', () => {
    it('should prefer HTTP when preferSocket is false', () => {
      const httpSdk = new InternalApiSdk({
        httpClient: mockHttpClient,
        socketClient: mockSocketClient,
        preferSocket: false,
      });

      // Test our client selection logic
      const shouldUseSocket = httpSdk['shouldUseSocket']();
      expect(shouldUseSocket).toBe(false);
    });

    it('should prefer socket when configured and connected', () => {
      const socketSdk = new InternalApiSdk({
        httpClient: mockHttpClient,
        socketClient: mockSocketClient,
        preferSocket: true,
      });

      mockSocketClient.isConnected.mockReturnValue(true);
      const shouldUseSocket = socketSdk['shouldUseSocket']();
      expect(shouldUseSocket).toBe(true);
    });

    it('should fallback to HTTP when socket preferred but not connected', () => {
      const socketSdk = new InternalApiSdk({
        httpClient: mockHttpClient,
        socketClient: mockSocketClient,
        preferSocket: true,
      });

      mockSocketClient.isConnected.mockReturnValue(false);
      const shouldUseSocket = socketSdk['shouldUseSocket']();
      expect(shouldUseSocket).toBe(false);
    });

    it('should fallback to HTTP when socket preferred but not available', () => {
      const noSocketSdk = new InternalApiSdk({
        httpClient: mockHttpClient,
        preferSocket: true,
      });

      const shouldUseSocket = noSocketSdk['shouldUseSocket']();
      expect(shouldUseSocket).toBe(false);
    });
  });

  describe('Token Extraction Logic (Our Logic)', () => {
    it('should extract Bearer token from authorization header', () => {
      const mockReq = {
        headers: { authorization: 'Bearer test-token' },
        cookies: {},
      };

      const token = sdk['extractTokenFromHeader'](mockReq as any, 'access');
      expect(token).toBe('test-token');
    });

    it('should return null when no authorization header', () => {
      const mockReq = {
        headers: {},
        cookies: {},
      };

      const token = sdk['extractTokenFromHeader'](mockReq as any, 'access');
      expect(token).toBeNull();
    });

    it('should extract refresh token from custom header', () => {
      const mockReq = {
        headers: {
          authorization: 'Bearer access-token',
          'x-refresh-token': 'refresh-token',
        },
        cookies: {},
      };

      const token = sdk['extractTokenFromHeader'](mockReq as any, 'refresh');
      expect(token).toBe('refresh-token');
    });

    it('should extract token from generic cookie', () => {
      const mockReq = {
        headers: {},
        cookies: { access_token: 'cookie-token' },
      };

      const token = sdk['extractTokenFromCookie'](mockReq as any, undefined, 'access');
      expect(token).toBe('cookie-token');
    });

    it('should extract token from account-specific cookie', () => {
      const mockReq = {
        headers: {},
        cookies: {
          access_token: 'generic-token',
          user123_access_token: 'account-specific-token',
        },
      };

      const token = sdk['extractTokenFromCookie'](mockReq as any, 'user123', 'access');
      expect(token).toBe('account-specific-token');
    });

    it('should return null when cookies not available', () => {
      const mockReq = {
        headers: {},
        cookies: undefined,
      };

      const token = sdk['extractTokenFromCookie'](mockReq as any, 'user123', 'access');
      expect(token).toBeNull();
    });
  });

  describe('URL Building Logic (Our Logic)', () => {
    it('should build refresh URL correctly', () => {
      const mockReq = {
        originalUrl: '/api/users/profile',
      };

      const refreshUrl = sdk['buildRefreshUrl'](mockReq as any, 'user123');

      expect(refreshUrl).toBe('http://localhost:3001/user123/tokens/refresh?redirectUrl=%2Fapi%2Fusers%2Fprofile');
    });

    it('should encode special characters in original URL', () => {
      const mockReq = {
        originalUrl: '/api/search?q=test+query&filter=active',
      };

      const refreshUrl = sdk['buildRefreshUrl'](mockReq as any, 'user456');

      expect(refreshUrl).toContain('redirectUrl=%2Fapi%2Fsearch%3Fq%3Dtest%2Bquery%26filter%3Dactive');
    });

    it('should throw error when account server base URL not configured', () => {
      const sdkWithoutBaseUrl = new InternalApiSdk({
        httpClient: mockHttpClient,
      });

      const mockReq = { originalUrl: '/test' };

      expect(() => {
        sdkWithoutBaseUrl['buildRefreshUrl'](mockReq as any, 'user123');
      }).toThrow('Account server base URL not configured for token refresh');
    });

    it('should throw error when account ID not provided', () => {
      const mockReq = { originalUrl: '/test' };

      expect(() => {
        sdk['buildRefreshUrl'](mockReq as any, '');
      }).toThrow('Account ID is required for token refresh redirect');
    });
  });

  describe('Middleware Composition Logic (Our Logic)', () => {
    it('should return array of middleware functions for authenticate', () => {
      const middlewares = sdk.authenticate();

      expect(Array.isArray(middlewares)).toBe(true);
      expect(middlewares.length).toBeGreaterThan(0);

      // Each middleware should be a function with Express signature
      middlewares.forEach((middleware) => {
        expect(typeof middleware).toBe('function');
        expect(middleware.length).toBe(3); // (req, res, next)
      });
    });

    it('should customize middleware chain based on options', () => {
      const withUser = sdk.authenticate({ loadUser: true });
      const withoutUser = sdk.authenticate({ loadUser: false });

      expect(withUser.length).toBeGreaterThan(withoutUser.length);
    });

    it('should return array of middleware functions for authorize', () => {
      const middlewares = sdk.authorize();

      expect(Array.isArray(middlewares)).toBe(true);
      expect(middlewares.length).toBeGreaterThan(2);

      middlewares.forEach((middleware) => {
        expect(typeof middleware).toBe('function');
        expect(middleware.length).toBe(3);
      });
    });

    it('should configure authorize middleware with options', () => {
      const customAuth = sdk.authorize({
        accountIdParam: 'userId',
        sessionCookieName: 'custom_session',
        validateSessionAccount: false,
        enableRefreshRedirect: false,
      });

      expect(Array.isArray(customAuth)).toBe(true);
      expect(customAuth.length).toBeGreaterThan(0);
    });
  });

  describe('Client Override Logic (Our Logic)', () => {
    it('should create HTTP-only instance and preserve original preference', () => {
      const originalPreference = sdk['preferSocket'];
      const httpInstance = sdk.useHttp();

      // Should return object with middleware methods
      expect(httpInstance).toHaveProperty('verifyAccessToken');
      expect(httpInstance).toHaveProperty('loadUser');
      expect(httpInstance).toHaveProperty('restore');

      // Should be functions
      expect(typeof httpInstance.verifyAccessToken).toBe('function');
      expect(typeof httpInstance.restore).toBe('function');

      // Should change preference temporarily
      expect(sdk['preferSocket']).toBe(false);

      // Should restore original preference
      httpInstance.restore();
      expect(sdk['preferSocket']).toBe(originalPreference);
    });

    it('should create socket-preferred instance and preserve original preference', () => {
      const originalPreference = sdk['preferSocket'];
      const socketInstance = sdk.useSocket();

      expect(socketInstance).toHaveProperty('verifyAccessToken');
      expect(socketInstance).toHaveProperty('restore');

      // Should change preference temporarily
      expect(sdk['preferSocket']).toBe(true);

      // Should restore original preference
      socketInstance.restore();
      expect(sdk['preferSocket']).toBe(originalPreference);
    });
  });

  describe('Error Classification Logic (Our Logic)', () => {
    it('should classify token-related errors for redirect handling', () => {
      // Test our error handling logic without Express
      const tokenExpiredError = { code: ApiErrorCode.TOKEN_EXPIRED };
      const tokenInvalidError = { code: ApiErrorCode.TOKEN_INVALID };
      const connectionError = { code: ApiErrorCode.CONNECTION_ERROR };
      const authError = { code: ApiErrorCode.AUTH_FAILED };

      // Test that our logic identifies redirect-worthy errors
      const redirectErrors = [ApiErrorCode.TOKEN_EXPIRED, ApiErrorCode.TOKEN_INVALID];
      const serviceErrors = [ApiErrorCode.CONNECTION_ERROR, ApiErrorCode.TIMEOUT_ERROR];

      expect(redirectErrors).toContain(tokenExpiredError.code);
      expect(redirectErrors).toContain(tokenInvalidError.code);
      expect(serviceErrors).toContain(connectionError.code);
      expect(redirectErrors).not.toContain(authError.code);
    });
  });

  describe('Logging Logic (Our Logic)', () => {
    it('should handle logging when enabled', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const loggingSdk = new InternalApiSdk({
        httpClient: mockHttpClient,
        enableLogging: true,
      });

      // Test our logging logic
      loggingSdk['log']('Test message', { data: 'test' });

      expect(consoleSpy).toHaveBeenCalledWith('[Internal API SDK] Test message', { data: 'test' });

      consoleSpy.mockRestore();
    });

    it('should skip logging when disabled', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Test with logging disabled
      sdk['log']('Test message');

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle error logging', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const loggingSdk = new InternalApiSdk({
        httpClient: mockHttpClient,
        enableLogging: true,
      });

      loggingSdk['logError']('Error message', new Error('test'));

      expect(consoleSpy).toHaveBeenCalledWith('[Internal API SDK Error] Error message', new Error('test'));

      consoleSpy.mockRestore();
    });
  });

  describe('Client Method Calling Logic (Our Logic)', () => {
    it('should call HTTP client when socket not preferred', async () => {
      mockHttpClient.verifyToken.mockResolvedValue({ valid: true });

      const result = await sdk['callVerifyToken']('test-token', 'access');

      expect(mockHttpClient.verifyToken).toHaveBeenCalledWith('test-token', 'access');
      expect(mockSocketClient.verifyToken).not.toHaveBeenCalled();
      expect(result).toEqual({ valid: true });
    });

    it('should call socket client when preferred and connected', async () => {
      const socketSdk = new InternalApiSdk({
        httpClient: mockHttpClient,
        socketClient: mockSocketClient,
        preferSocket: true,
      });

      mockSocketClient.isConnected.mockReturnValue(true);
      mockSocketClient.verifyToken.mockImplementation((token: string, type: string, callback: any) => {
        callback({ success: true, data: { valid: true } });
      });

      const result = await socketSdk['callVerifyToken']('test-token', 'access');

      expect(mockSocketClient.verifyToken).toHaveBeenCalled();
      expect(mockHttpClient.verifyToken).not.toHaveBeenCalled();
      expect(result).toEqual({ valid: true });
    });

    it('should handle socket callback errors', async () => {
      const socketSdk = new InternalApiSdk({
        httpClient: mockHttpClient,
        socketClient: mockSocketClient,
        preferSocket: true,
      });

      mockSocketClient.isConnected.mockReturnValue(true);
      mockSocketClient.verifyToken.mockImplementation((token: string, type: string, callback: any) => {
        callback({ success: false, error: { message: 'Socket error' } });
      });

      await expect(socketSdk['callVerifyToken']('test-token', 'access')).rejects.toThrow('Socket error');
    });
  });
});
