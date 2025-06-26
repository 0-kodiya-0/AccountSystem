import { Request, Response, NextFunction } from 'express';
import { ApiErrorCode, ApiError, TokenVerificationResponse, ApiResponse } from '../types';
import { HttpClient } from '../client/HttpClient';
import { ApiService } from '../services/ApiService';
import { SocketClient } from '../client/SocketClient';
import { SocketService } from '../services/SocketService';
import { ValidationUtils, ErrorUtils, PathUtils } from '../utils';

// ============================================================================
// SDK Configuration
// ============================================================================

export interface ApiSdkConfig {
  httpClient: HttpClient;
  socketClient?: SocketClient;
  enableLogging?: boolean;
  preferSocket?: boolean;
  accountServerBaseUrl?: string; // For token refresh redirects
}

// ============================================================================
// Response Helper Functions
// ============================================================================

function createErrorResponse<T>(code: ApiErrorCode, message: string, statusCode: number = 400): ApiResponse<T> {
  return {
    success: false,
    error: {
      code,
      message,
    },
  };
}

function sendErrorResponse(res: Response, code: ApiErrorCode, message: string, statusCode: number = 400): void {
  res.status(statusCode).json(createErrorResponse(code, message, statusCode));
}

// ============================================================================
// SDK Class
// ============================================================================

export class ApiSdk {
  public httpClient: HttpClient;
  public apiService: ApiService;
  public socketClient?: SocketClient;
  public socketService?: SocketService;
  private enableLogging: boolean;
  private preferSocket: boolean;
  private accountServerBaseUrl?: string;

  constructor(config: ApiSdkConfig) {
    this.httpClient = config.httpClient;
    this.apiService = new ApiService(config.httpClient);
    this.socketClient = config.socketClient;
    this.socketService = config.socketClient ? new SocketService(config.socketClient) : undefined;
    this.enableLogging = config.enableLogging || false;
    this.preferSocket = config.preferSocket || false;
    this.accountServerBaseUrl = config.accountServerBaseUrl;
  }

  private log(message: string, data?: any): void {
    if (this.enableLogging) {
      console.log(`[API SDK] ${message}`, data || '');
    }
  }

  private logError(message: string, error?: any): void {
    if (this.enableLogging) {
      console.error(`[API SDK Error] ${message}`, error || '');
    }
  }

  // ============================================================================
  // Token Extraction (Matching Backend Pattern)
  // ============================================================================

  /**
   * Extract access token following backend pattern: access_token_${accountId}
   */
  private extractAccessToken(req: Request, accountId: string): string | null {
    // Check authorization header first (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check account-specific cookie (backend pattern)
    const cookieToken = req.cookies?.[`access_token_${accountId}`];
    if (cookieToken) {
      return cookieToken;
    }

    return null;
  }

  /**
   * Extract refresh token following backend pattern: refresh_token_${accountId}
   */
  private extractRefreshToken(req: Request, accountId: string): string | null {
    // Check refresh header
    const refreshHeader = req.headers['x-refresh-token'] as string;
    if (refreshHeader) {
      return refreshHeader;
    }

    // Check account-specific cookie (backend pattern)
    const cookieToken = req.cookies?.[`refresh_token_${accountId}`];
    if (cookieToken) {
      return cookieToken;
    }

    return null;
  }

  // ============================================================================
  // Client Selection Utilities
  // ============================================================================

  private shouldUseSocket(): boolean {
    return this.preferSocket && !!this.socketClient && !!this.socketService && this.socketClient.isConnected();
  }

  private async callVerifyToken(
    token: string,
    tokenType: 'access' | 'refresh' = 'access',
  ): Promise<TokenVerificationResponse> {
    if (this.shouldUseSocket()) {
      try {
        return await this.socketService!.verifyTokenAsync(token, tokenType);
      } catch (error) {
        this.logError('Socket token verification failed, falling back to HTTP', error);
        return this.apiService.verifyToken(token, tokenType);
      }
    } else {
      return this.apiService.verifyToken(token, tokenType);
    }
  }

  private async callCheckUserExists(accountId: string): Promise<any> {
    if (this.shouldUseSocket()) {
      try {
        return await this.socketService!.checkUserExistsAsync(accountId);
      } catch (error) {
        this.logError('Socket user exists check failed, falling back to HTTP', error);
        return this.apiService.checkUserExists(accountId);
      }
    } else {
      return this.apiService.checkUserExists(accountId);
    }
  }

