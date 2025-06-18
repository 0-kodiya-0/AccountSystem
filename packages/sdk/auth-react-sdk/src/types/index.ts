// ============================================================================
// Core Enums
// ============================================================================

export enum AccountStatus {
  Active = 'active',
  Inactive = 'inactive',
  Unverified = 'unverified',
  Suspended = 'suspended',
}

export enum AccountType {
  Local = 'local',
  OAuth = 'oauth',
}

export enum OAuthProviders {
  Google = 'google',
  Microsoft = 'microsoft',
  Facebook = 'facebook',
}

// ============================================================================
// Core Data Models
// ============================================================================

export interface UserDetails {
  firstName?: string;
  lastName?: string;
  name: string;
  email?: string;
  imageUrl?: string;
  birthdate?: string;
  username?: string;
  emailVerified?: boolean;
}

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  sessionTimeout: number;
  autoLock: boolean;
}

export interface Account {
  id: string;
  created: string;
  updated: string;
  accountType: AccountType;
  status: AccountStatus;
  userDetails: UserDetails;
  security: SecuritySettings;
  provider?: OAuthProviders;
}

export interface SessionAccount {
  id: string;
  accountType: AccountType;
  status: AccountStatus;
  userDetails: {
    name: string;
    email?: string;
    username?: string;
    imageUrl?: string;
  };
  provider?: OAuthProviders;
}

// ============================================================================
// Account Update Types (UPDATED - Direct Fields)
// ============================================================================

export interface AccountUpdateRequest {
  firstName?: string;
  lastName?: string;
  name?: string;
  imageUrl?: string;
  birthdate?: string;
  username?: string;
}

// ============================================================================
// Session Management
// ============================================================================

export interface AccountSessionInfo {
  hasSession: boolean;
  accountIds: string[];
  currentAccountId: string | null;
  isValid: boolean;
}

export interface GetAccountSessionResponse {
  session: AccountSessionInfo;
}

export type GetAccountSessionDataResponse = SessionAccount[];

export interface SessionUpdateResponse {
  message: string;
  currentAccountId?: string | null;
  accountId?: string;
}

// ============================================================================
// Two-Step Signup Flow (UPDATED - Callback URLs)
// ============================================================================

export interface RequestEmailVerificationRequest {
  email: string;
  callbackUrl: string; // NEW: Required callback URL
}

export interface RequestEmailVerificationResponse {
  message: string;
  email: string;
  callbackUrl: string; // NEW: Returned for reference
}

export interface VerifyEmailSignupResponse {
  message: string;
  profileToken: string;
  email: string;
}

export interface CompleteProfileRequest {
  firstName: string;
  lastName: string;
  username?: string;
  password: string;
  confirmPassword: string;
  birthdate?: string;
  agreeToTerms: boolean;
}

export interface CompleteProfileResponse {
  message: string;
  accountId: string;
  name: string;
}

export interface SignupStatusResponse {
  step: 'email_verification' | 'profile_completion' | 'not_found';
  email?: string;
  token?: string;
  emailVerified?: boolean;
  expiresAt?: string;
  message?: string;
}

export interface CancelSignupRequest {
  email: string;
}

export interface CancelSignupResponse {
  message: string;
}

// ============================================================================
// Local Authentication (UPDATED - Callback URLs)
// ============================================================================

export interface LocalLoginRequest {
  email?: string;
  username?: string;
  password: string;
  rememberMe?: boolean;
}

export interface LocalLoginResponse {
  accountId?: string;
  name?: string;
  requiresTwoFactor?: boolean;
  tempToken?: string;
  message?: string;
}

export interface PasswordResetRequest {
  email: string;
  callbackUrl: string; // NEW: Required callback URL
}

export interface ResetPasswordRequest {
  password: string;
  confirmPassword: string;
}

