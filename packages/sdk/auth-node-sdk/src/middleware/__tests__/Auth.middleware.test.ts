import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { ApiSdk } from '../Auth.middleware';
import { HttpClient } from '../../client/HttpClient';
import { SocketClient } from '../../client/SocketClient';
import {
  ApiErrorCode,
  TokenVerificationResponse,
  UserResponse,
  UserExistsResponse,
  AccountType,
  AccountStatus,
  OAuthProviders,
} from '../../types';
import { ApiService } from '../../services/ApiService';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock Http Client
const mockHttpClient = {
  isNetworkError: vi.fn(),
  isAuthError: vi.fn(),
  getErrorMessage: vi.fn(),
} as unknown as HttpClient;

// Mock HTTP Service
const mockApiService = {
  verifyToken: vi.fn(),
  checkUserExists: vi.fn(),
  getUserById: vi.fn(),
  getSessionInfo: vi.fn(),
  isNetworkError: vi.fn(),
  isAuthError: vi.fn(),
  getErrorMessage: vi.fn(),
} as unknown as ApiService;

// Mock Socket Client
const mockSocketClient = {
  verifyToken: vi.fn(),
  checkUserExists: vi.fn(),
  getUserById: vi.fn(),
  isConnected: vi.fn(),
} as unknown as SocketClient;

// Mock Request/Response/NextFunction
const createMockRequest = (overrides: Partial<Request> = {}): Request =>
  ({
    params: {},
    headers: {},
    cookies: {},
    originalUrl: '/test',
    path: '/test',
    ...overrides,
  } as Request);

const createMockResponse = (): Response => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    redirect: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
};

const mockNext: NextFunction = vi.fn();

// ============================================================================
// Test Data
// ============================================================================

const mockAccountId = '507f1f77bcf86cd799439011';
const mockInvalidAccountId = 'invalid-id';

const mockAccount = {
  id: mockAccountId,
  created: '2024-01-01T00:00:00.000Z',
  updated: '2024-01-01T00:00:00.000Z',
  accountType: AccountType.OAuth,
  status: AccountStatus.Active,
  userDetails: {
    name: 'Test User',
    email: 'test@example.com',
    emailVerified: true,
  },
  security: {
    twoFactorEnabled: false,
    sessionTimeout: 3600,
    autoLock: false,
  },
  provider: OAuthProviders.Google,
};

const mockTokenVerificationResponse: TokenVerificationResponse = {
  valid: true,
  accountId: mockAccountId,
  accountType: AccountType.OAuth,
  isRefreshToken: false,
  expiresAt: Date.now() + 3600000,
  oauthAccessToken: 'mock-oauth-token',
};

const mockUserExistsResponse: UserExistsResponse = {
  exists: true,
  accountId: mockAccountId,
};

const mockUserResponse: UserResponse = {
  user: mockAccount,
  accountId: mockAccountId,
};

// ============================================================================
// Test Suite
// ============================================================================