  private async callGetUserById(accountId: string): Promise<any> {
    if (this.shouldUseSocket()) {
      try {
        return await this.socketService!.getUserByIdAsync(accountId);
      } catch (error) {
        this.logError('Socket user fetch failed, falling back to HTTP', error);
        return this.apiService.getUserById(accountId);
      }
    } else {
      return this.apiService.getUserById(accountId);
    }
  }

  private async callGetSessionInfo(sessionCookie?: string): Promise<any> {
    if (this.shouldUseSocket()) {
      try {
        return await this.socketService!.getSessionInfoAsync(sessionCookie);
      } catch (error) {
        this.logError('Socket session info failed, falling back to HTTP', error);
        return this.apiService.getSessionInfo(sessionCookie);
      }
    } else {
      return this.apiService.getSessionInfo(sessionCookie);
    }
  }

  // ============================================================================
  // Redirect Handling (Using PathUtils)
  // ============================================================================

  /**
   * Build refresh URL following backend redirect pattern
   */
  private buildRefreshUrl(req: Request, accountId: string): string {
    if (!this.accountServerBaseUrl) {
      throw new ApiError(ApiErrorCode.SERVER_ERROR, 'Account server base URL not configured for token refresh');
    }

    const pathPrefix = PathUtils.getPathPrefix(req.headers);
    const baseUrl = this.accountServerBaseUrl.replace(/\/$/, '');
    const refreshPath = PathUtils.buildRefreshPath(accountId, pathPrefix);
    const originalUrl = encodeURIComponent(req.originalUrl);

    return `${baseUrl}${refreshPath}?redirectUrl=${originalUrl}`;
  }

  /**
   * Handle token errors with proper redirect logic (mirrors backend)
   */
  private handleTokenError(req: Request, res: Response, error: any, accountId?: string): void {
    this.logError('Token error occurred', {
      error: ErrorUtils.getErrorMessage(error),
      accountId,
      url: req.originalUrl,
    });

    if (error instanceof ApiError) {
      // Handle token expiration/invalidity with redirect
      if (error.code === ApiErrorCode.TOKEN_EXPIRED || error.code === ApiErrorCode.TOKEN_INVALID) {
        if (this.accountServerBaseUrl && accountId) {
          try {
            const refreshUrl = this.buildRefreshUrl(req, accountId);
            this.log('Redirecting to token refresh', {
              refreshUrl,
              originalUrl: req.originalUrl,
              accountId,
            });

            res.redirect(302, refreshUrl);
            return;
          } catch (redirectError) {
            this.logError('Failed to build refresh URL', redirectError);
          }
        }
      }

      // Handle service unavailability
      if (ErrorUtils.isNetworkError(error)) {
        sendErrorResponse(res, ApiErrorCode.SERVICE_UNAVAILABLE, 'Authentication service temporarily unavailable', 503);
        return;
      }
    }

    // Generic auth failure
    sendErrorResponse(res, ApiErrorCode.AUTH_FAILED, 'Authentication failed', 401);
  }

  // ============================================================================
  // Core Middleware Functions (Following Backend Pattern)
  // ============================================================================

  /**
   * Inject API clients into request
   */
  injectClients() {
    return (req: Request, res: Response, next: NextFunction) => {
      req.apiClients = {
        http: this.httpClient,
        api: this.apiService,
        socket: this.socketClient,
        socketService: this.socketService,
      };
      next();
    };
  }

