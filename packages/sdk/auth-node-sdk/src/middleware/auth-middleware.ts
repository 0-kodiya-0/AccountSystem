import { Request, Response, NextFunction } from 'express';
import { ApiErrorCode, InternalApiError, TokenVerificationResponse, ApiResponse } from '../types';
import { HttpClient } from '../client/auth-client';
import { InternalSocketClient } from '../client/socket-client';
import { ValidationUtils, ErrorUtils, PathUtils } from '../utils';

// ============================================================================
// SDK Configuration
// ============================================================================

export interface InternalApiSdkConfig {
  httpClient: HttpClient;
  socketClient?: InternalSocketClient;
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

export class InternalApiSdk {
  public httpClient: HttpClient;
  public socketClient?: InternalSocketClient;
  private enableLogging: boolean;
  private preferSocket: boolean;
  private accountServerBaseUrl?: string;

  constructor(config: InternalApiSdkConfig) {
    this.httpClient = config.httpClient;
    this.socketClient = config.socketClient;
    this.enableLogging = config.enableLogging || false;
    this.preferSocket = config.preferSocket || false;
    this.accountServerBaseUrl = config.accountServerBaseUrl;
  }

  private log(message: string, data?: any): void {
    if (this.enableLogging) {
      console.log(`[Internal API SDK] ${message}`, data || '');
    }
  }

