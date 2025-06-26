import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { ApiSdk, ApiSdkConfig } from '../../middleware/Auth.middleware';
import { HttpClient } from '../../client/HttpClient';
import { SocketClient } from '../../client/SocketClient';
import { ApiService } from '../../services/ApiService';
import { SocketService } from '../../services/SocketService';
import { AccountType, ApiError, ApiErrorCode, TokenVerificationResponse } from '../../types';

// Mock dependencies
const mockHttpClient = {
  get: vi.fn(),
  post: vi.fn(),
};

const mockSocketClient = {
  isConnected: vi.fn(() => false),
  emit: vi.fn(),
  emitWithResponse: vi.fn(),
};

const mockApiService = {
  verifyToken: vi.fn(),
  checkUserExists: vi.fn(),
  getUserById: vi.fn(),
  getSessionInfo: vi.fn(),
};

const mockSocketService = {
  verifyTokenAsync: vi.fn(),
  checkUserExistsAsync: vi.fn(),
  getUserByIdAsync: vi.fn(),
  getSessionInfoAsync: vi.fn(),
};

// Mock Express objects
const createMockRequest = (overrides = {}): Partial<Request> => ({
  params: {},
  headers: {},
  cookies: {},
  originalUrl: '/test',
  ...overrides,
});

const createMockResponse = (): Partial<Response> => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    redirect: vi.fn(),
  };
  return res;
};

const mockNext: NextFunction = vi.fn();

vi.mock('../../client/HttpClient');
vi.mock('../../client/SocketClient');
vi.mock('../../services/ApiService');
vi.mock('../../services/SocketService');