export interface PasswordChangeRequest {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// ============================================================================
// OAuth Authentication (UPDATED - Callback URLs)
// ============================================================================

export interface OAuthUrlRequest {
  callbackUrl: string; // NEW: Required callback URL
}

export interface OAuthUrlResponse {
  authorizationUrl: string;
  state: string;
  provider: string;
  authType: string;
  callbackUrl: string; // NEW: Returned for reference
}

export interface PermissionUrlRequest {
  accountId: string;
  scopeNames: string[];
  callbackUrl: string; // NEW: Required callback URL
}

export interface PermissionUrlResponse {
  authorizationUrl: string;
  state: string;
  scopes: string[];
  accountId: string;
  userEmail: string;
  callbackUrl: string; // NEW: Returned for reference
}

export interface ReauthorizeUrlRequest {
  accountId: string;
  callbackUrl: string; // NEW: Required callback URL
}

export interface ReauthorizeUrlResponse {
  authorizationUrl: string | null;
  state?: string;
  scopes?: string[];
  accountId: string;
  userEmail?: string;
  message?: string;
  callbackUrl?: string; // NEW: Returned for reference
}

// ============================================================================
// UNIFIED Two-Factor Authentication (NEW)
// ============================================================================

export interface TwoFactorStatusResponse {
  enabled: boolean;
  backupCodesCount?: number;
  lastSetupDate?: string;
}

export interface UnifiedTwoFactorSetupRequest {
  enableTwoFactor: boolean;
  password?: string; // Required for local accounts, not needed for OAuth
}

export interface UnifiedTwoFactorSetupResponse {
  message: string;
  secret?: string;
  qrCode?: string;
  qrCodeUrl?: string;
  backupCodes?: string[];
}

export interface UnifiedTwoFactorVerifyRequest {
  token: string;
  tempToken: string;
}

export interface UnifiedTwoFactorVerifyResponse {
  accountId: string;
  name: string;
  message: string;
  // OAuth specific fields (optional)
  needsAdditionalScopes?: boolean;
  missingScopes?: string[];
}

export interface BackupCodesRequest {
  password?: string; // Required for local accounts, not needed for OAuth
}

export interface BackupCodesResponse {
  message: string;
  backupCodes: string[];
}

// ============================================================================
// UNIFIED Token Management (NEW)
// ============================================================================

export interface TokenInfo {
  isExpired: boolean;
  isValid: boolean;
  type: 'local_jwt' | 'oauth_jwt' | 'local_refresh_jwt' | 'oauth_refresh_jwt';
  expiresAt?: number;
  timeRemaining?: number;
  accountId?: string;
  error?: string;
  // OAuth specific
  oauthAccessToken?: string;
  oauthRefreshToken?: string;
}

export interface TokenStatusResponse {
  accountId: string;
  accountType: AccountType;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  accessToken?: TokenInfo;
  refreshToken?: TokenInfo;
}

export interface TokenInfoResponse extends TokenInfo {}

export interface TokenRefreshResponse {
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
}

export interface TokenRevocationResponse {
  accessTokenRevoked: boolean;
  refreshTokenRevoked: boolean;
  message?: string;
}

export interface TokenValidationRequest {
  token: string;
  tokenType?: 'access' | 'refresh';
}

export interface TokenValidationResponse extends TokenInfo {
  isOwner: boolean;
  belongsToAccount: boolean;
}

// ============================================================================
// Standard Response Types (UPDATED)
// ============================================================================

export interface PasswordResetRequestResponse {
  message: string;
  callbackUrl: string; // NEW: Returned for reference
}

export interface ResetPasswordResponse {
  message: string;
}

export interface PasswordChangeResponse {
  message: string;
}

export interface BackupCodesResponse {
  message: string;
  backupCodes: string[];
}

export interface EmailVerificationResponse {
  message: string;
  profileToken?: string;
  email?: string;
}

export interface LogoutResponse {
  message: string;
  accountId: string;
  clearClientAccountState: boolean;
}

export interface LogoutAllResponse {
  message?: string;
}

// ============================================================================
// SDK Configuration & Error Handling
// ============================================================================

export interface SDKConfig {
  backendUrl: string;
  timeout?: number;
  withCredentials?: boolean;
  proxyPath?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
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
// Google Specific Types (for scope checking)
// ============================================================================

export type ServiceType = 'gmail' | 'calendar' | 'drive' | 'docs' | 'sheets' | 'people' | 'meet';
export type ScopeLevel = 'readonly' | 'full' | 'send' | 'compose' | 'events' | 'file' | 'create' | 'edit';

export interface ScopeCheckResult {
  hasAccess: boolean;
  scopeName: string;
  scopeUrl: string;
}

export interface TokenCheckResponse {
  summary: {
    totalRequested: number;
    totalGranted: number;
    allGranted: boolean;
  };
  requestedScopeNames: string[];
  requestedScopeUrls: string[];
  results: Record<string, ScopeCheckResult>;
}

export interface GoogleScopeResult {
  hasAccess: boolean;
  scopeName: string;
  scopeUrl: string;
}

export interface GoogleScopeCheckResult {
  summary: {
    totalRequested: number;
    totalGranted: number;
    allGranted: boolean;
  };
  requestedScopeNames: string[];
  requestedScopeUrls: string[];
  results: Record<string, GoogleScopeResult>;
}

export interface GoogleTokenState {
  data: TokenStatusResponse | null;
  loading: boolean;
  error: AuthSDKError | null;
  lastLoaded: number | null;
}

export interface GoogleScopeState {
  data: GoogleScopeCheckResult | null;
  loading: boolean;
  error: AuthSDKError | null;
  lastChecked: number | null;
}

export enum CallbackCode {
  // OAuth success codes
  OAUTH_SIGNIN_SUCCESS = 'oauth_signin_success',
  OAUTH_SIGNUP_SUCCESS = 'oauth_signup_success',
  OAUTH_PERMISSION_SUCCESS = 'oauth_permission_success',

  // Two-factor authentication required codes
  OAUTH_SIGNIN_REQUIRES_2FA = 'oauth_signin_requires_2fa',

  // Error codes
  OAUTH_ERROR = 'oauth_error',
  PERMISSION_ERROR = 'permission_error',
}

export interface CallbackData {
  code?: CallbackCode;
  accountId?: string;
  name?: string;
  provider?: OAuthProviders;
  service?: string;
  scopeLevel?: string;
  error?: string;
  message?: string;
  needsAdditionalScopes?: boolean;
  missingScopes?: string[];
  // Two-factor authentication fields
  requiresTwoFactor?: boolean;
  tempToken?: string;
  // Additional context data
  [key: string]: any;
}

export type LoadingState = 'idle' | 'loading' | 'updating' | 'saving' | 'deleting' | 'error' | 'success';

// Session state structure
export interface SessionState {
  data: AccountSessionInfo | null;
  status: LoadingState;
  currentOperation: string | null;
  error: string | null;
  lastLoaded: number | null;
}

// Account state structure
export interface AccountState {
  data: Account | null;
  status: LoadingState;
  currentOperation: string | null;
  error: string | null;
  lastLoaded: number | null;
}