  private logError(message: string, error?: any): void {
    if (this.enableLogging) {
      console.error(`[Internal API SDK Error] ${message}`, error || '');
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
    return this.preferSocket && !!this.socketClient && this.socketClient.isConnected();
  }

  private async callVerifyToken(
    token: string,
    tokenType: 'access' | 'refresh' = 'access',
  ): Promise<TokenVerificationResponse> {
    if (this.shouldUseSocket()) {
      return new Promise((resolve, reject) => {
        this.socketClient!.verifyToken(token, tokenType, (response) => {
          if (response.success) {
            resolve(response.data as TokenVerificationResponse);
          } else {
            reject(
              new InternalApiError(ApiErrorCode.TOKEN_INVALID, response.error?.message || 'Socket verification failed'),
            );
          }
        });
      });
    } else {
      return this.httpClient.verifyToken(token, tokenType);
    }
  }

  private async callCheckUserExists(accountId: string): Promise<any> {
    if (this.shouldUseSocket()) {
      return new Promise((resolve, reject) => {
        this.socketClient!.checkUserExists(accountId, (response) => {
          if (response.success) {
            resolve(response.data);
          } else {
            reject(
              new InternalApiError(ApiErrorCode.USER_NOT_FOUND, response.error?.message || 'Socket user check failed'),
            );
          }
        });
      });
    } else {
      return this.httpClient.checkUserExists(accountId);
    }
  }

  private async callGetUserById(accountId: string): Promise<any> {
    if (this.shouldUseSocket()) {
      return new Promise((resolve, reject) => {
        this.socketClient!.getUserById(accountId, (response) => {
          if (response.success) {
            resolve(response.data);
          } else {
            reject(
              new InternalApiError(ApiErrorCode.USER_NOT_FOUND, response.error?.message || 'Socket user fetch failed'),
            );
          }
        });
      });
    } else {
      return this.httpClient.getUserById(accountId);
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
      throw new InternalApiError(ApiErrorCode.SERVER_ERROR, 'Account server base URL not configured for token refresh');
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
    });

    if (error instanceof InternalApiError) {
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
      req.internalApi = {
        http: this.httpClient,
        socket: this.socketClient,
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
          this.logError('Account ID parameter missing', { param: accountIdParam });
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
          this.logError('Invalid account ID format', { accountId });
          sendErrorResponse(res, ApiErrorCode.VALIDATION_ERROR, 'Invalid Account ID format', 400);
          return;
        }

        this.log('Session authenticated', { accountId });
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

        this.log(`Validating account access via ${this.shouldUseSocket() ? 'Socket' : 'HTTP'}`, { accountId });

        // Check if account exists
        const existsResult = await this.callCheckUserExists(accountId);

        if (!existsResult.exists) {
          this.logError('Account not found', { accountId });
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

        this.log('Account access validated', { accountId, accountType: userResult.user.accountType });
        next();
      } catch (error) {
        this.logError('Account validation failed', error);

        if (error instanceof InternalApiError && error.code === ApiErrorCode.USER_NOT_FOUND) {
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
          this.logError('Account not loaded in middleware chain');
          sendErrorResponse(res, ApiErrorCode.SERVER_ERROR, 'Account not loaded in middleware chain', 500);
          return;
        }

        // Extract both tokens
        const accessToken = this.extractAccessToken(req, accountId);
        const refreshToken = this.extractRefreshToken(req, accountId);

        // Ensure at least one token is present
        if (!accessToken && !refreshToken) {
          this.logError('No tokens provided', { accountId });
          this.handleTokenError(
            req,
            res,
            new InternalApiError(ApiErrorCode.TOKEN_INVALID, 'Access or refresh token required'),
            accountId,
          );
          return;
        }

        // Verify access token if present
        if (accessToken) {
          try {
            this.log(`Verifying access token via ${this.shouldUseSocket() ? 'Socket' : 'HTTP'}`);
            const accessResult = await this.callVerifyToken(accessToken, 'access');

            // Validate token ownership
            if (accessResult.accountId !== accountId) {
              this.logError('Access token ownership mismatch', {
                tokenAccountId: accessResult.accountId,
                requestAccountId: accountId,
              });
              this.handleTokenError(
                req,
                res,
                new InternalApiError(ApiErrorCode.TOKEN_INVALID, 'Access token does not belong to this account'),
                accountId,
              );
              return;
            }

            // Validate account type consistency
            if (accessResult.accountType !== account.accountType) {
              this.logError('Access token account type mismatch', {
                tokenAccountType: accessResult.accountType,
                accountType: account.accountType,
              });
              this.handleTokenError(
                req,
                res,
                new InternalApiError(ApiErrorCode.TOKEN_INVALID, 'Access token account type mismatch'),
                accountId,
              );
              return;
            }

            // Attach access token data to request
            req.accessToken = accessToken;
            if (accessResult.accountType === 'oauth' && accessResult.oauthAccessToken) {
              req.oauthAccessToken = accessResult.oauthAccessToken;
            }

            this.log('Access token validated', { accountId, accountType: accessResult.accountType });
          } catch (error) {
            this.logError('Access token validation failed', error);
            this.handleTokenError(req, res, error, accountId);
            return;
          }
        }

        // Verify refresh token if present
        if (refreshToken) {
          try {
            this.log(`Verifying refresh token via ${this.shouldUseSocket() ? 'Socket' : 'HTTP'}`);
            const refreshResult = await this.callVerifyToken(refreshToken, 'refresh');

            // Validate token ownership
            if (refreshResult.accountId !== accountId) {
              this.logError('Refresh token ownership mismatch', {
                tokenAccountId: refreshResult.accountId,
                requestAccountId: accountId,
              });
              this.handleTokenError(
                req,
                res,
                new InternalApiError(ApiErrorCode.TOKEN_INVALID, 'Refresh token does not belong to this account'),
                accountId,
              );
              return;
            }

            // Validate account type consistency
            if (refreshResult.accountType !== account.accountType) {
              this.logError('Refresh token account type mismatch', {
                tokenAccountType: refreshResult.accountType,
                accountType: account.accountType,
              });
              this.handleTokenError(
                req,
                res,
                new InternalApiError(ApiErrorCode.TOKEN_INVALID, 'Refresh token account type mismatch'),
                accountId,
              );
              return;
            }

            // Attach refresh token data to request
            req.refreshToken = refreshToken;
            if (refreshResult.accountType === 'oauth' && refreshResult.oauthRefreshToken) {
              req.oauthRefreshToken = refreshResult.oauthRefreshToken;
            }

            this.log('Refresh token validated', { accountId, accountType: refreshResult.accountType });
          } catch (error) {
            this.logError('Refresh token validation failed', error);
            this.handleTokenError(req, res, error, accountId);
            return;
          }
        }

        this.log('Token access validated', {
          accountId,
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          accountType: account.accountType,
        });

        next();
      } catch (error) {
        this.logError('Token validation failed', error);
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

        if (!ValidationUtils.isValidObjectId(accountId)) {
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
            new InternalApiError(ApiErrorCode.TOKEN_INVALID, tokenResult.error || 'Invalid access token'),
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

        next();
      } catch (error) {
        this.logError('Token verification failed', error);
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

        // Call session info via internal API
        const sessionResult = await this.httpClient.getSessionInfo(sessionCookie);
        req.sessionInfo = sessionResult.session;

        this.log('Session loaded', {
          accountCount: sessionResult.session.accountIds.length,
          currentAccountId: sessionResult.session.currentAccountId,
        });

        next();
      } catch (error) {
        this.logError('Session loading failed', error);

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
          sendErrorResponse(res, ApiErrorCode.PERMISSION_DENIED, 'Account type not authorized', 403);
          return;
        }

        if (emailVerified && !req.account.userDetails?.emailVerified) {
          sendErrorResponse(res, ApiErrorCode.PERMISSION_DENIED, 'Email verification required', 403);
          return;
        }

        if (customValidator) {
          const isValid = await customValidator(req.account);
          if (!isValid) {
            sendErrorResponse(res, ApiErrorCode.PERMISSION_DENIED, 'Permission denied', 403);
            return;
          }
        }

        next();
      } catch (error) {
        this.logError('Permission check failed', error);
        sendErrorResponse(res, ApiErrorCode.SERVER_ERROR, 'Permission validation failed', 500);
      }
    };
  }
}
