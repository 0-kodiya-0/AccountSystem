import { InternalHttpClient } from '../client/auth-client';
import { InternalSocketClient } from '../client/socket-client';
import { InternalApiSdk, InternalApiSdkConfig } from '../middleware/auth-middleware';
import { InternalHttpClientConfig, InternalSocketClientConfig } from '../types';

/**
 * Create HTTP client for internal API communication
 */
export function createHttpClient(config: InternalHttpClientConfig): InternalHttpClient {
  return new InternalHttpClient(config);
}

/**
 * Create Socket client for real-time internal API communication
 */
export function createSocketClient(config: InternalSocketClientConfig): InternalSocketClient {
  return new InternalSocketClient(config);
}

/**
 * Create complete Internal API SDK with both HTTP and Socket clients
 */
export function createInternalApiSdk(config: InternalApiSdkConfig): InternalApiSdk {
  return new InternalApiSdk(config);
}

/**
 * Quick setup utility for common SDK configuration
 */
export function createQuickSdk(options: {
  // Required
  baseUrl: string;
  serviceId: string;
  serviceSecret: string;
  serviceName: string;
  accountServerBaseUrl?: string;

  // Optional
  enableSocket?: boolean;
  enableLogging?: boolean;
  preferSocket?: boolean;
  timeout?: number;
}): InternalApiSdk {
  const {
    baseUrl,
    serviceId,
    serviceSecret,
    serviceName,
    accountServerBaseUrl,
    enableSocket = true,
    enableLogging = false,
    preferSocket = false,
    timeout = 30000,
  } = options;

  // Create HTTP client
  const httpClient = createHttpClient({
    baseUrl,
    serviceId,
    serviceSecret,
    timeout,
    enableLogging,
  });

  // Create Socket client if enabled
  let socketClient: InternalSocketClient | undefined;
  if (enableSocket) {
    socketClient = createSocketClient({
      baseUrl,
      serviceId,
      serviceName,
      serviceSecret,
      timeout,
      enableLogging,
      autoConnect: true,
      maxReconnectAttempts: 5,
    });
  }

  // Create and return SDK
  return createInternalApiSdk({
    httpClient,
    socketClient,
    enableLogging,
    preferSocket,
    accountServerBaseUrl,
  });
}

/**
 * Validation utilities that mirror backend ValidationUtils
 */
export class ValidationUtils {
  /**
   * Validate MongoDB ObjectId format
   */
  static isValidObjectId(id: string): boolean {
    return /^[0-9a-fA-F]{24}$/.test(id);
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate URL format
   */
  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate account type
   */
  static isValidAccountType(type: string): boolean {
    return ['oauth', 'local'].includes(type.toLowerCase());
  }

  /**
   * Extract account ID from URL path
   */
  static extractAccountIdFromPath(path: string): string | null {
    const match = path.match(/\/([0-9a-fA-F]{24})\//);
    return match ? match[1] : null;
  }

  /**
   * Build redirect URL with query parameters
   */
  static buildRedirectUrl(baseUrl: string, params: Record<string, string | number | boolean>): string {
    const url = new URL(baseUrl);

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });

    return url.toString();
  }
}

/**
 * Error handling utilities
 */
export class ErrorUtils {
  /**
   * Check if error is a network/connection error
   */
  static isNetworkError(error: any): boolean {
    if (!error) return false;

    const networkCodes = ['ECONNREFUSED', 'ENOTFOUND', 'ECONNABORTED', 'ETIMEDOUT'];
    return networkCodes.includes(error.code) || (error.response && error.response.status >= 500);
  }

  /**
   * Check if error is an authentication error
   */
  static isAuthError(error: any): boolean {
    if (!error) return false;

    return error.response?.status === 401 || ['AUTH_FAILED', 'TOKEN_EXPIRED', 'TOKEN_INVALID'].includes(error.code);
  }

  /**
   * Extract error message from various error formats
   */
  static getErrorMessage(error: any): string {
    if (typeof error === 'string') return error;
    if (error.message) return error.message;
    if (error.response?.data?.error?.message) return error.response.data.error.message;
    if (error.response?.data?.message) return error.response.data.message;
    return 'An unknown error occurred';
  }

  /**
   * Get HTTP status code from error
   */
  static getStatusCode(error: any): number {
    if (error.statusCode) return error.statusCode;
    if (error.response?.status) return error.response.status;
    if (error.code === 'ECONNREFUSED') return 503;
    if (error.code === 'ETIMEDOUT') return 408;
    return 500;
  }
}

/**
 * Cookie utilities that match backend cookie handling
 */
export class CookieUtils {
  /**
   * Extract account-specific access token cookie name
   */
  static getAccessTokenCookieName(accountId: string): string {
    return `access_token_${accountId}`;
  }

  /**
   * Extract account-specific refresh token cookie name
   */
  static getRefreshTokenCookieName(accountId: string): string {
    return `refresh_token_${accountId}`;
  }

  /**
   * Get account session cookie name
   */
  static getSessionCookieName(): string {
    return 'account_session';
  }

  /**
   * Parse cookie string into object
   */
  static parseCookies(cookieString: string): Record<string, string> {
    const cookies: Record<string, string> = {};

    if (!cookieString) return cookies;

    cookieString.split(';').forEach((cookie) => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });

    return cookies;
  }

  /**
   * Extract token from cookies using account-specific pattern
   */
  static extractTokenFromCookies(
    cookies: Record<string, string>,
    accountId: string,
    tokenType: 'access' | 'refresh' = 'access',
  ): string | null {
    const cookieName =
      tokenType === 'access' ? this.getAccessTokenCookieName(accountId) : this.getRefreshTokenCookieName(accountId);

    return cookies[cookieName] || null;
  }
}

/**
 * Path utilities for handling proxy prefixes and redirects
 */
export class PathUtils {
  /**
   * Get stripped path prefix from request headers
   */
  static getPathPrefix(headers: Record<string, string | string[] | undefined>): string {
    const prefix = headers['x-path-prefix'];
    return Array.isArray(prefix) ? prefix[0] || '' : prefix || '';
  }

  /**
   * Build account-specific path
   */
  static buildAccountPath(accountId: string, subPath: string = ''): string {
    const cleanSubPath = subPath.startsWith('/') ? subPath : `/${subPath}`;
    return `/${accountId}${cleanSubPath}`;
  }

  /**
   * Build refresh token path for account
   */
  static buildRefreshPath(accountId: string, pathPrefix: string = ''): string {
    const basePath = pathPrefix ? `${pathPrefix}/${accountId}` : `/${accountId}`;
    return `${basePath}/tokens/refresh`;
  }

  /**
   * Build logout path for account
   */
  static buildLogoutPath(accountId: string, pathPrefix: string = '', clearClientState: boolean = false): string {
    const basePath = pathPrefix ? `${pathPrefix}/${accountId}` : `/${accountId}`;
    return `${basePath}/account/logout?accountId=${accountId}&clearClientAccountState=${clearClientState}`;
  }

  /**
   * Resolve relative path with proper handling
   */
  static resolveRelativePath(basePath: string, relativePath: string): string {
    if (relativePath.startsWith('./')) {
      return `${basePath}/${relativePath.substring(2)}`;
    }

    if (relativePath.startsWith('../')) {
      const parentPath = basePath.substring(0, basePath.lastIndexOf('/'));
      return `${parentPath}/${relativePath.substring(3)}`;
    }

    return relativePath;
  }
}
