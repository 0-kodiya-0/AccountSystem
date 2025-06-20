import { Request, Response, NextFunction } from 'express';
import { ApiErrorCode, InternalApiError } from '../types';
import { InternalHttpClient } from '../client/auth-client';
import { InternalSocketClient } from '../client/socket-client';

// ============================================================================
// SDK Configuration
// ============================================================================

export interface InternalApiSdkConfig {
  httpClient: InternalHttpClient;
  socketClient?: InternalSocketClient;
  enableLogging?: boolean;
  preferSocket?: boolean;
  accountServerBaseUrl?: string; // For token refresh redirects
}

// ============================================================================
// SDK Class
// ============================================================================

export class InternalApiSdk {
  private httpClient: InternalHttpClient;
  private socketClient?: InternalSocketClient;
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

  // ========================================================================
  // Client Selection Utilities
  // ========================================================================

  private shouldUseSocket(): boolean {
    return this.preferSocket && !!this.socketClient && this.socketClient.isConnected();
  }

  private async callVerifyToken(token: string, tokenType: 'access' | 'refresh' = 'access'): Promise<any> {
    if (this.shouldUseSocket()) {
      return new Promise((resolve, reject) => {
        this.socketClient!.verifyToken(token, tokenType, (response) => {
          if (response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response.error?.message || 'Socket verification failed'));
          }
        });
      });
    } else {
      return this.httpClient.verifyToken(token, tokenType);
    }
  }

  private async callGetUserById(accountId: string): Promise<any> {
    if (this.shouldUseSocket()) {
      return new Promise((resolve, reject) => {
        this.socketClient!.getUserById(accountId, (response) => {
          if (response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response.error?.message || 'Socket user fetch failed'));
          }
        });
      });
    } else {
      return this.httpClient.getUserById(accountId);
    }
  }

  private async callCheckUserExists(accountId: string): Promise<any> {
    if (this.shouldUseSocket()) {
      return new Promise((resolve, reject) => {
        this.socketClient!.checkUserExists(accountId, (response) => {
          if (response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response.error?.message || 'Socket user check failed'));
          }
        });
      });
    } else {
      return this.httpClient.checkUserExists(accountId);
    }
  }

  private async callGetSessionInfo(sessionCookie?: string): Promise<any> {
    if (this.shouldUseSocket()) {
      return new Promise((resolve, reject) => {
        this.socketClient!.getSessionInfo(sessionCookie, (response) => {
          if (response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response.error?.message || 'Socket session fetch failed'));
          }
        });
      });
    } else {
      return this.httpClient.getSessionInfo(sessionCookie);
    }
  }

  private async callValidateSession(accountId?: string, sessionCookie?: string): Promise<any> {
    if (this.shouldUseSocket()) {
      return new Promise((resolve, reject) => {
        this.socketClient!.validateSession({ accountId, sessionCookie }, (response) => {
          if (response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response.error?.message || 'Socket session validation failed'));
          }
        });
      });
    } else {
      return this.httpClient.validateSession(accountId, sessionCookie);
    }
  }

  // ========================================================================
  // Token Refresh Utilities
  // ========================================================================

  private buildRefreshUrl(req: Request, accountId: string): string {
    if (!this.accountServerBaseUrl) {
      throw new Error('Account server base URL not configured for token refresh');
    }

    if (!accountId) {
      throw new Error('Account ID is required for token refresh redirect');
    }

    const baseUrl = this.accountServerBaseUrl.replace(/\/$/, '');
    const refreshPath = `/${accountId}/tokens/refresh`;

    // Include original URL as redirect parameter
    const originalUrl = encodeURIComponent(req.originalUrl);
    return `${baseUrl}${refreshPath}?redirectUrl=${originalUrl}`;
  }

  private handleTokenError(req: Request, res: Response, error: any, accountId?: string) {
    if (error instanceof InternalApiError) {
      // Handle token expiration with redirect to refresh
      if (error.code === ApiErrorCode.TOKEN_EXPIRED || error.code === ApiErrorCode.TOKEN_INVALID) {
        if (this.accountServerBaseUrl && accountId) {
          const refreshUrl = this.buildRefreshUrl(req, accountId);
          this.log('Redirecting to token refresh', { refreshUrl, originalUrl: req.originalUrl });

          return res.redirect(302, refreshUrl);
        }

        // If missing required parameters, throw error without handling
        if (!this.accountServerBaseUrl) {
          throw new Error('Account server base URL not configured for token refresh');
        }

        if (!accountId) {
          throw new Error('Account ID is required for token refresh redirect');
        }
      }

      // Handle other API errors
      if (error.code === ApiErrorCode.CONNECTION_ERROR || error.code === ApiErrorCode.TIMEOUT_ERROR) {
        return res.status(503).json({
          success: false,
          error: {
            code: ApiErrorCode.SERVICE_UNAVAILABLE,
            message: 'Authentication service temporarily unavailable',
          },
        });
      }
    }

    // Generic auth failure
    return res.status(401).json({
      success: false,
      error: {
        code: ApiErrorCode.AUTH_FAILED,
        message: 'Token verification failed',
      },
    });
  }

  private extractTokenFromHeader(req: Request, type: 'access' | 'refresh' = 'access'): string | null {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;

    if (type === 'access' && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    const refreshHeader = req.headers['x-refresh-token'] as string;
    if (type === 'refresh' && refreshHeader) {
      return refreshHeader;
    }

    return null;
  }

  private extractTokenFromCookie(
    req: Request,
    accountId?: string,
    type: 'access' | 'refresh' = 'access',
  ): string | null {
    if (!req.cookies) return null;

    if (accountId) {
      const cookieName = `${accountId}_${type}_token`;
      return req.cookies[cookieName] || null;
    }

    const cookieName = `${type}_token`;
    return req.cookies[cookieName] || null;
  }

  // ========================================================================
  // Core Middleware Functions
  // ========================================================================

  injectClients() {
    return (req: Request, res: Response, next: NextFunction) => {
      req.internalApi = {
        http: this.httpClient,
        socket: this.socketClient,
      };
      next();
    };
  }

  verifyAccessToken(
    options: {
      fromHeader?: boolean;
      fromCookie?: boolean;
      accountIdParam?: string;
      required?: boolean;
      enableRefreshRedirect?: boolean;
    } = {},
  ) {
    const {
      fromHeader = true,
      fromCookie = true,
      accountIdParam,
      required = true,
      enableRefreshRedirect = true,
    } = options;

    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        let token: string | null = null;
        const accountId = accountIdParam ? req.params[accountIdParam] : undefined;

        if (fromHeader) {
          token = this.extractTokenFromHeader(req, 'access');
        }

        if (!token && fromCookie) {
          token = this.extractTokenFromCookie(req, accountId, 'access');
        }

        if (!token) {
          if (required) {
            this.logError('Access token not found');
            return res.status(401).json({
              success: false,
              error: {
                code: ApiErrorCode.TOKEN_INVALID,
                message: 'Access token required',
              },
            });
          }
          return next();
        }

        this.log(`Verifying access token via ${this.shouldUseSocket() ? 'Socket' : 'HTTP'}`);
        const tokenResult = await this.callVerifyToken(token, 'access');

        if (!tokenResult.valid) {
          this.logError('Invalid access token', tokenResult.error);

          // Handle token invalidity with potential redirect
          const error = new InternalApiError(ApiErrorCode.TOKEN_INVALID, tokenResult.error || 'Invalid access token');
          return this.handleTokenError(req, res, error, accountId);
        }

        req.accessToken = token;
        req.tokenData = {
          valid: tokenResult.valid,
          accountId: tokenResult.accountId,
          accountType: tokenResult.accountType,
          isRefreshToken: tokenResult.isRefreshToken,
          expiresAt: tokenResult.expiresAt,
        };

        this.log('Access token verified successfully', { accountId: tokenResult.accountId });
        next();
      } catch (error) {
        this.logError('Token verification failed', error);
        return this.handleTokenError(req, res, error);
      }
    };
  }

  loadUser(options: { required?: boolean } = {}) {
    const { required = true } = options;

    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.tokenData?.accountId) {
          if (required) {
            this.logError('No account ID in token data');
            return res.status(401).json({
              success: false,
              error: {
                code: ApiErrorCode.AUTH_FAILED,
                message: 'Valid token required to load user',
              },
            });
          }
          return next();
        }

        this.log(`Loading user data via ${this.shouldUseSocket() ? 'Socket' : 'HTTP'}`, {
          accountId: req.tokenData.accountId,
        });
        const userResult = await this.callGetUserById(req.tokenData.accountId);

        req.currentUser = userResult.user;
        this.log('User loaded successfully', { email: userResult.user.email });
        next();
      } catch (error) {
        this.logError('Failed to load user', error);

        if (error instanceof InternalApiError) {
          if (error.code === ApiErrorCode.USER_NOT_FOUND) {
            return res.status(404).json({
              success: false,
              error: {
                code: ApiErrorCode.USER_NOT_FOUND,
                message: 'User not found',
              },
            });
          }
        }

        return res.status(500).json({
          success: false,
          error: {
            code: ApiErrorCode.SERVER_ERROR,
            message: 'Failed to load user data',
          },
        });
      }
    };
  }

  validateAccountAccess(accountIdParam: string = 'accountId') {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const accountId = req.params[accountIdParam];

        if (!accountId) {
          this.logError('Account ID parameter missing');
          return res.status(400).json({
            success: false,
            error: {
              code: ApiErrorCode.MISSING_DATA,
              message: `Account ID parameter '${accountIdParam}' is required`,
            },
          });
        }

        this.log(`Validating account access via ${this.shouldUseSocket() ? 'Socket' : 'HTTP'}`, { accountId });
        const existsResult = await this.callCheckUserExists(accountId);

        if (!existsResult.exists) {
          this.logError('Account not found', { accountId });
          return res.status(404).json({
            success: false,
            error: {
              code: ApiErrorCode.USER_NOT_FOUND,
              message: 'Account not found',
            },
          });
        }

        if (req.tokenData?.accountId && req.tokenData.accountId !== accountId) {
          this.logError('Account access denied', {
            requestedAccount: accountId,
            currentAccount: req.tokenData.accountId,
          });
          return res.status(403).json({
            success: false,
            error: {
              code: ApiErrorCode.PERMISSION_DENIED,
              message: 'Access denied to this account',
            },
          });
        }

        this.log('Account access validated', { accountId });
        next();
      } catch (error) {
        this.logError('Account validation failed', error);
        return res.status(500).json({
          success: false,
          error: {
            code: ApiErrorCode.SERVER_ERROR,
            message: 'Account validation failed',
          },
        });
      }
    };
  }

  loadSession(
    options: {
      cookieName?: string;
      required?: boolean;
      validateAccount?: boolean;
    } = {},
  ) {
    const { cookieName = 'account_session', required = true, validateAccount = false } = options;

    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const sessionCookie = req.cookies?.[cookieName];

        if (!sessionCookie) {
          if (required) {
            this.logError('Session cookie not found');
            return res.status(401).json({
              success: false,
              error: {
                code: ApiErrorCode.AUTH_FAILED,
                message: 'Session required',
              },
            });
          }
          return next();
        }

        this.log(`Loading session information via ${this.shouldUseSocket() ? 'Socket' : 'HTTP'}`);
        const sessionResult = await this.callGetSessionInfo(sessionCookie);

        req.sessionInfo = sessionResult.session;

        if (validateAccount && req.tokenData?.accountId) {
          const accountInSession = sessionResult.session.accountIds.includes(req.tokenData.accountId);

          if (!accountInSession) {
            this.logError('Account not in session', {
              accountId: req.tokenData.accountId,
              sessionAccounts: sessionResult.session.accountIds,
            });
            return res.status(403).json({
              success: false,
              error: {
                code: ApiErrorCode.PERMISSION_DENIED,
                message: 'Account not authorized in current session',
              },
            });
          }
        }

        this.log('Session loaded successfully', {
          sessionId: sessionResult.session.sessionId,
          accountCount: sessionResult.session.accountIds.length,
        });
        next();
      } catch (error) {
        this.logError('Session loading failed', error);
        return res.status(500).json({
          success: false,
          error: {
            code: ApiErrorCode.SERVER_ERROR,
            message: 'Session validation failed',
          },
        });
      }
    };
  }

  requirePermission(options: {
    accountTypes?: string[];
    emailVerified?: boolean;
    customValidator?: (user: any) => boolean | Promise<boolean>;
  }) {
    const { accountTypes, emailVerified, customValidator } = options;

    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.currentUser) {
          this.logError('User data required for permission check');
          return res.status(401).json({
            success: false,
            error: {
              code: ApiErrorCode.AUTH_FAILED,
              message: 'User authentication required',
            },
          });
        }

        if (accountTypes && !accountTypes.includes(req.currentUser.accountType)) {
          this.logError('Account type not authorized', {
            required: accountTypes,
            actual: req.currentUser.accountType,
          });
          return res.status(403).json({
            success: false,
            error: {
              code: ApiErrorCode.PERMISSION_DENIED,
              message: 'Account type not authorized',
            },
          });
        }

        if (emailVerified && !req.currentUser.isEmailVerified) {
          this.logError('Email verification required');
          return res.status(403).json({
            success: false,
            error: {
              code: ApiErrorCode.PERMISSION_DENIED,
              message: 'Email verification required',
            },
          });
        }

        if (customValidator) {
          const isValid = await customValidator(req.currentUser);
          if (!isValid) {
            this.logError('Custom permission check failed');
            return res.status(403).json({
              success: false,
              error: {
                code: ApiErrorCode.PERMISSION_DENIED,
                message: 'Permission denied',
              },
            });
          }
        }

        this.log('Permission check passed');
        next();
      } catch (error) {
        this.logError('Permission check failed', error);
        return res.status(500).json({
          success: false,
          error: {
            code: ApiErrorCode.SERVER_ERROR,
            message: 'Permission validation failed',
          },
        });
      }
    };
  }

  // ========================================================================
  // Convenience Middleware Combinations
  // ========================================================================

  authenticate(
    options: {
      fromHeader?: boolean;
      fromCookie?: boolean;
      accountIdParam?: string;
      loadUser?: boolean;
      enableRefreshRedirect?: boolean;
    } = {},
  ) {
    const { loadUser = true, enableRefreshRedirect = true, ...tokenOptions } = options;

    const middlewares = [this.injectClients(), this.verifyAccessToken({ ...tokenOptions, enableRefreshRedirect })];

    if (loadUser) {
      middlewares.push(this.loadUser());
    }

    return middlewares;
  }

  authorize(
    options: {
      accountIdParam?: string;
      sessionCookieName?: string;
      validateSessionAccount?: boolean;
      enableRefreshRedirect?: boolean;
    } = {},
  ) {
    const {
      accountIdParam = 'accountId',
      sessionCookieName = 'account_session',
      validateSessionAccount = true,
      enableRefreshRedirect = true,
    } = options;

    return [
      this.injectClients(),
      this.verifyAccessToken({ accountIdParam, enableRefreshRedirect }),
      this.loadUser(),
      this.validateAccountAccess(accountIdParam),
      this.loadSession({
        cookieName: sessionCookieName,
        validateAccount: validateSessionAccount,
      }),
    ];
  }

  // ========================================================================
  // Client Selection Override Methods
  // ========================================================================

  useHttp() {
    const originalPreference = this.preferSocket;
    this.preferSocket = false;

    return {
      verifyAccessToken: this.verifyAccessToken.bind(this),
      loadUser: this.loadUser.bind(this),
      validateAccountAccess: this.validateAccountAccess.bind(this),
      loadSession: this.loadSession.bind(this),
      requirePermission: this.requirePermission.bind(this),
      authenticate: this.authenticate.bind(this),
      authorize: this.authorize.bind(this),
      restore: () => {
        this.preferSocket = originalPreference;
      },
    };
  }

  useSocket() {
    const originalPreference = this.preferSocket;
    this.preferSocket = true;

    return {
      verifyAccessToken: this.verifyAccessToken.bind(this),
      loadUser: this.loadUser.bind(this),
      validateAccountAccess: this.validateAccountAccess.bind(this),
      loadSession: this.loadSession.bind(this),
      requirePermission: this.requirePermission.bind(this),
      authenticate: this.authenticate.bind(this),
      authorize: this.authorize.bind(this),
      restore: () => {
        this.preferSocket = originalPreference;
      },
    };
  }
}
