import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AuthClient } from '../client/auth-client';
import { AuthSocketClient } from '../client/socket-client';
import {
    AuthSDKConfig,
    SafeAccount,
    AccountType,
    ApiErrorCode
} from '../types';
import { createErrorResponse, removeRootUrl } from '../utils/response';

export class AuthSDK {
    private static instance: AuthSDK | null = null;
    private client: AuthClient;
    private socketClient: AuthSocketClient;
    private config: AuthSDKConfig;

    private constructor(config: AuthSDKConfig) {
        this.config = config;
        this.client = new AuthClient(config);
        this.socketClient = new AuthSocketClient(config);
    }

    static configure(config: AuthSDKConfig): void {
        AuthSDK.instance = new AuthSDK(config);
    }

    static getInstance(): AuthSDK {
        if (!AuthSDK.instance) {
            throw new Error('AuthSDK not configured. Call AuthSDK.configure() first.');
        }
        return AuthSDK.instance;
    }

    get getAuthClient(): AuthClient {
        return this.client;
    }

    get getSocketClient(): AuthSocketClient {
        return this.socketClient;
    }

    // Session validation middleware
    static validateSession(): RequestHandler {
        return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            try {
                const instance = AuthSDK.getInstance();
                const accountId = req.params.accountId;

                if (!accountId) {
                    res.status(400).json(createErrorResponse(
                        ApiErrorCode.MISSING_DATA,
                        'Account ID is required'
                    ));
                    return;
                }

                const accessToken = instance.extractAccessToken(req, accountId);
                const refreshToken = instance.extractRefreshToken(req, accountId);

                if (!accessToken && !refreshToken) {
                    res.status(401).json(createErrorResponse(
                        ApiErrorCode.TOKEN_INVALID,
                        'Access token or refresh token is required'
                    ));
                    return;
                }

                const result = await instance.client.validateSession(
                    accountId,
                    accessToken || undefined,
                    refreshToken || undefined
                );

                req.account = result.account;
                req.accountType = result.accountType;

                if (result.oauthAccessToken) {
                    req.oauthAccessToken = result.oauthAccessToken;
                }

                next();
            } catch (error) {
                console.error('Session validation error:', error);
                res.status(401).json(createErrorResponse(
                    ApiErrorCode.AUTH_FAILED,
                    error instanceof Error ? error.message : 'Session validation failed'
                ));
            }
        };
    }

    // Session validation with token refresh redirection logic
    static validateSessionWithRedirect(): RequestHandler {
        return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            try {
                const instance = AuthSDK.getInstance();
                const accountId = req.params.accountId;

                if (!accountId) {
                    res.status(400).json(createErrorResponse(
                        ApiErrorCode.MISSING_DATA,
                        'Account ID is required'
                    ));
                    return;
                }

                const accessToken = instance.extractAccessToken(req, accountId);
                const refreshToken = instance.extractRefreshToken(req, accountId);
                const isRefreshTokenPath = req.path === "/account/refreshToken";

                if (!accessToken && !refreshToken) {
                    res.status(401).json(createErrorResponse(
                        ApiErrorCode.TOKEN_INVALID,
                        'Access token or refresh token is required'
                    ));
                    return;
                }

                try {
                    const result = await instance.client.validateSession(
                        accountId,
                        accessToken || undefined,
                        refreshToken || undefined
                    );

                    req.account = result.account;
                    req.accountType = result.accountType;

                    if (result.oauthAccessToken) {
                        req.oauthAccessToken = result.oauthAccessToken;
                    }

                    next();
                } catch (sessionError) {
                    // Handle token expiration with redirect logic
                    const accountPath = accountId;

                    if (isRefreshTokenPath) {
                        // If refresh token is invalid/expired, redirect to logout
                        const logoutUrl = `../account/logout?accountId=${accountPath}`;
                        res.redirect(302, logoutUrl);
                        return;
                    } else {
                        // If access token is invalid/expired, redirect to refresh
                        const refreshUrl = `../${accountPath}/account/refreshToken`;
                        const originalUrl = `..${removeRootUrl(req.originalUrl)}`;
                        res.redirect(302, `${refreshUrl}?redirectUrl=${encodeURIComponent(originalUrl)}`);
                        return;
                    }
                }
            } catch (error) {
                console.error('Session validation with redirect error:', error);
                res.status(401).json(createErrorResponse(
                    ApiErrorCode.AUTH_FAILED,
                    error instanceof Error ? error.message : 'Session validation failed'
                ));
            }
        };
    }

    static requireAccountType(type: AccountType): RequestHandler {
        return (req: Request, res: Response, next: NextFunction): void => {
            if (!req.account) {
                res.status(401).json(createErrorResponse(
                    ApiErrorCode.AUTH_FAILED,
                    'Account not loaded. Use validateSession middleware first.'
                ));
                return;
            }

            if (req.account.accountType !== type) {
                res.status(403).json(createErrorResponse(
                    ApiErrorCode.PERMISSION_DENIED,
                    `This endpoint requires ${type} account type`
                ));
                return;
            }

            next();
        };
    }

    // Google middleware
    static requireGoogleScope(scopeName: string): RequestHandler {
        return AuthSDK.requireGoogleScopes([scopeName]);
    }

    static requireGoogleScopes(scopeNames: string[]): RequestHandler {
        return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            try {
                const instance = AuthSDK.getInstance();

                if (!req.account) {
                    res.status(401).json(createErrorResponse(
                        ApiErrorCode.AUTH_FAILED,
                        'Account not loaded. Use validateSession middleware first.'
                    ));
                    return;
                }

                if (req.account.accountType !== AccountType.OAuth) {
                    res.status(403).json(createErrorResponse(
                        ApiErrorCode.PERMISSION_DENIED,
                        'Google API access requires OAuth account'
                    ));
                    return;
                }

                if (!req.oauthAccessToken) {
                    res.status(401).json(createErrorResponse(
                        ApiErrorCode.TOKEN_INVALID,
                        'OAuth access token not available'
                    ));
                    return;
                }

                const result = await instance.client.validateGoogleAccess(
                    req.account.id,
                    req.oauthAccessToken,
                    scopeNames
                );

                if (!result.allScopesGranted) {
                    const missingScopes = scopeNames.filter(scope => !result.scopeResults[scope]);

                    res.status(403).json(createErrorResponse(
                        ApiErrorCode.INSUFFICIENT_SCOPE,
                        'Insufficient Google API permissions',
                        {
                            requiredScopes: scopeNames,
                            missingScopes,
                            scopeResults: result.scopeResults
                        }
                    ));
                    return;
                }

                req.validatedScopes = scopeNames;
                next();
            } catch (error) {
                console.error('Google scope validation error:', error);
                res.status(403).json(createErrorResponse(
                    ApiErrorCode.INSUFFICIENT_SCOPE,
                    error instanceof Error ? error.message : 'Scope validation failed'
                ));
            }
        };
    }

    static requireGoogleScopeUrl(scopeUrl: string): RequestHandler {
        return AuthSDK.requireGoogleScopeUrls([scopeUrl]);
    }

    static requireGoogleScopeUrls(scopeUrls: string[]): RequestHandler {
        // Convert scope URLs to scope names for validation
        const scopeNames = scopeUrls.map(url => {
            if (url.startsWith('https://www.googleapis.com/auth/')) {
                return url.replace('https://www.googleapis.com/auth/', '');
            }
            return url;
        });

        return AuthSDK.requireGoogleScopes(scopeNames);
    }

    // Helper methods
    private extractAccessToken(req: Request, accountId: string): string | null {
        const cookieToken = req.cookies?.[`access_token_${accountId}`];
        if (cookieToken) return cookieToken;

        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }

        return null;
    }

    private extractRefreshToken(req: Request, accountId: string): string | null {
        return req.cookies?.[`refresh_token_${accountId}`] || null;
    }
}