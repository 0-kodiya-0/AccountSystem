export enum AccountType {
  Local = 'local',
  OAuth = 'oauth',
}

export enum ApiErrorCode {
  // Network & Connection Errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR',

  // Authentication Errors
  AUTH_FAILED = 'AUTH_FAILED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_MISSING = 'TOKEN_MISSING',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',

  // Authorization Errors
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  ACCESS_DENIED = 'ACCESS_DENIED',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',

  // Validation Errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_EMAIL = 'INVALID_EMAIL',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  PASSWORD_TOO_WEAK = 'PASSWORD_TOO_WEAK',
  PASSWORDS_DONT_MATCH = 'PASSWORDS_DONT_MATCH',

  // User/Account Errors
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_EXISTS = 'USER_EXISTS',
  ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  EMAIL_ALREADY_VERIFIED = 'EMAIL_ALREADY_VERIFIED',

  // Two-Factor Authentication Errors
  TWO_FACTOR_REQUIRED = 'TWO_FACTOR_REQUIRED',
  TWO_FACTOR_INVALID = 'TWO_FACTOR_INVALID',
  TWO_FACTOR_NOT_ENABLED = 'TWO_FACTOR_NOT_ENABLED',
  BACKUP_CODE_INVALID = 'BACKUP_CODE_INVALID',

  // OAuth Errors
  OAUTH_ERROR = 'OAUTH_ERROR',
  OAUTH_CANCELLED = 'OAUTH_CANCELLED',
  OAUTH_TOKEN_INVALID = 'OAUTH_TOKEN_INVALID',
  OAUTH_SCOPE_INSUFFICIENT = 'OAUTH_SCOPE_INSUFFICIENT',
  OAUTH_PROVIDER_ERROR = 'OAUTH_PROVIDER_ERROR',

  // Resource Errors
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  RESOURCE_LOCKED = 'RESOURCE_LOCKED',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  LOCKOUT_ACTIVE = 'LOCKOUT_ACTIVE',

  // Server Errors
  SERVER_ERROR = 'SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  MAINTENANCE_MODE = 'MAINTENANCE_MODE',

  // Client Errors
  BAD_REQUEST = 'BAD_REQUEST',
  MISSING_DATA = 'MISSING_DATA',
  INVALID_FORMAT = 'INVALID_FORMAT',
  UNSUPPORTED_OPERATION = 'UNSUPPORTED_OPERATION',

  // Email/Password Reset Errors
  EMAIL_SEND_FAILED = 'EMAIL_SEND_FAILED',
  RESET_TOKEN_EXPIRED = 'RESET_TOKEN_EXPIRED',
  RESET_TOKEN_INVALID = 'RESET_TOKEN_INVALID',
  RESET_LIMIT_EXCEEDED = 'RESET_LIMIT_EXCEEDED',

  // Verification Errors
  VERIFICATION_TOKEN_EXPIRED = 'VERIFICATION_TOKEN_EXPIRED',
  VERIFICATION_TOKEN_INVALID = 'VERIFICATION_TOKEN_INVALID',
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  VERIFICATION_LIMIT_EXCEEDED = 'VERIFICATION_LIMIT_EXCEEDED',

  // Unknown/Generic
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// ============================================================================
// Error Response Interface
// ============================================================================

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  statusCode?: number;
  field?: string; // For validation errors
  timestamp?: string;
  requestId?: string;
  details?: Record<string, any>;
}

