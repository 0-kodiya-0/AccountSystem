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

export interface AccountSessionInfo {
  hasSession: boolean;
  accountIds: string[];
  currentAccountId: string | null;
  isValid: boolean;
}

// ============================================================================
// Request Types
// ============================================================================

export interface AccountUpdateRequest {
  firstName?: string;
  lastName?: string;
  name?: string;
  imageUrl?: string;
  birthdate?: string;
  username?: string;
}

// Two-Step Signup Flow
export interface RequestEmailVerificationRequest {
  email: string;
  callbackUrl: string;
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

export interface CancelSignupRequest {
  email: string;
}

// Local Authentication
export interface LocalLoginRequest {
  email?: string;
  username?: string;
  password: string;
  rememberMe?: boolean;
}

export interface PasswordResetRequest {
  email: string;
  callbackUrl: string;
}

export interface PasswordResetVerificationRequest {
  token: string;
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

// OAuth Authentication
export interface OAuthUrlRequest {
  callbackUrl: string;
}

export interface PermissionUrlRequest {
  accountId: string;
  scopeNames: string[];
  callbackUrl: string;
}

export interface ReauthorizeUrlRequest {
  accountId: string;
  callbackUrl: string;
}

// Two-Factor Authentication
export interface TwoFactorSetupRequest {
  enableTwoFactor: boolean;
  password?: string;
}

export interface TwoFactorVerifyRequest {
  token: string;
  tempToken: string;
}

export interface BackupCodesRequest {
  password?: string;
}

// Token Management
export interface TokenValidationRequest {
  token: string;
  tokenType?: 'access' | 'refresh';
}

// ============================================================================
// Response Types (Data Only - No Wrapper)
// ============================================================================

// Account Responses
export interface SearchAccountResponse {
  accountId: string | null;
}

export interface GetAccountEmailResponse {
  email: string;
}

export interface LogoutResponse {
  message: string;
  accountId: string;
  clearClientAccountState: boolean;
}

// Session Responses
export interface GetAccountSessionResponse {
  session: AccountSessionInfo;
}

export type GetAccountSessionDataResponse = SessionAccount[];

export interface SessionUpdateResponse {
  message: string;
  currentAccountId?: string;
  accountId?: string;
}

// Local Auth Responses
export interface RequestEmailVerificationResponse {
  message: string;
  email: string;
  callbackUrl: string;
  mock?: {
    verificationToken: string;
    verifyUrl: string;
    note: string;
  };
}

export interface VerifyEmailSignupResponse {
  message: string;
  profileToken: string;
  email: string;
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

export interface CancelSignupResponse {
  message: string;
}

export interface LocalLoginResponse {
  accountId?: string;
  name?: string;
  requiresTwoFactor?: boolean;
  tempToken?: string;
  message?: string;
}

export interface PasswordResetRequestResponse {
  message: string;
  callbackUrl: string;
  mock?: {
    resetToken: string | null;
    resetUrl: string | null;
    note: string;
  };
}

export interface PasswordResetVerificationResponse {
  success: boolean;
  message: string;
  resetToken: string;
  expiresAt: string;
}

export interface ResetPasswordResponse {
  message: string;
}

export interface PasswordChangeResponse {
  message: string;
}

// OAuth Responses
export interface OAuthUrlResponse {
  authorizationUrl: string;
  state: string;
  provider: OAuthProviders;
  authType: 'signup' | 'signin';
  callbackUrl: string;
}

export interface PermissionUrlResponse {
  authorizationUrl: string;
  state: string;
  scopes: string[];
  accountId: string;
  userEmail: string;
  callbackUrl: string;
}

export interface ReauthorizeUrlResponse {
  message?: string;
  authorizationUrl: string | null;
  state?: string;
  scopes?: string[];
  accountId: string;
  userEmail?: string;
  callbackUrl: string;
}

// Two-Factor Authentication Responses
export interface TwoFactorStatusResponse {
  enabled: boolean;
  backupCodesCount: number;
  lastSetupDate?: string;
}

export interface TwoFactorSetupResponse {
  message: string;
  secret?: string;
  qrCodeUrl?: string;
  qrCode?: string;
  backupCodes?: string[];
  setupToken?: string;
  mock?: {
    setupToken: string;
    secret: string;
    nextStep: string;
    note: string;
  };
}

export interface TwoFactorVerifySetupResponse {
  message: string;
}

export interface TwoFactorVerifyResponse {
  accountId: string;
  name: string;
  message: string;
  needsAdditionalScopes?: boolean;
  missingScopes?: string[];
  mock?: {
    tempTokenData: {
      accountId: string;
      email: string;
      accountType: string;
      expiresAt: string;
    } | null;
    loginCompleted: boolean;
    note: string;
  };
}

export interface BackupCodesResponse {
  message: string;
  backupCodes: string[];
}

// Token Responses
export interface TokenInfo {
  isExpired: boolean;
  isValid: boolean;
  type?: 'local_jwt' | 'oauth_jwt' | 'local_refresh_jwt' | 'oauth_refresh_jwt';
  expiresAt?: number;
  timeRemaining?: number;
  accountId?: string;
  error?: string;
}

export interface TokenInfoResponse extends TokenInfo {}

export interface TokenValidationResponse extends TokenInfo {
  isOwner: boolean;
  belongsToAccount: boolean;
}

export interface TokenRevocationResponse {
  totalTokens: number;
  successfulRevocations: number;
  failedRevocations: number;
  errors?: string[];
  message: string;
}

// Logout Responses
export interface LogoutAllResponse {
  message?: string;
}

// ============================================================================
// Error Handling
// ============================================================================

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
  INVALID_REQUEST = 'INVALID_REQUEST',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',