describe('ApiSdk', () => {
  let sdk: ApiSdk;
  let req: Request;
  let res: Response;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create SDK instance
    sdk = new ApiSdk({
      httpClient: mockHttpClient,
      socketClient: mockSocketClient,
      enableLogging: false,
      preferSocket: false,
      accountServerBaseUrl: 'http://localhost:3000',
    });

    // Create fresh request/response mocks
    req = createMockRequest();
    res = createMockResponse();

    // Setup default mock responses
    (mockApiService.verifyToken as Mock).mockResolvedValue(mockTokenVerificationResponse);
    (mockApiService.checkUserExists as Mock).mockResolvedValue(mockUserExistsResponse);
    (mockApiService.getUserById as Mock).mockResolvedValue(mockUserResponse);
    (mockSocketClient.isConnected as Mock).mockReturnValue(false);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============================================================================
  // injectClients Tests
  // ============================================================================

  describe('injectClients', () => {
    it('should inject HTTP and Socket clients into request', () => {
      const middleware = sdk.injectClients();
      middleware(req, res, mockNext);

      expect(req.apiClients).toBeDefined();
      expect(req.apiClients?.http).toBe(mockApiService);
      expect(req.apiClients?.socket).toBe(mockSocketClient);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // authenticateSession Tests
  // ============================================================================

  describe('authenticateSession', () => {
    it('should pass with valid account ID', () => {
      req.params.accountId = mockAccountId;
      const middleware = sdk.authenticateSession();
      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should fail with missing account ID', () => {
      req.params = {}; // No accountId
      const middleware = sdk.authenticateSession();
      middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ApiErrorCode.MISSING_DATA,
          message: "Account ID parameter 'accountId' is required",
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should fail with invalid account ID format', () => {
      req.params.accountId = mockInvalidAccountId;
      const middleware = sdk.authenticateSession();
      middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ApiErrorCode.VALIDATION_ERROR,
          message: 'Invalid Account ID format',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should work with custom parameter name', () => {
      req.params.userId = mockAccountId;
      const middleware = sdk.authenticateSession('userId');
      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // validateAccountAccess Tests
  // ============================================================================

  describe('validateAccountAccess', () => {
    beforeEach(() => {
      req.params.accountId = mockAccountId;
    });

    it('should successfully validate existing account', async () => {
      const middleware = sdk.validateAccountAccess();
      await middleware(req, res, mockNext);

      expect(mockApiService.checkUserExists).toHaveBeenCalledWith(mockAccountId);
      expect(mockApiService.getUserById).toHaveBeenCalledWith(mockAccountId);
      expect(req.account).toEqual(mockAccount);
      expect(req.oauthAccount).toEqual(mockAccount); // OAuth account
      expect(mockNext).toHaveBeenCalled();
    });

    it('should fail when account does not exist', async () => {
      (mockApiService.checkUserExists as Mock).mockResolvedValue({ exists: false, accountId: mockAccountId });

      const middleware = sdk.validateAccountAccess();
      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ApiErrorCode.USER_NOT_FOUND,
          message: 'Account not found',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      (mockApiService.checkUserExists as Mock).mockRejectedValue(new Error('API Error'));

      const middleware = sdk.validateAccountAccess();
      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ApiErrorCode.SERVER_ERROR,
          message: 'Account validation failed',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should set localAccount for local account type', async () => {
      const localAccount = { ...mockAccount, accountType: 'local' };
      (mockApiService.getUserById as Mock).mockResolvedValue({
        user: localAccount,
        accountId: mockAccountId,
      });

      const middleware = sdk.validateAccountAccess();
      await middleware(req, res, mockNext);

      expect(req.account).toEqual(localAccount);
      expect(req.localAccount).toEqual(localAccount);
      expect(req.oauthAccount).toBeUndefined();
    });
  });

  // ============================================================================
  // validateTokenAccess Tests
  // ============================================================================

  describe('validateTokenAccess', () => {
    beforeEach(() => {
      req.params.accountId = mockAccountId;
      req.account = mockAccount;
      req.cookies = { [`access_token_${mockAccountId}`]: 'mock-access-token' };
    });

    it('should successfully validate access token', async () => {
      const middleware = sdk.validateTokenAccess();
      await middleware(req, res, mockNext);

      expect(mockApiService.verifyToken).toHaveBeenCalledWith('mock-access-token', 'access');
      expect(req.accessToken).toBe('mock-access-token');
      expect(req.oauthAccessToken).toBe('mock-oauth-token');
      expect(req.tokenData).toBeUndefined(); // No longer set
      expect(mockNext).toHaveBeenCalled();
    });

    it('should validate refresh token when present', async () => {
      req.cookies = {
        [`access_token_${mockAccountId}`]: 'mock-access-token',
        [`refresh_token_${mockAccountId}`]: 'mock-refresh-token',
      };
      const refreshTokenResponse = {
        ...mockTokenVerificationResponse,
        isRefreshToken: true,
        oauthRefreshToken: 'mock-oauth-refresh-token',
      };
      (mockApiService.verifyToken as Mock)
        .mockResolvedValueOnce(mockTokenVerificationResponse) // access token
        .mockResolvedValueOnce(refreshTokenResponse); // refresh token

      const middleware = sdk.validateTokenAccess();
      await middleware(req, res, mockNext);

      expect(mockApiService.verifyToken).toHaveBeenCalledWith('mock-access-token', 'access');
      expect(mockApiService.verifyToken).toHaveBeenCalledWith('mock-refresh-token', 'refresh');
      expect(req.accessToken).toBe('mock-access-token');
      expect(req.refreshToken).toBe('mock-refresh-token');
      expect(req.oauthRefreshToken).toBe('mock-oauth-refresh-token');
      expect(req.tokenData).toBeUndefined(); // No longer set
    });

    it('should validate only refresh token if no access token', async () => {
      req.cookies = { [`refresh_token_${mockAccountId}`]: 'mock-refresh-token' };
      const refreshTokenResponse = {
        ...mockTokenVerificationResponse,
        isRefreshToken: true,
        oauthRefreshToken: 'mock-oauth-refresh-token',
      };
      (mockApiService.verifyToken as Mock).mockResolvedValue(refreshTokenResponse);

      const middleware = sdk.validateTokenAccess();
      await middleware(req, res, mockNext);

      expect(mockApiService.verifyToken).toHaveBeenCalledWith('mock-refresh-token', 'refresh');
      expect(req.refreshToken).toBe('mock-refresh-token');
      expect(req.oauthRefreshToken).toBe('mock-oauth-refresh-token');
      expect(req.accessToken).toBeUndefined();
      expect(req.tokenData).toBeUndefined(); // No longer set
    });

    it('should extract token from Authorization header', async () => {
      req.cookies = {}; // No cookies
      req.headers = { authorization: 'Bearer header-token' };

      const middleware = sdk.validateTokenAccess();
      await middleware(req, res, mockNext);

      expect(mockApiService.verifyToken).toHaveBeenCalledWith('header-token', 'access');
      expect(req.accessToken).toBe('header-token');
      expect(req.tokenData).toBeDefined(); // verifyToken still sets tokenData
      expect(req.tokenData).toBeUndefined(); // No longer set
    });

    it('should fail when no token provided', async () => {
      req.cookies = {}; // No cookies
      req.headers = {}; // No headers

      const middleware = sdk.validateTokenAccess();
      await middleware(req, res, mockNext);

      expect(res.redirect).toHaveBeenCalledWith(
        302,
        'http://localhost:3000/507f1f77bcf86cd799439011/tokens/refresh?redirectUrl=%2Ftest',
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should fail when no tokens provided', async () => {
      req.cookies = {}; // No cookies
      req.headers = {}; // No headers

      const middleware = sdk.validateTokenAccess();
      await middleware(req, res, mockNext);

      expect(res.redirect).toHaveBeenCalledWith(
        302,
        'http://localhost:3000/507f1f77bcf86cd799439011/tokens/refresh?redirectUrl=%2Ftest',
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should redirect to refresh for token errors', async () => {
      req.cookies = { [`refresh_token_${mockAccountId}`]: 'mock-refresh-token' };
      (mockApiService.verifyToken as Mock).mockRejectedValue(new Error('Token expired'));

      const middleware = sdk.validateTokenAccess();
      await middleware(req, res, mockNext);

      expect(res.redirect).toHaveBeenCalledWith(302, expect.stringContaining('/tokens/refresh'));
    });

    it('should fail when token belongs to different account', async () => {
      const differentAccountResponse = {
        ...mockTokenVerificationResponse,
        accountId: '507f1f77bcf86cd799439012', // Different account
      };
      (mockApiService.verifyToken as Mock).mockResolvedValue(differentAccountResponse);

      const middleware = sdk.validateTokenAccess();
      await middleware(req, res, mockNext);

      expect(res.redirect).toHaveBeenCalledWith(302, expect.stringContaining('/tokens/refresh'));
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should fail when account type mismatch', async () => {
      const mismatchResponse = {
        ...mockTokenVerificationResponse,
        accountType: AccountType.Local, // Different from account type
      };
      (mockApiService.verifyToken as Mock).mockResolvedValue(mismatchResponse);

      const middleware = sdk.validateTokenAccess();
      await middleware(req, res, mockNext);

      expect(res.redirect).toHaveBeenCalledWith(302, expect.stringContaining('/tokens/refresh'));
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should fail when account not loaded', async () => {
      req.account = undefined; // No account loaded

      const middleware = sdk.validateTokenAccess();
      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ApiErrorCode.SERVER_ERROR,
          message: 'Account not loaded in middleware chain',
        },
      });
    });
  });

  // ============================================================================
  // authenticate (Combined Middleware) Tests
  // ============================================================================

  describe('authenticate', () => {
    it('should return array of middleware functions', () => {
      const middlewares = sdk.authenticate();

      expect(Array.isArray(middlewares)).toBe(true);
      expect(middlewares).toHaveLength(4);
      expect(typeof middlewares[0]).toBe('function'); // injectClients
      expect(typeof middlewares[1]).toBe('function'); // authenticateSession
      expect(typeof middlewares[2]).toBe('function'); // validateAccountAccess
      expect(typeof middlewares[3]).toBe('function'); // validateTokenAccess
    });

    it('should work with custom accountId parameter', () => {
      const middlewares = sdk.authenticate('userId');
      expect(middlewares).toHaveLength(4);
    });
  });

  // ============================================================================
  // verifyToken (Lightweight) Tests
  // ============================================================================

  describe('verifyToken', () => {
    beforeEach(() => {
      req.params.accountId = mockAccountId;
      req.cookies = { [`access_token_${mockAccountId}`]: 'mock-token' };
    });

    it('should successfully verify token without loading account', async () => {
      const middleware = sdk.verifyToken();
      await middleware(req, res, mockNext);

      expect(mockApiService.verifyToken).toHaveBeenCalledWith('mock-token', 'access');
      expect(req.accessToken).toBe('mock-token');
      expect(req.tokenData).toBeDefined();
      expect(req.account).toBeUndefined(); // No account loaded
      expect(mockApiService.getUserById).not.toHaveBeenCalled(); // No account loading
      expect(mockNext).toHaveBeenCalled();
    });

    it('should work with authorization header', async () => {
      req.cookies = {};
      req.headers = { authorization: 'Bearer header-token' };

      const middleware = sdk.verifyToken({ fromHeader: true, fromCookie: false });
      await middleware(req, res, mockNext);

      expect(mockApiService.verifyToken).toHaveBeenCalledWith('header-token', 'access');
      expect(req.accessToken).toBe('header-token');
    });

    it('should pass when token not required and not provided', async () => {
      req.cookies = {};
      req.headers = {};

      const middleware = sdk.verifyToken({ required: false });
      await middleware(req, res, mockNext);

      expect(mockApiService.verifyToken).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should fail when token required but not provided', async () => {
      req.cookies = {};
      req.headers = {};

      const middleware = sdk.verifyToken({ required: true });
      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ApiErrorCode.TOKEN_INVALID,
          message: 'Access token required',
        },
      });
    });

    it('should fail with invalid account ID', async () => {
      req.params.accountId = 'invalid-id';

      const middleware = sdk.verifyToken();
      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ApiErrorCode.VALIDATION_ERROR,
          message: 'Invalid Account ID format',
        },
      });
    });
  });

  // ============================================================================
  // loadSession Tests
  // ============================================================================

  describe('loadSession', () => {
    const mockSessionResponse = {
      session: {
        hasSession: true,
        accountIds: [mockAccountId],
        currentAccountId: mockAccountId,
        isValid: true,
      },
    };

    it('should successfully load session', async () => {
      req.cookies = { account_session: 'session-cookie' };
      (mockApiService.getSessionInfo as Mock).mockResolvedValue(mockSessionResponse);

      const middleware = sdk.loadSession();
      await middleware(req, res, mockNext);

      expect(mockApiService.getSessionInfo).toHaveBeenCalledWith('session-cookie');
      expect(req.sessionInfo).toEqual(mockSessionResponse.session);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should pass when session not required and not provided', async () => {
      req.cookies = {};

      const middleware = sdk.loadSession({ required: false });
      await middleware(req, res, mockNext);

      expect(mockApiService.getSessionInfo).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should fail when session required but not provided', async () => {
      req.cookies = {};

      const middleware = sdk.loadSession({ required: true });
      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ApiErrorCode.AUTH_FAILED,
          message: 'Session required',
        },
      });
    });
  });

  // ============================================================================
  // requirePermission Tests
  // ============================================================================

  describe('requirePermission', () => {
    beforeEach(() => {
      req.account = mockAccount;
    });

    it('should pass with correct account type', async () => {
      const middleware = sdk.requirePermission({ accountTypes: ['oauth'] });
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should fail with incorrect account type', async () => {
      const middleware = sdk.requirePermission({ accountTypes: ['local'] });
      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ApiErrorCode.PERMISSION_DENIED,
          message: 'Account type not authorized',
        },
      });
    });

    it('should pass with verified email', async () => {
      const middleware = sdk.requirePermission({ emailVerified: true });
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should fail with unverified email', async () => {
      req.account = {
        ...mockAccount,
        userDetails: { ...mockAccount.userDetails, emailVerified: false },
      };

      const middleware = sdk.requirePermission({ emailVerified: true });
      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ApiErrorCode.PERMISSION_DENIED,
          message: 'Email verification required',
        },
      });
    });

    it('should pass custom validator', async () => {
      const customValidator = vi.fn().mockReturnValue(true);
      const middleware = sdk.requirePermission({ customValidator });
      await middleware(req, res, mockNext);

      expect(customValidator).toHaveBeenCalledWith(mockAccount);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should fail custom validator', async () => {
      const customValidator = vi.fn().mockReturnValue(false);
      const middleware = sdk.requirePermission({ customValidator });
      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ApiErrorCode.PERMISSION_DENIED,
          message: 'Permission denied',
        },
      });
    });

    it('should fail when no account loaded', async () => {
      req.account = undefined;

      const middleware = sdk.requirePermission({ accountTypes: ['oauth'] });
      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ApiErrorCode.AUTH_FAILED,
          message: 'Account authentication required',
        },
      });
    });
  });

  // ============================================================================
  // Socket Client Preference Tests
  // ============================================================================

  describe('Socket Client Preference', () => {
    beforeEach(() => {
      req.params.accountId = mockAccountId;
      req.account = mockAccount;
      req.cookies = { [`access_token_${mockAccountId}`]: 'mock-token' };
    });

    it('should prefer HTTP when socket not connected', async () => {
      (mockSocketClient.isConnected as Mock).mockReturnValue(false);

      const sdkWithSocketPreference = new ApiSdk({
        httpClient: mockHttpClient,
        socketClient: mockSocketClient,
        preferSocket: true,
      });

      const middleware = sdkWithSocketPreference.validateTokenAccess();
      await middleware(req, res, mockNext);

      expect(mockApiService.verifyToken).toHaveBeenCalled();
      expect(mockSocketClient.verifyToken).not.toHaveBeenCalled();
    });

    it('should use socket when connected and preferred', async () => {
      (mockSocketClient.isConnected as Mock).mockReturnValue(true);
      (mockSocketClient.verifyToken as Mock).mockImplementation((token, type, callback) => {
        callback({ success: true, data: mockTokenVerificationResponse });
      });

      const sdkWithSocketPreference = new ApiSdk({
        httpClient: mockHttpClient,
        socketClient: mockSocketClient,
        preferSocket: true,
      });

      const middleware = sdkWithSocketPreference.validateTokenAccess();
      await middleware(req, res, mockNext);

      expect(mockSocketClient.verifyToken).toHaveBeenCalled();
      expect(mockApiService.verifyToken).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    beforeEach(() => {
      req.params.accountId = mockAccountId;
      req.account = mockAccount; // Load account for token validation
      req.cookies = { [`access_token_${mockAccountId}`]: 'mock-token' };
    });

    it('should handle token verification errors with redirect', async () => {
      (mockApiService.verifyToken as Mock).mockRejectedValue(new Error('Token expired'));

      const middleware = sdk.validateTokenAccess();
      await middleware(req, res, mockNext);

      expect(res.redirect).toHaveBeenCalledWith(302, expect.stringContaining('/tokens/refresh'));
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle network errors appropriately', async () => {
      const networkError = new Error('Network error');
      (mockApiService.verifyToken as Mock).mockRejectedValue(networkError);

      const middleware = sdk.verifyToken();
      await middleware(req, res, mockNext);

      // Should redirect since token verification failed
      expect(res.redirect).toHaveBeenCalledWith(302, expect.stringContaining('/tokens/refresh'));
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle service unavailable errors', async () => {
      const serviceError = new Error('Service unavailable');
      (mockApiService.checkUserExists as Mock).mockRejectedValue(serviceError);

      const middleware = sdk.validateAccountAccess();
      await middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ApiErrorCode.SERVER_ERROR,
          message: 'Account validation failed',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Path Prefix Handling Tests
  // ============================================================================

  describe('Path Prefix Handling', () => {
    it('should handle X-Path-Prefix header in redirects', async () => {
      req.params.accountId = mockAccountId;
      req.headers = { 'x-path-prefix': '/api/v1' };
      req.cookies = {}; // No token to trigger redirect

      const middleware = sdk.validateTokenAccess();
      req.account = mockAccount; // Need account loaded

      await middleware(req, res, mockNext);

      expect(res.redirect).toHaveBeenCalledWith(302, expect.stringContaining('/api/v1'));
    });
  });
});