export class AuthSDKError extends Error {
  public readonly code: ApiErrorCode;
  public readonly statusCode?: number;
  public readonly field?: string;
  public readonly timestamp: string;
  public readonly requestId?: string;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    code: ApiErrorCode = ApiErrorCode.UNKNOWN_ERROR,
    statusCode?: number,
    options: {
      field?: string;
      requestId?: string;
      details?: Record<string, any>;
    } = {},
  ) {
    super(message);
    this.name = 'AuthSDKError';
    this.code = code;
    this.statusCode = statusCode;
    this.field = options.field;
    this.timestamp = new Date().toISOString();
    this.requestId = options.requestId;
    this.details = options.details;
  }

  /**
   * Create error from API response
   */
  static fromApiResponse(response: any, statusCode?: number): AuthSDKError {
    const code = response?.error?.code || response?.code || ApiErrorCode.UNKNOWN_ERROR;
    const message = response?.error?.message || response?.message || 'Unknown error occurred';

    return new AuthSDKError(message, code, statusCode, {
      field: response?.error?.field || response?.field,
      requestId: response?.requestId,
      details: response?.error?.details || response?.details,
    });
  }

  /**
   * Check if error is of specific type
   */
  is(code: ApiErrorCode): boolean {
    return this.code === code;
  }

  /**
   * Check if error is authentication related
   */
  isAuthError(): boolean {
    return [
      ApiErrorCode.AUTH_FAILED,
      ApiErrorCode.TOKEN_EXPIRED,
      ApiErrorCode.TOKEN_INVALID,
      ApiErrorCode.TOKEN_MISSING,
      ApiErrorCode.SESSION_EXPIRED,
      ApiErrorCode.INVALID_CREDENTIALS,
    ].includes(this.code);
  }

  /**
   * Check if error is validation related
   */
  isValidationError(): boolean {
    return [
      ApiErrorCode.VALIDATION_ERROR,
      ApiErrorCode.INVALID_EMAIL,
      ApiErrorCode.INVALID_PASSWORD,
      ApiErrorCode.PASSWORD_TOO_WEAK,
      ApiErrorCode.PASSWORDS_DONT_MATCH,
    ].includes(this.code);
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return [
      ApiErrorCode.NETWORK_ERROR,
      ApiErrorCode.TIMEOUT_ERROR,
      ApiErrorCode.CONNECTION_ERROR,
      ApiErrorCode.SERVER_ERROR,
      ApiErrorCode.SERVICE_UNAVAILABLE,
    ].includes(this.code);
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    switch (this.code) {
      case ApiErrorCode.NETWORK_ERROR:
        return 'Network connection failed. Please check your internet connection.';
      case ApiErrorCode.TOKEN_EXPIRED:
        return 'Your session has expired. Please sign in again.';
      case ApiErrorCode.INVALID_CREDENTIALS:
        return 'Invalid email or password. Please try again.';
      case ApiErrorCode.USER_NOT_FOUND:
        return 'Account not found. Please check your email address.';
      case ApiErrorCode.EMAIL_NOT_VERIFIED:
        return 'Please verify your email address before continuing.';
      case ApiErrorCode.PASSWORD_TOO_WEAK:
        return 'Password is too weak. Please choose a stronger password.';
      case ApiErrorCode.RATE_LIMIT_EXCEEDED:
        return 'Too many attempts. Please wait before trying again.';
      case ApiErrorCode.SERVER_ERROR:
        return 'Something went wrong on our end. Please try again later.';
      default:
        return this.message;
    }
  }

  /**
   * Convert to JSON for logging
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      field: this.field,
      timestamp: this.timestamp,
      requestId: this.requestId,
      details: this.details,
    };
  }
}

// ============================================================================
// Mock Client Configuration
// ============================================================================

export interface MockClientConfig {
  baseUrl: string;
  timeout?: number;
  enableLogging?: boolean;
  withCredentials?: boolean;
}

// ============================================================================
// Mock Session API Types
// ============================================================================

export interface MockSessionStatus {
  enabled: boolean;
  currentSession: {
    hasSession: boolean;
    accountIds: string[];
    currentAccountId: string | null;
    isValid: boolean;
  };
  cookies: {
    hasAccountSession: boolean;
    sessionToken: string;
  };
}

export interface MockSessionInfo {
  session: {
    hasSession: boolean;
    accountIds: string[];
    currentAccountId: string | null;
    isValid: boolean;
  };
  authCookies: Record<string, string>;
  cookieCount: number;
  userAgent: string;
  ip: string;
  timestamp: string;
}

export interface CreateSessionRequest {
  accountIds: string[];
  currentAccountId?: string;
}

export interface CreateSessionResponse {
  message: string;
  token: string;
  sessionData: {
    accountIds: string[];
    currentAccountId: string | null;
  };
}

export interface UpdateSessionRequest {
  action: 'add' | 'remove' | 'setCurrent';
  accountId?: string;
  currentAccountId?: string;
}

export interface UpdateSessionResponse {
  message: string;
  token: string;
  sessionData: {
    accountIds: string[];
    currentAccountId: string | null;
  };
  action: string;
}

export interface ValidateSessionRequest {
  token: string;
}

export interface ValidateSessionResponse {
  valid: boolean;
  sessionData: {
    accountIds: string[];
    currentAccountId: string | null;
  } | null;
  message: string;
}

export interface GenerateSessionsRequest {
  count?: number;
  accountsPerSession?: number;
}

export interface GenerateSessionsResponse {
  message: string;
  sessions: Array<{
    token: string;
    sessionData: {
      accountIds: string[];
      currentAccountId: string;
    };
  }>;
  count: number;
}

export interface CorruptSessionRequest {
  type?: 'malformed' | 'expired' | 'invalid_signature' | 'empty';
}

export interface CorruptSessionResponse {
  message: string;
  type: string;
  corruptedToken: string;
}

// ============================================================================
// Mock Token API Types
// ============================================================================

export interface MockTokenStatus {
  enabled: boolean;
  tokenCookies: Record<
    string,
    {
      type: string;
      accountId: string;
      isRefreshToken: boolean;
      iat: number;
      exp: number;
      isExpired: boolean;
    }
  >;
  tokenCount: number;
}

export interface CreateTokenRequest {
  accountId: string;
  accountType: AccountType;
  expiresIn?: number;
  oauthAccessToken?: string;
  oauthRefreshToken?: string;
  setCookie?: boolean;
}

export interface CreateTokenResponse {
  message: string;
  token: string;
  accountId: string;
  accountType: AccountType;
  setCookie: boolean;
  expiresIn?: number;
}

export interface CreateTokenPairRequest {
  accountId: string;
  accountType: AccountType;
  accessTokenExpiresIn?: number;
  oauthAccessToken?: string;
  oauthRefreshToken?: string;
  setCookies?: boolean;
}

export interface CreateTokenPairResponse {
  message: string;
  accessToken: string;
  refreshToken: string;
  accountId: string;
  accountType: AccountType;
  setCookies: boolean;
}

export interface ValidateTokenRequest {
  token: string;
}

export interface ValidateTokenResponse {
  valid: boolean;
  expired: boolean;
  tokenInfo?: {
    accountId: string;
    accountType: AccountType;
    isRefreshToken: boolean;
  };
  message: string;
  error?: string;
}

export interface CreateExpiredTokenRequest {
  accountId: string;
  accountType: AccountType;
  tokenType?: 'access' | 'refresh';
  pastSeconds?: number;
}

export interface CreateExpiredTokenResponse {
  message: string;
  token: string;
  accountId: string;
  accountType: AccountType;
  tokenType: string;
  expiredSeconds: number;
}

export interface CreateMalformedTokenRequest {
  type?: 'invalid_signature' | 'malformed_structure' | 'missing_parts' | 'empty_parts' | 'invalid_json';
}

export interface CreateMalformedTokenResponse {
  message: string;
  token: string;
  type: string;
}

export interface TokenInfo {
  accountId: string;
  accessToken:
    | {
        present: boolean;
        valid?: boolean;
        expired?: boolean;
        info?: any;
        error?: string;
      }
    | { present: false };
  refreshToken:
    | {
        present: boolean;
        valid?: boolean;
        expired?: boolean;
        info?: any;
        error?: string;
      }
    | { present: false };
}

export interface BatchCreateTokensRequest {
  accounts: Array<{
    accountId: string;
    accountType: AccountType;
    oauthAccessToken?: string;
    oauthRefreshToken?: string;
  }>;
  setCookies?: boolean;
}

export interface BatchCreateTokensResponse {
  message: string;
  results: Array<{
    accountId: string;
    accountType?: AccountType;
    success: boolean;
    accessToken?: string;
    refreshToken?: string;
    error?: string;
  }>;
  successful: number;
  failed: number;
}

export interface ClearTokensResponse {
  message: string;
  accountId: string;
  cleared: string[];
}