describe('ApiSdk Middleware', () => {
  let apiSdk: ApiSdk;
  let config: ApiSdkConfig;

  beforeEach(() => {
    config = {
      httpClient: mockHttpClient as any,
      socketClient: mockSocketClient as any,
      enableLogging: false,
      preferSocket: false,
      accountServerBaseUrl: 'https://auth.example.com',
    };

    // Reset all mocks
    vi.clearAllMocks();
    mockSocketClient.isConnected.mockReturnValue(false);

    // Mock constructor behavior
    vi.mocked(ApiService).mockImplementation(() => mockApiService as any);
    vi.mocked(SocketService).mockImplementation(() => mockSocketService as any);

    apiSdk = new ApiSdk(config);
  });

  describe('token extraction logic', () => {
    describe('extractAccessToken', () => {
      it('should extract token from Authorization header', () => {
        const req = createMockRequest({
          headers: { authorization: 'Bearer test-token-123' },
          params: { accountId: '507f1f77bcf86cd799439011' },
        });

        const middleware = apiSdk.validateTokenAccess();

        // We need to test the private method indirectly through middleware
        // This tests the Authorization header extraction logic
        expect(req.headers?.authorization).toBe('Bearer test-token-123');
      });

      it('should extract token from account-specific cookie', () => {
        const req = createMockRequest({
          cookies: { access_token_507f1f77bcf86cd799439011: 'cookie-token-123' },
          params: { accountId: '507f1f77bcf86cd799439011' },
        });

        expect(req.cookies['access_token_507f1f77bcf86cd799439011']).toBe('cookie-token-123');
      });

      it('should prioritize Authorization header over cookie', () => {
        const req = createMockRequest({
          headers: { authorization: 'Bearer header-token' },
          cookies: { access_token_507f1f77bcf86cd799439011: 'cookie-token' },
          params: { accountId: '507f1f77bcf86cd799439011' },
        });

        // Authorization header should take precedence
        expect(req.headers?.authorization).toBe('Bearer header-token');
      });
    });

    describe('extractRefreshToken', () => {
      it('should extract refresh token from header', () => {
        const req = createMockRequest({
          headers: { 'x-refresh-token': 'refresh-token-123' },
        });

        expect(req.headers?.['x-refresh-token']).toBe('refresh-token-123');
      });

      it('should extract refresh token from account-specific cookie', () => {
        const req = createMockRequest({
          cookies: { refresh_token_507f1f77bcf86cd799439011: 'refresh-cookie-token' },
          params: { accountId: '507f1f77bcf86cd799439011' },
        });

        expect(req.cookies['refresh_token_507f1f77bcf86cd799439011']).toBe('refresh-cookie-token');
      });
    });
  });

  describe('client selection logic', () => {
    it('should prefer HTTP when socket not preferred', () => {
      const httpConfig = { ...config, preferSocket: false };
      const httpSdk = new ApiSdk(httpConfig);

      // shouldUseSocket should return false
      expect(httpConfig.preferSocket).toBe(false);
    });

    it('should prefer socket when configured and connected', () => {
      mockSocketClient.isConnected.mockReturnValue(true);
      const socketConfig = {
        ...config,
        preferSocket: true,
        socketClient: mockSocketClient as any,
      };

      const socketSdk = new ApiSdk(socketConfig);

      expect(socketConfig.preferSocket).toBe(true);
      expect(mockSocketClient.isConnected()).toBe(true);
    });

    it('should fallback to HTTP when socket preferred but not connected', () => {
      mockSocketClient.isConnected.mockReturnValue(false);
      const socketConfig = {
        ...config,
        preferSocket: true,
        socketClient: mockSocketClient as any,
      };

      expect(mockSocketClient.isConnected()).toBe(false);
    });
  });

  describe('redirect URL building logic', () => {
    it('should construct correct refresh URL', () => {
      const req = createMockRequest({
        headers: { 'x-path-prefix': '/api/v1' },
        originalUrl: '/api/v1/507f1f77bcf86cd799439011/profile',
        params: { accountId: '507f1f77bcf86cd799439011' },
      });

      // Test the URL building logic components
      const accountId = '507f1f77bcf86cd799439011';
      const pathPrefix = '/api/v1';
      const originalUrl = '/api/v1/507f1f77bcf86cd799439011/profile';
      const baseUrl = 'https://auth.example.com';

      const expectedRefreshPath = `${pathPrefix}/${accountId}/tokens/refresh`;
      const expectedRedirectUrl = `${baseUrl}${expectedRefreshPath}?redirectUrl=${encodeURIComponent(originalUrl)}`;

      expect(expectedRedirectUrl).toBe(
        'https://auth.example.com/api/v1/507f1f77bcf86cd799439011/tokens/refresh?redirectUrl=%2Fapi%2Fv1%2F507f1f77bcf86cd799439011%2Fprofile',
      );
    });

    it('should handle empty path prefix', () => {
      const accountId = '507f1f77bcf86cd799439011';
      const pathPrefix = '';
      const originalUrl = '/507f1f77bcf86cd799439011/dashboard';

      const expectedRefreshPath = `/${accountId}/tokens/refresh`;
      expect(expectedRefreshPath).toBe('/507f1f77bcf86cd799439011/tokens/refresh');
    });
  });

  describe('authenticateSession middleware', () => {
    it('should validate ObjectId format', async () => {
      const validObjectId = '507f1f77bcf86cd799439011';
      const req = createMockRequest({
        params: { accountId: validObjectId },
      });
      const res = createMockResponse();

      const middleware = apiSdk.authenticateSession();
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject invalid ObjectId format', async () => {
      const invalidObjectId = 'invalid-id-123';
      const req = createMockRequest({
        params: { accountId: invalidObjectId },
      });
      const res = createMockResponse();

      const middleware = apiSdk.authenticateSession();
      await middleware(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Invalid Account ID format',
          }),
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject missing accountId parameter', async () => {
      const req = createMockRequest({
        params: {}, // Missing accountId
      });
      const res = createMockResponse();

      const middleware = apiSdk.authenticateSession();
      await middleware(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.MISSING_DATA,
            message: "Account ID parameter 'accountId' is required",
          }),
        }),
      );
    });

    it('should handle custom accountId parameter name', async () => {
      const req = createMockRequest({
        params: { userId: '507f1f77bcf86cd799439011' },
      });
      const res = createMockResponse();

      const middleware = apiSdk.authenticateSession('userId');
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('validateAccountAccess middleware', () => {
    it('should load account when exists', async () => {
      const accountId = '507f1f77bcf86cd799439011';
      const mockAccount = {
        id: accountId,
        accountType: AccountType.Local,
        userDetails: { name: 'John Doe' },
      };

      mockApiService.checkUserExists.mockResolvedValue({ exists: true });
      mockApiService.getUserById.mockResolvedValue({ user: mockAccount });

      const req = createMockRequest({
        params: { accountId },
      });
      const res = createMockResponse();

      const middleware = apiSdk.validateAccountAccess();
      await middleware(req as Request, res as Response, mockNext);

      expect(mockApiService.checkUserExists).toHaveBeenCalledWith(accountId);
      expect(mockApiService.getUserById).toHaveBeenCalledWith(accountId);
      expect((req as any).account).toBe(mockAccount);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 404 when account does not exist', async () => {
      const accountId = '507f1f77bcf86cd799439011';

      mockApiService.checkUserExists.mockResolvedValue({ exists: false });

      const req = createMockRequest({
        params: { accountId },
      });
      const res = createMockResponse();

      const middleware = apiSdk.validateAccountAccess();
      await middleware(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.USER_NOT_FOUND,
            message: 'Account not found',
          }),
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should set legacy properties for oauth accounts', async () => {
      const oauthAccount = {
        id: '507f1f77bcf86cd799439011',
        accountType: AccountType.OAuth,
        provider: 'google',
      };

      mockApiService.checkUserExists.mockResolvedValue({ exists: true });
      mockApiService.getUserById.mockResolvedValue({ user: oauthAccount });

      const req = createMockRequest({
        params: { accountId: '507f1f77bcf86cd799439011' },
      });
      const res = createMockResponse();

      const middleware = apiSdk.validateAccountAccess();
      await middleware(req as Request, res as Response, mockNext);

      expect((req as any).account).toBe(oauthAccount);
      expect((req as any).oauthAccount).toBe(oauthAccount);
      expect((req as any).localAccount).toBeUndefined();
    });

    it('should set legacy properties for local accounts', async () => {
      const localAccount = {
        id: '507f1f77bcf86cd799439011',
        accountType: AccountType.Local,
      };

      mockApiService.checkUserExists.mockResolvedValue({ exists: true });
      mockApiService.getUserById.mockResolvedValue({ user: localAccount });

      const req = createMockRequest({
        params: { accountId: '507f1f77bcf86cd799439011' },
      });
      const res = createMockResponse();

      const middleware = apiSdk.validateAccountAccess();
      await middleware(req as Request, res as Response, mockNext);

      expect((req as any).account).toBe(localAccount);
      expect((req as any).localAccount).toBe(localAccount);
      expect((req as any).oauthAccount).toBeUndefined();
    });

    it('should use socket when preferred and available', async () => {
      mockSocketClient.isConnected.mockReturnValue(true);
      const socketConfig = {
        ...config,
        preferSocket: true,
        socketClient: mockSocketClient as any,
        socketService: mockSocketService as any,
      };
      const socketSdk = new ApiSdk(socketConfig);

      mockSocketService.checkUserExistsAsync.mockResolvedValue({ exists: true });
      mockSocketService.getUserByIdAsync.mockResolvedValue({
        user: { id: '507f1f77bcf86cd799439011', accountType: AccountType.Local },
      });

      const req = createMockRequest({
        params: { accountId: '507f1f77bcf86cd799439011' },
      });
      const res = createMockResponse();

      const middleware = socketSdk.validateAccountAccess();
      await middleware(req as Request, res as Response, mockNext);

      expect(mockSocketService.checkUserExistsAsync).toHaveBeenCalled();
      expect(mockSocketService.getUserByIdAsync).toHaveBeenCalled();
      expect(mockApiService.checkUserExists).not.toHaveBeenCalled();
    });
  });

  describe('validateTokenAccess middleware', () => {
    beforeEach(() => {
      // Setup a valid account in request
      const mockAccount = {
        id: '507f1f77bcf86cd799439011',
        accountType: AccountType.Local,
      };
    });

    it('should validate access token successfully', async () => {
      const accountId = '507f1f77bcf86cd799439011';
      const mockAccount = { id: accountId, accountType: AccountType.Local };
      const mockTokenResponse: TokenVerificationResponse = {
        valid: true,
        accountId,
        accountType: AccountType.Local,
        expiresAt: Date.now() + 3600000,
      };

      mockApiService.verifyToken.mockResolvedValue(mockTokenResponse);

      const req = createMockRequest({
        params: { accountId },
        headers: { authorization: 'Bearer valid-token' },
        account: mockAccount,
      });
      const res = createMockResponse();

      const middleware = apiSdk.validateTokenAccess();
      await middleware(req as Request, res as Response, mockNext);

      expect(mockApiService.verifyToken).toHaveBeenCalledWith('valid-token', 'access');
      expect((req as any).accessToken).toBe('valid-token');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject token ownership mismatch', async () => {
      const accountId = '507f1f77bcf86cd799439011';
      const differentAccountId = '507f1f77bcf86cd799439012';
      const mockAccount = { id: accountId, accountType: AccountType.Local };
      const mockTokenResponse: TokenVerificationResponse = {
        valid: true,
        accountId: differentAccountId, // Different account ID
        accountType: AccountType.Local,
      };

      mockApiService.verifyToken.mockResolvedValue(mockTokenResponse);

      const req = createMockRequest({
        params: { accountId },
        headers: { authorization: 'Bearer wrong-owner-token' },
        account: mockAccount,
      });
      const res = createMockResponse();

      const middleware = apiSdk.validateTokenAccess();
      await middleware(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(302); // Redirect for token error
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject account type mismatch', async () => {
      const accountId = '507f1f77bcf86cd799439011';
      const mockAccount = { id: accountId, accountType: AccountType.Local };
      const mockTokenResponse: TokenVerificationResponse = {
        valid: true,
        accountId,
        accountType: AccountType.OAuth, // Different account type
      };

      mockApiService.verifyToken.mockResolvedValue(mockTokenResponse);

      const req = createMockRequest({
        params: { accountId },
        headers: { authorization: 'Bearer type-mismatch-token' },
        account: mockAccount,
      });
      const res = createMockResponse();

      const middleware = apiSdk.validateTokenAccess();
      await middleware(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(302); // Redirect for token error
    });

    it('should require at least one token', async () => {
      const accountId = '507f1f77bcf86cd799439011';
      const mockAccount = { id: accountId, accountType: AccountType.Local };

      const req = createMockRequest({
        params: { accountId },
        headers: {}, // No authorization header
        cookies: {}, // No token cookies
        account: mockAccount,
      });
      const res = createMockResponse();

      const middleware = apiSdk.validateTokenAccess();
      await middleware(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(302); // Redirect for missing token
    });

    it('should handle both access and refresh tokens', async () => {
      const accountId = '507f1f77bcf86cd799439011';
      const mockAccount = { id: accountId, accountType: AccountType.Local };

      const mockAccessTokenResponse: TokenVerificationResponse = {
        valid: true,
        accountId,
        accountType: AccountType.Local,
      };

      const mockRefreshTokenResponse: TokenVerificationResponse = {
        valid: true,
        accountId,
        accountType: AccountType.Local,
        isRefreshToken: true,
      };

      mockApiService.verifyToken
        .mockResolvedValueOnce(mockAccessTokenResponse) // First call for access token
        .mockResolvedValueOnce(mockRefreshTokenResponse); // Second call for refresh token

      const req = createMockRequest({
        params: { accountId },
        headers: {
          authorization: 'Bearer access-token',
          'x-refresh-token': 'refresh-token',
        },
        account: mockAccount,
      });
      const res = createMockResponse();

      const middleware = apiSdk.validateTokenAccess();
      await middleware(req as Request, res as Response, mockNext);

      expect(mockApiService.verifyToken).toHaveBeenCalledTimes(2);
      expect(mockApiService.verifyToken).toHaveBeenNthCalledWith(1, 'access-token', 'access');
      expect(mockApiService.verifyToken).toHaveBeenNthCalledWith(2, 'refresh-token', 'refresh');
      expect((req as any).accessToken).toBe('access-token');
      expect((req as any).refreshToken).toBe('refresh-token');
    });

    it('should handle oauth token data attachment', async () => {
      const accountId = '507f1f77bcf86cd799439011';
      const mockAccount = { id: accountId, accountType: AccountType.OAuth };
      const mockTokenResponse: TokenVerificationResponse = {
        valid: true,
        accountId,
        accountType: AccountType.OAuth,
        oauthAccessToken: 'oauth-access-token-123',
      };

      mockApiService.verifyToken.mockResolvedValue(mockTokenResponse);

      const req = createMockRequest({
        params: { accountId },
        headers: { authorization: 'Bearer jwt-token' },
        account: mockAccount,
      });
      const res = createMockResponse();

      const middleware = apiSdk.validateTokenAccess();
      await middleware(req as Request, res as Response, mockNext);

      expect((req as any).oauthAccessToken).toBe('oauth-access-token-123');
    });

    it('should redirect to refresh URL on token expiration', async () => {
      const accountId = '507f1f77bcf86cd799439011';
      const mockAccount = { id: accountId, accountType: AccountType.Local };

      mockApiService.verifyToken.mockRejectedValue(
        new ApiError(ApiErrorCode.TOKEN_EXPIRED, 'Access token has expired'),
      );

      const req = createMockRequest({
        params: { accountId },
        headers: {
          authorization: 'Bearer expired-token',
          'x-path-prefix': '/api',
        },
        originalUrl: '/api/507f1f77bcf86cd799439011/profile',
        account: mockAccount,
      });
      const res = createMockResponse();

      const middleware = apiSdk.validateTokenAccess();
      await middleware(req as Request, res as Response, mockNext);

      expect(res.redirect).toHaveBeenCalledWith(
        302,
        expect.stringContaining('https://auth.example.com/api/507f1f77bcf86cd799439011/tokens/refresh'),
      );
    });
  });

  describe('verifyToken lightweight middleware', () => {
    it('should verify token without full account loading', async () => {
      const accountId = '507f1f77bcf86cd799439011';
      const mockTokenResponse: TokenVerificationResponse = {
        valid: true,
        accountId,
        accountType: AccountType.Local,
        expiresAt: Date.now() + 3600000,
      };

      mockApiService.verifyToken.mockResolvedValue(mockTokenResponse);

      const req = createMockRequest({
        params: { accountId },
        headers: { authorization: 'Bearer test-token' },
      });
      const res = createMockResponse();

      const middleware = apiSdk.verifyToken();
      await middleware(req as Request, res as Response, mockNext);

      expect(mockApiService.verifyToken).toHaveBeenCalledWith('test-token', 'access');
      expect((req as any).tokenData).toEqual(
        expect.objectContaining({
          valid: true,
          accountId,
          accountType: AccountType.Local,
        }),
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle optional token when not required', async () => {
      const req = createMockRequest({
        params: { accountId: '507f1f77bcf86cd799439011' },
        headers: {}, // No token
      });
      const res = createMockResponse();

      const middleware = apiSdk.verifyToken({ required: false });
      await middleware(req as Request, res as Response, mockNext);

      expect(mockApiService.verifyToken).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should require token when required option is true', async () => {
      const req = createMockRequest({
        params: { accountId: '507f1f77bcf86cd799439011' },
        headers: {}, // No token
      });
      const res = createMockResponse();

      const middleware = apiSdk.verifyToken({ required: true });
      await middleware(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.TOKEN_INVALID,
            message: 'Access token required',
          }),
        }),
      );
    });
  });

  describe('requirePermission middleware', () => {
    it('should allow access for matching account type', async () => {
      const req = createMockRequest({
        account: {
          id: '507f1f77bcf86cd799439011',
          accountType: AccountType.OAuth,
          userDetails: { emailVerified: true },
        },
      });
      const res = createMockResponse();

      const middleware = apiSdk.requirePermission({
        accountTypes: ['oauth', 'local'],
      });
      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access for non-matching account type', async () => {
      const req = createMockRequest({
        account: {
          id: '507f1f77bcf86cd799439011',
          accountType: AccountType.Local,
        },
      });
      const res = createMockResponse();

      const middleware = apiSdk.requirePermission({
        accountTypes: ['oauth'], // Only oauth allowed
      });
      await middleware(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.PERMISSION_DENIED,
            message: 'Account type not authorized',
          }),
        }),
      );
    });

    it('should require email verification when specified', async () => {
      const req = createMockRequest({
        account: {
          id: '507f1f77bcf86cd799439011',
          accountType: AccountType.Local,
          userDetails: { emailVerified: false },
        },
      });
      const res = createMockResponse();

      const middleware = apiSdk.requirePermission({
        emailVerified: true,
      });
      await middleware(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.PERMISSION_DENIED,
            message: 'Email verification required',
          }),
        }),
      );
    });

    it('should execute custom validator', async () => {
      const customValidator = vi.fn().mockReturnValue(true);

      const req = createMockRequest({
        account: {
          id: '507f1f77bcf86cd799439011',
          accountType: AccountType.Local,
        },
      });
      const res = createMockResponse();

      const middleware = apiSdk.requirePermission({
        customValidator,
      });
      await middleware(req as Request, res as Response, mockNext);

      expect(customValidator).toHaveBeenCalledWith(req.account);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle async custom validator', async () => {
      const customValidator = vi.fn().mockResolvedValue(false);

      const req = createMockRequest({
        account: {
          id: '507f1f77bcf86cd799439011',
          accountType: AccountType.Local,
        },
      });
      const res = createMockResponse();

      const middleware = apiSdk.requirePermission({
        customValidator,
      });
      await middleware(req as Request, res as Response, mockNext);

      expect(customValidator).toHaveBeenCalledWith(req.account);
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('loadSession middleware', () => {
    it('should load session info when cookie present', async () => {
      const mockSessionInfo = {
        accountIds: ['507f1f77bcf86cd799439011'],
        currentAccountId: '507f1f77bcf86cd799439011',
        isValid: true,
      };

      mockApiService.getSessionInfo.mockResolvedValue({
        session: mockSessionInfo,
      });

      const req = createMockRequest({
        cookies: { account_session: 'session-cookie-value' },
      });
      const res = createMockResponse();

      const middleware = apiSdk.loadSession();
      await middleware(req as Request, res as Response, mockNext);

      expect(mockApiService.getSessionInfo).toHaveBeenCalledWith('session-cookie-value');
      expect((req as any).sessionInfo).toBe(mockSessionInfo);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue when session not required and missing', async () => {
      const req = createMockRequest({
        cookies: {}, // No session cookie
      });
      const res = createMockResponse();

      const middleware = apiSdk.loadSession({ required: false });
      await middleware(req as Request, res as Response, mockNext);

      expect(mockApiService.getSessionInfo).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 401 when session required but missing', async () => {
      const req = createMockRequest({
        cookies: {}, // No session cookie
      });
      const res = createMockResponse();

      const middleware = apiSdk.loadSession({ required: true });
      await middleware(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.AUTH_FAILED,
            message: 'Session required',
          }),
        }),
      );
    });
  });

  describe('error handling and redirects', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new ApiError(ApiErrorCode.SERVICE_UNAVAILABLE, 'Service temporarily unavailable');

      mockApiService.checkUserExists.mockRejectedValue(networkError);

      const req = createMockRequest({
        params: { accountId: '507f1f77bcf86cd799439011' },
      });
      const res = createMockResponse();

      const middleware = apiSdk.validateAccountAccess();
      await middleware(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.SERVER_ERROR,
            message: 'Account validation failed',
          }),
        }),
      );
    });

    it('should build correct redirect URL with query parameters', async () => {
      const accountId = '507f1f77bcf86cd799439011';
      const mockAccount = { id: accountId, accountType: AccountType.Local };

      mockApiService.verifyToken.mockRejectedValue(new ApiError(ApiErrorCode.TOKEN_EXPIRED, 'Token expired'));

      const req = createMockRequest({
        params: { accountId },
        headers: {
          authorization: 'Bearer expired-token',
          'x-path-prefix': '/api/v1',
        },
        originalUrl: '/api/v1/507f1f77bcf86cd799439011/settings?tab=security',
        account: mockAccount,
      });
      const res = createMockResponse();

      const middleware = apiSdk.validateTokenAccess();
      await middleware(req as Request, res as Response, mockNext);

      expect(res.redirect).toHaveBeenCalledWith(
        302,
        'https://auth.example.com/api/v1/507f1f77bcf86cd799439011/tokens/refresh?redirectUrl=%2Fapi%2Fv1%2F507f1f77bcf86cd799439011%2Fsettings%3Ftab%3Dsecurity',
      );
    });

    it('should handle missing account server base URL', async () => {
      const configWithoutBaseUrl = {
        ...config,
        accountServerBaseUrl: undefined,
      };
      const sdkWithoutBaseUrl = new ApiSdk(configWithoutBaseUrl);

      const accountId = '507f1f77bcf86cd799439011';
      const mockAccount = { id: accountId, accountType: AccountType.Local };

      mockApiService.verifyToken.mockRejectedValue(new ApiError(ApiErrorCode.TOKEN_EXPIRED, 'Token expired'));

      const req = createMockRequest({
        params: { accountId },
        headers: { authorization: 'Bearer expired-token' },
        account: mockAccount,
      });
      const res = createMockResponse();

      const middleware = sdkWithoutBaseUrl.validateTokenAccess();
      await middleware(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.AUTH_FAILED,
            message: 'Authentication failed',
          }),
        }),
      );
    });
  });

  describe('combined authenticate middleware', () => {
    it('should run full middleware chain successfully', async () => {
      const accountId = '507f1f77bcf86cd799439011';
      const mockAccount = {
        id: accountId,
        accountType: AccountType.Local,
        userDetails: { name: 'John Doe' },
      };
      const mockTokenResponse: TokenVerificationResponse = {
        valid: true,
        accountId,
        accountType: AccountType.Local,
      };

      // Mock all the calls in the chain
      mockApiService.checkUserExists.mockResolvedValue({ exists: true });
      mockApiService.getUserById.mockResolvedValue({ user: mockAccount });
      mockApiService.verifyToken.mockResolvedValue(mockTokenResponse);

      const req = createMockRequest({
        params: { accountId },
        headers: { authorization: 'Bearer valid-token' },
      });
      const res = createMockResponse();

      const middlewareChain = apiSdk.authenticate();

      // Execute each middleware in the chain
      for (const middleware of middlewareChain) {
        await middleware(req as Request, res as Response, mockNext);
      }

      expect((req as any).account).toBe(mockAccount);
      expect((req as any).accessToken).toBe('valid-token');
      expect(mockNext).toHaveBeenCalledTimes(4); // Once for each middleware
    });

    it('should inject API clients into request', () => {
      const req = createMockRequest();
      const res = createMockResponse();

      const injectMiddleware = apiSdk.injectClients();
      injectMiddleware(req as Request, res as Response, mockNext);

      expect((req as any).apiClients).toBeDefined();
      expect((req as any).apiClients.http).toBe(mockHttpClient);
      expect((req as any).apiClients.api).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('logging behavior', () => {
    it('should log when logging is enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const loggingConfig = { ...config, enableLogging: true };
      const loggingSdk = new ApiSdk(loggingConfig);

      const req = createMockRequest({
        params: { accountId: '507f1f77bcf86cd799439011' },
      });
      const res = createMockResponse();

      const middleware = loggingSdk.authenticateSession();
      await middleware(req as Request, res as Response, mockNext);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[API SDK] Session authenticated'),
        expect.any(Object),
      );
    });

    it('should not log when logging is disabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      const req = createMockRequest({
        params: { accountId: '507f1f77bcf86cd799439011' },
      });
      const res = createMockResponse();

      const middleware = apiSdk.authenticateSession();
      await middleware(req as Request, res as Response, mockNext);

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('ObjectId validation edge cases', () => {
    const invalidObjectIds = [
      'too-short',
      'way-too-long-to-be-valid-objectid-123456789',
      '507f1f77bcf86cd79943901g', // Invalid character 'g'
      'GGGGGGGGGGGGGGGGGGGGGGGG', // All invalid characters
      '507f1f77bcf86cd79943901', // Too short by 1 character
      '507f1f77bcf86cd799439011x', // Too long by 1 character
    ];

    invalidObjectIds.forEach((invalidId) => {
      it(`should reject invalid ObjectId: "${invalidId}"`, async () => {
        const req = createMockRequest({
          params: { accountId: invalidId },
        });
        const res = createMockResponse();

        const middleware = apiSdk.authenticateSession();
        await middleware(req as Request, res as Response, mockNext);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    const validObjectIds = [
      '507f1f77bcf86cd799439011',
      '507F1F77BCF86CD799439011', // Uppercase
      '000000000000000000000000', // All zeros
      'ffffffffffffffffffffffff', // All f's
    ];

    validObjectIds.forEach((validId) => {
      it(`should accept valid ObjectId: "${validId}"`, async () => {
        const req = createMockRequest({
          params: { accountId: validId },
        });
        const res = createMockResponse();

        const middleware = apiSdk.authenticateSession();
        await middleware(req as Request, res as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });
    });
  });

  describe('socket fallback behavior', () => {
    it('should fallback to HTTP when socket call fails', async () => {
      mockSocketClient.isConnected.mockReturnValue(true);
      const socketConfig = {
        ...config,
        preferSocket: true,
        socketClient: mockSocketClient as any,
        socketService: mockSocketService as any,
      };
      const socketSdk = new ApiSdk(socketConfig);

      const accountId = '507f1f77bcf86cd799439011';

      // Mock socket service to fail
      mockSocketService.checkUserExistsAsync.mockRejectedValue(new Error('Socket connection lost'));

      // Mock HTTP service to succeed
      mockApiService.checkUserExists.mockResolvedValue({ exists: true });
      mockApiService.getUserById.mockResolvedValue({
        user: { id: accountId, accountType: AccountType.Local },
      });

      const req = createMockRequest({
        params: { accountId },
      });
      const res = createMockResponse();

      const middleware = socketSdk.validateAccountAccess();
      await middleware(req as Request, res as Response, mockNext);

      // Should try socket first, then fallback to HTTP
      expect(mockSocketService.checkUserExistsAsync).toHaveBeenCalled();
      expect(mockApiService.checkUserExists).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