  // User/Account Errors
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_EXISTS = 'USER_EXISTS',
  ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  EMAIL_ALREADY_VERIFIED = 'EMAIL_ALREADY_VERIFIED',
  MISSING_DATA = 'MISSING_DATA',
  MISSING_EMAIL = 'MISSING_EMAIL',

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
  INVALID_PROVIDER = 'INVALID_PROVIDER',
  INVALID_STATE = 'INVALID_STATE',

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

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  statusCode?: number;
  field?: string;
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

  static fromApiResponse(response: any, statusCode?: number): AuthSDKError {
    const code = response?.error?.code || response?.code || ApiErrorCode.UNKNOWN_ERROR;
    const message = response?.error?.message || response?.message || 'Unknown error occurred';

    return new AuthSDKError(message, code, statusCode, {
      field: response?.error?.field || response?.field,
      requestId: response?.requestId,
      details: response?.error?.details || response?.details,
    });
  }

  is(code: ApiErrorCode): boolean {
    return this.code === code;
  }

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

  isValidationError(): boolean {
    return [
      ApiErrorCode.VALIDATION_ERROR,
      ApiErrorCode.INVALID_EMAIL,
      ApiErrorCode.INVALID_PASSWORD,
      ApiErrorCode.PASSWORD_TOO_WEAK,
      ApiErrorCode.PASSWORDS_DONT_MATCH,
    ].includes(this.code);
  }

  isRetryable(): boolean {
    return [
      ApiErrorCode.NETWORK_ERROR,
      ApiErrorCode.TIMEOUT_ERROR,
      ApiErrorCode.CONNECTION_ERROR,
      ApiErrorCode.SERVER_ERROR,
      ApiErrorCode.SERVICE_UNAVAILABLE,
    ].includes(this.code);
  }

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
// Callback & State Management
// ============================================================================

export enum CallbackCode {
  OAUTH_SIGNIN_SUCCESS = 'oauth_signin_success',
  OAUTH_SIGNUP_SUCCESS = 'oauth_signup_success',
  OAUTH_PERMISSION_SUCCESS = 'oauth_permission_success',
  OAUTH_SIGNIN_REQUIRES_2FA = 'oauth_signin_requires_2fa',
  OAUTH_ERROR = 'oauth_error',
  OAUTH_PERMISSION_ERROR = 'oauth_permission_error',
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
  requiresTwoFactor?: boolean;
  tempToken?: string;
  [key: string]: any;
}

export type LoadingState = 'idle' | 'loading' | 'updating' | 'switching' | 'saving' | 'deleting' | 'error' | 'success';

// State Management Interfaces
export interface SessionState {
  data: AccountSessionInfo | null;
  status: LoadingState;
  currentOperation: string | null;
  error: string | null;
  lastLoaded: number | null;
}

export interface AccountState {
  data: Account | null;
  status: LoadingState;
  currentOperation: string | null;
  error: string | null;
  lastLoaded: number | null;
}

export interface SessionAccountsState {
  data: SessionAccount[];
  status: LoadingState;
  currentOperation: string | null;
  error: string | null;
  lastLoaded: number | null;
}

// ============================================================================
// SDK Configuration
// ============================================================================

export interface SDKConfig {
  backendUrl: string;
  backendProxyUrl?: string;
  frontendProxyUrl?: string;
  timeout?: number;
  withCredentials?: boolean;
  enableLogging?: boolean;
}

// ============================================================================
// Legacy Support Interface (For API Response structure)
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