  /**
   * Step 1: Authenticate Session (mirrors backend authenticateSession)
   * Validates accountId parameter format
   */
  authenticateSession(accountIdParam: string = 'accountId') {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const accountId = req.params[accountIdParam];

        if (!accountId) {
          this.logError('Account ID parameter missing', { param: accountIdParam, url: req.originalUrl });
          sendErrorResponse(
            res,
            ApiErrorCode.MISSING_DATA,
            `Account ID parameter '${accountIdParam}' is required`,
            400,
          );
          return;
        }

        // Validate ObjectId format using ValidationUtils
        if (!ValidationUtils.isValidObjectId(accountId)) {
          this.logError('Invalid account ID format', { accountId, url: req.originalUrl });
          sendErrorResponse(res, ApiErrorCode.VALIDATION_ERROR, 'Invalid Account ID format', 400);
          return;
        }

        this.log('Session authenticated', { accountId, url: req.originalUrl });
        next();
      } catch (error) {
        this.logError('Session authentication failed', error);
        sendErrorResponse(res, ApiErrorCode.SERVER_ERROR, 'Session authentication failed', 500);
      }
    };
  }

  /**
   * Step 2: Validate Account Access (mirrors backend validateAccountAccess)
   * Verifies account exists and loads account data
   */
  validateAccountAccess(accountIdParam: string = 'accountId') {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const accountId = req.params[accountIdParam];

        this.log(`Validating account access via ${this.shouldUseSocket() ? 'Socket' : 'HTTP'}`, {
          accountId,
          url: req.originalUrl,
        });

        // Check if account exists
        const existsResult = await this.callCheckUserExists(accountId);

        if (!existsResult.exists) {
          this.logError('Account not found', { accountId, url: req.originalUrl });
          sendErrorResponse(res, ApiErrorCode.USER_NOT_FOUND, 'Account not found', 404);
          return;
        }

        // Load full account data (mirrors backend behavior)
        const userResult = await this.callGetUserById(accountId);
        req.account = userResult.user;

        // Set legacy properties for backward compatibility
        if (userResult.user.accountType === 'oauth') {
          req.oauthAccount = userResult.user;
        } else {
          req.localAccount = userResult.user;
        }

        this.log('Account access validated', {
          accountId,
          accountType: userResult.user.accountType,
          url: req.originalUrl,
        });
        next();
      } catch (error) {
        this.logError('Account validation failed', { error: ErrorUtils.getErrorMessage(error), url: req.originalUrl });

        if (error instanceof ApiError && error.code === ApiErrorCode.USER_NOT_FOUND) {
          sendErrorResponse(res, ApiErrorCode.USER_NOT_FOUND, 'Account not found', 404);
          return;
        }

        sendErrorResponse(res, ApiErrorCode.SERVER_ERROR, 'Account validation failed', 500);
      }
    };
  }

  /**
   * Step 3: Validate Token Access (mirrors backend validateTokenAccess)
   * Extracts and validates both access and refresh tokens
   */
  validateTokenAccess(accountIdParam: string = 'accountId') {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const accountId = req.params[accountIdParam];
        const account = req.account;

        if (!account) {
          this.logError('Account not loaded in middleware chain', { url: req.originalUrl });
          sendErrorResponse(res, ApiErrorCode.SERVER_ERROR, 'Account not loaded in middleware chain', 500);
          return;
        }

        // Extract both tokens
        const accessToken = this.extractAccessToken(req, accountId);
        const refreshToken = this.extractRefreshToken(req, accountId);

        // Ensure at least one token is present
        if (!accessToken && !refreshToken) {
          this.logError('No tokens provided', { accountId, url: req.originalUrl });
          this.handleTokenError(
            req,
            res,
            new ApiError(ApiErrorCode.TOKEN_INVALID, 'Access or refresh token required'),
            accountId,
          );
          return;
        }

        // Verify access token if present
        if (accessToken) {
          try {
            this.log(`Verifying access token via ${this.shouldUseSocket() ? 'Socket' : 'HTTP'}`, {
              accountId,
              url: req.originalUrl,
            });
            const accessResult = await this.callVerifyToken(accessToken, 'access');

            // Validate token ownership
            if (accessResult.accountId !== accountId) {
              this.logError('Access token ownership mismatch', {
                tokenAccountId: accessResult.accountId,
                requestAccountId: accountId,
                url: req.originalUrl,
              });
              this.handleTokenError(
                req,
                res,
                new ApiError(ApiErrorCode.TOKEN_INVALID, 'Access token does not belong to this account'),
                accountId,
              );
              return;
            }

            // Validate account type consistency
            if (accessResult.accountType !== account.accountType) {
              this.logError('Access token account type mismatch', {
                tokenAccountType: accessResult.accountType,
                accountType: account.accountType,
                url: req.originalUrl,
              });
              this.handleTokenError(
                req,
                res,
                new ApiError(ApiErrorCode.TOKEN_INVALID, 'Access token account type mismatch'),
                accountId,
              );
              return;
            }

            // Attach access token data to request
            req.accessToken = accessToken;
            if (accessResult.accountType === 'oauth' && accessResult.oauthAccessToken) {
              req.oauthAccessToken = accessResult.oauthAccessToken;
            }

            this.log('Access token validated', {
              accountId,
              accountType: accessResult.accountType,
              expiresAt: accessResult.expiresAt,
              url: req.originalUrl,
            });
          } catch (error) {
            this.logError('Access token validation failed', {
              error: ErrorUtils.getErrorMessage(error),
              url: req.originalUrl,
            });
            this.handleTokenError(req, res, error, accountId);
            return;
          }
        }

        // Verify refresh token if present
        if (refreshToken) {
          try {
            this.log(`Verifying refresh token via ${this.shouldUseSocket() ? 'Socket' : 'HTTP'}`, {
              accountId,
              url: req.originalUrl,
            });
            const refreshResult = await this.callVerifyToken(refreshToken, 'refresh');

            // Validate token ownership
            if (refreshResult.accountId !== accountId) {
              this.logError('Refresh token ownership mismatch', {
                tokenAccountId: refreshResult.accountId,
                requestAccountId: accountId,
                url: req.originalUrl,
              });
              this.handleTokenError(
                req,
                res,
                new ApiError(ApiErrorCode.TOKEN_INVALID, 'Refresh token does not belong to this account'),
                accountId,
              );
              return;
            }

            // Validate account type consistency
            if (refreshResult.accountType !== account.accountType) {
              this.logError('Refresh token account type mismatch', {
                tokenAccountType: refreshResult.accountType,
                accountType: account.accountType,
                url: req.originalUrl,
              });
              this.handleTokenError(
                req,
                res,
                new ApiError(ApiErrorCode.TOKEN_INVALID, 'Refresh token account type mismatch'),
                accountId,
              );
              return;
            }

            // Attach refresh token data to request
            req.refreshToken = refreshToken;
            if (refreshResult.accountType === 'oauth' && refreshResult.oauthRefreshToken) {
              req.oauthRefreshToken = refreshResult.oauthRefreshToken;
            }

            this.log('Refresh token validated', {
              accountId,
              accountType: refreshResult.accountType,
              expiresAt: refreshResult.expiresAt,
              url: req.originalUrl,
            });
          } catch (error) {
            this.logError('Refresh token validation failed', {
              error: ErrorUtils.getErrorMessage(error),
              url: req.originalUrl,
            });
            this.handleTokenError(req, res, error, accountId);
            return;
          }
        }

        this.log('Token access validated', {
          accountId,
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          accountType: account.accountType,
          url: req.originalUrl,
        });

        next();
      } catch (error) {
        this.logError('Token validation failed', {
          error: ErrorUtils.getErrorMessage(error),
          url: req.originalUrl,
        });
        const accountId = req.params[accountIdParam];
        this.handleTokenError(req, res, error, accountId);
      }
    };
  }

  // ============================================================================
  // Combined Middleware (Following Backend Pattern)
  // ============================================================================

  /**
   * Full authentication middleware that mirrors backend middleware chain:
   * authenticateSession -> validateAccountAccess -> validateTokenAccess
   */
  authenticate(accountIdParam: string = 'accountId') {
    return [
      this.injectClients(),
      this.authenticateSession(accountIdParam),
      this.validateAccountAccess(accountIdParam),
      this.validateTokenAccess(accountIdParam),
    ];
  }

  /**
   * Lightweight token verification without full account loading
   */
  verifyToken(
    options: {
      fromHeader?: boolean;
      fromCookie?: boolean;
      accountIdParam?: string;
      required?: boolean;
    } = {},
  ) {
    const { fromHeader = true, fromCookie = true, accountIdParam = 'accountId', required = true } = options;

    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        let token: string | null = null;
        const accountId = req.params[accountIdParam];

        if (!accountId && required) {
          sendErrorResponse(res, ApiErrorCode.MISSING_DATA, 'Account ID required', 400);
          return;
        }

        if (accountId && !ValidationUtils.isValidObjectId(accountId)) {
          sendErrorResponse(res, ApiErrorCode.VALIDATION_ERROR, 'Invalid Account ID format', 400);
          return;
        }

        if (fromHeader) {
          const authHeader = req.headers.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
          }
        }

        if (!token && fromCookie && accountId) {
          token = this.extractAccessToken(req, accountId);
        }

        if (!token) {
          if (required) {
            sendErrorResponse(res, ApiErrorCode.TOKEN_INVALID, 'Access token required', 401);
            return;
          }
          return next();
        }

        const tokenResult = await this.callVerifyToken(token, 'access');

        if (!tokenResult.valid) {
          this.handleTokenError(
            req,
            res,
            new ApiError(ApiErrorCode.TOKEN_INVALID, tokenResult.error || 'Invalid access token'),
            accountId,
          );
          return;
        }

        req.accessToken = token;
        req.tokenData = {
          valid: tokenResult.valid,
          accountId: tokenResult.accountId,
          accountType: tokenResult.accountType,
          isRefreshToken: tokenResult.isRefreshToken,
          expiresAt: tokenResult.expiresAt,
        };

        this.log('Token verified', {
          accountId: tokenResult.accountId,
          accountType: tokenResult.accountType,
          url: req.originalUrl,
        });

        next();
      } catch (error) {
        this.logError('Token verification failed', {
          error: ErrorUtils.getErrorMessage(error),
          url: req.originalUrl,
        });
        this.handleTokenError(req, res, error, req.params[accountIdParam]);
      }
    };
  }

  // ============================================================================
  // Session and Permission Middleware
  // ============================================================================

  /**
   * Load session information (optional middleware)
   */
  loadSession(options: { required?: boolean } = {}) {
    const { required = false } = options;

    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const sessionCookie = req.cookies?.['account_session'];

        if (!sessionCookie) {
          if (required) {
            sendErrorResponse(res, ApiErrorCode.AUTH_FAILED, 'Session required', 401);
            return;
          }
          return next();
        }

        // Call session info via service
        const sessionResult = await this.callGetSessionInfo(sessionCookie);
        req.sessionInfo = sessionResult.session;

        this.log('Session loaded', {
          accountCount: sessionResult.session.accountIds.length,
          currentAccountId: sessionResult.session.currentAccountId,
          url: req.originalUrl,
        });

        next();
      } catch (error) {
        this.logError('Session loading failed', {
          error: ErrorUtils.getErrorMessage(error),
          url: req.originalUrl,
        });

        if (required) {
          sendErrorResponse(res, ApiErrorCode.AUTH_FAILED, 'Invalid session', 401);
          return;
        }

        next();
      }
    };
  }

  /**
   * Require specific permissions
   */
  requirePermission(options: {
    accountTypes?: string[];
    emailVerified?: boolean;
    customValidator?: (account: any) => boolean | Promise<boolean>;
  }) {
    const { accountTypes, emailVerified, customValidator } = options;

    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.account) {
          sendErrorResponse(res, ApiErrorCode.AUTH_FAILED, 'Account authentication required', 401);
          return;
        }

        if (accountTypes && !accountTypes.includes(req.account.accountType)) {
          this.logError('Account type not authorized', {
            requiredTypes: accountTypes,
            actualType: req.account.accountType,
            accountId: req.account.id,
            url: req.originalUrl,
          });
          sendErrorResponse(res, ApiErrorCode.PERMISSION_DENIED, 'Account type not authorized', 403);
          return;
        }

        if (emailVerified && !req.account.userDetails?.emailVerified) {
          this.logError('Email verification required', {
            accountId: req.account.id,
            emailVerified: req.account.userDetails?.emailVerified,
            url: req.originalUrl,
          });
          sendErrorResponse(res, ApiErrorCode.PERMISSION_DENIED, 'Email verification required', 403);
          return;
        }

        if (customValidator) {
          const isValid = await customValidator(req.account);
          if (!isValid) {
            this.logError('Custom validation failed', {
              accountId: req.account.id,
              url: req.originalUrl,
            });
            sendErrorResponse(res, ApiErrorCode.PERMISSION_DENIED, 'Permission denied', 403);
            return;
          }
        }

        this.log('Permission check passed', {
          accountId: req.account.id,
          accountType: req.account.accountType,
          url: req.originalUrl,
        });

        next();
      } catch (error) {
        this.logError('Permission check failed', {
          error: ErrorUtils.getErrorMessage(error),
          url: req.originalUrl,
        });
        sendErrorResponse(res, ApiErrorCode.SERVER_ERROR, 'Permission validation failed', 500);
      }
    };
  }
}
