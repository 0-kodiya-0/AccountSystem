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

/**
 * Standard HTTP headers that can be included in requests
 */
export interface StandardHeaders {
  // Content headers
  'Content-Type'?: string;
  'Content-Length'?: string;
  'Content-Encoding'?: string;
  'Content-Language'?: string;

  // Authentication headers
  Authorization?: string;
  'WWW-Authenticate'?: string;
  'Proxy-Authorization'?: string;

  // Cache headers
  'Cache-Control'?: string;
  ETag?: string;
  'If-Match'?: string;
  'If-None-Match'?: string;
  'If-Modified-Since'?: string;
  'If-Unmodified-Since'?: string;
  'Last-Modified'?: string;
  Expires?: string;

  // Client information headers
  'User-Agent'?: string;
  Accept?: string;
  'Accept-Language'?: string;
  'Accept-Encoding'?: string;
  'Accept-Charset'?: string;

  // Request headers
  Host?: string;
  Origin?: string;
  Referer?: string;
  'X-Forwarded-For'?: string;
  'X-Real-IP'?: string;
  'X-Forwarded-Host'?: string;
  'X-Forwarded-Proto'?: string;

  // CORS headers
  'Access-Control-Request-Method'?: string;
  'Access-Control-Request-Headers'?: string;

  // Custom application headers
  'X-API-Key'?: string;
  'X-Client-Version'?: string;
  'X-Request-ID'?: string;
  'X-Correlation-ID'?: string;
  'X-Session-ID'?: string;
  'X-User-ID'?: string;
  'X-Tenant-ID'?: string;
  'X-Application-ID'?: string;

  // Security headers
  'X-Content-Type-Options'?: string;
  'X-Frame-Options'?: string;
  'X-XSS-Protection'?: string;
  'Strict-Transport-Security'?: string;
  'Content-Security-Policy'?: string;

  // Rate limiting headers
  'X-RateLimit-Limit'?: string;
  'X-RateLimit-Remaining'?: string;
  'X-RateLimit-Reset'?: string;
  'Retry-After'?: string;

  // Debugging headers
  'X-Debug'?: string;
  'X-Trace-ID'?: string;
  'X-Span-ID'?: string;

  // Custom business headers
  'X-Feature-Flags'?: string;
  'X-Environment'?: string;
  'X-Region'?: string;
  'X-Timezone'?: string;
}

/**
 * Internal service specific headers for backend-to-backend communication
 */
export interface InternalServiceHeaders {
  'X-Internal-Service-ID': string;
  'X-Internal-Service-Name'?: string;
  'X-Internal-Service-Secret'?: string;
  'X-Internal-Request-ID'?: string;
  'X-Service-Authorization'?: string;
}

export interface MockHttpClientConfig {
  baseUrl: string;
  timeout?: number;
  enableLogging?: boolean;
  withCredentials?: boolean;
  defaultHeaders?: Partial<StandardHeaders & Record<string, string>>;
}

export interface MockClientConfig extends MockHttpClientConfig {}

export interface MockInternalClientConfig extends MockHttpClientConfig {
  defaultHeaders: Partial<StandardHeaders & Record<string, string>> & InternalServiceHeaders;
}

// ============================================================================
// Mock Session API Types
// ============================================================================

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

export interface TokenInfoResponse {
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

export interface TokenInfoForAccountResponse {
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

export interface ClearTokensResponse {
  message: string;
  accountId: string;
  cleared: string[];
}

// ============================================================================
// TwoFA Mock API Types
// ============================================================================

export interface TwoFAGenerateCodeRequest {
  secret: string;
}

export interface TwoFAGenerateCodeResponse {
  token: string;
  secret: string;
  timeRemaining: number;
  timeUsed: number;
  message: string;
  note: string;
}

export interface TwoFAAccountSecretResponse {
  accountId: string;
  secret: string;
  twoFactorEnabled: boolean;
  message: string;
  note: string;
}

export interface TwoFAAccountGenerateCodeResponse {
  accountId: string;
  token: string;
  twoFactorEnabled: boolean;
  timeRemaining: number;
  timeUsed: number;
  message: string;
  note: string;
}

export interface TwoFAValidateTokenRequest {
  secret: string;
  token: string;
}

export interface TwoFAValidateTokenResponse {
  valid: boolean;
  token: string;
  secret: string;
  timeRemaining: number;
  timeUsed: number;
  message: string;
  note: string;
}

export interface TwoFACacheStatsResponse {
  temp: {
    size: number;
    max: number;
  };
  setup: {
    size: number;
    max: number;
  };
  message: string;
  note: string;
}

export interface TwoFATempTokensResponse {
  count: number;
  tokens: Array<{
    token: string;
    accountId: string;
    email: string;
    accountType: string;
    expiresAt: string;
    hasOAuthTokens: boolean;
  }>;
  message: string;
  note: string;
}

export interface TwoFASetupTokensResponse {
  count: number;
  tokens: Array<{
    token: string;
    accountId: string;
    secret: string;
    accountType: string;
    expiresAt: string;
    createdAt: string;
  }>;
  message: string;
  note: string;
}

export interface TwoFATempTokenDataResponse {
  token: string;
  accountId: string;
  email: string;
  accountType: string;
  expiresAt: string;
  oauthTokens?: any;
  message: string;
  note: string;
}

export interface TwoFASetupTokenDataResponse {
  token: string;
  accountId: string;
  secret: string;
  accountType: string;
  expiresAt: string;
  createdAt: string;
  message: string;
  note: string;
}

export interface TwoFAGenerateBackupCodesRequest {
  count?: number;
}

export interface TwoFAGenerateBackupCodesResponse {
  count: number;
  backupCodes: string[];
  message: string;
  note: string;
}

/**
 * Email template names enum
 * This enum defines all available email templates and their corresponding file names
 */
export enum EmailTemplate {
  EMAIL_VERIFICATION = 'email-verification',
  EMAIL_SIGNUP_VERIFICATION = 'email-signup-verification', // NEW
  PASSWORD_RESET = 'password-reset',
  PASSWORD_CHANGED = 'password-changed',
  LOGIN_NOTIFICATION = 'login-notification',
  TWO_FACTOR_ENABLED = 'two-factor-enabled',
  WELCOME = 'welcome',
  NEWSLETTER = 'newsletter',
  ACCOUNT_SUSPENDED = 'account-suspended',
  ACCOUNT_REACTIVATED = 'account-reactivated',
  PAYMENT_CONFIRMATION = 'payment-confirmation',
  SUBSCRIPTION_EXPIRED = 'subscription-expired',
  SECURITY_ALERT = 'security-alert',
}

export interface MockEmailMessage {
  id: string;
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  template?: EmailTemplate;
  variables?: Record<string, string>;
  timestamp: Date;
  status: 'sent' | 'failed' | 'pending';
  error?: string;

  // Enhanced metadata for testing
  metadata?: {
    // Test identification
    testId?: string;
    testName?: string;
    testSuite?: string;

    // User/Account context
    accountId?: string;
    userId?: string;
    accountType?: string;

    // Request context
    requestId?: string;
    sessionId?: string;
    userAgent?: string;
    ipAddress?: string;

    // Email flow context
    emailFlow?: string; // e.g., 'signup', 'password-reset', 'login-notification'
    flowStep?: string; // e.g., 'initial', 'reminder', 'final'
    triggerReason?: string; // e.g., 'user-action', 'scheduled', 'system-event'

    // Business context
    feature?: string; // e.g., 'authentication', 'notifications', 'billing'
    action?: string; // e.g., 'create-account', 'reset-password', 'enable-2fa'

    // Testing specific
    tags?: string[]; // e.g., ['integration', 'e2e', 'regression']
    testData?: Record<string, any>; // Custom test data

    // Any additional custom fields can be added directly at this level
    [key: string]: any;
  };
}

export interface EmailFilters {
  email?: string;
  template?: EmailTemplate;
  limit?: number;
  metadata?: {
    testId?: string;
    testName?: string;
    testSuite?: string;
    accountId?: string;
    userId?: string;
    emailFlow?: string;
    flowStep?: string;
    feature?: string;
    action?: string;
    tags?: string[];
    [key: string]: any;
  };
}

export interface GetSendEmailsResponse {
  emails: MockEmailMessage[];
  count: number;
  total: number;
  appliedFilters: EmailFilters;
}

export interface GetLatestEmailResponse {
  email: MockEmailMessage | null;
  found: boolean;
}

export interface ClearEmailResponse {
  message: string;
  cleared: boolean;
  clearedCount: number;
  filter: string | { [k: string]: any };
}

export interface ClearAllEmailsResponse {
  message: string;
  cleared: boolean;
  clearedCount: number;
}

export interface SendTestEmailResponse {
  message: string;
  to: string;
  template: EmailTemplate;
  metadata: MockEmailMessage['metadata'];
}

export interface GetEmailsByTemplateResponse {
  template: EmailTemplate;
  emails: MockEmailMessage[];
  count: number;
  appliedFilters: { limit?: number; metadata?: any };
}

export interface EmailSearchByMetadataResponse {
  emails: MockEmailMessage[];
  count: number;
  filter: Record<string, any>;
  limit: string | number;
}

export interface GetEmailAvailableTemplatesResponse {
  templates: { name: EmailTemplate; displayName: string; sentCount: number; failedCount: number }[];
  totalTemplates: number;
}

export interface GetEmailMetadataInsightsResponse {
  totalEmails: number;
  emailsWithMetadata: number;
  metadataUsageRate: string;
  uniqueValues: {
    testSuites: (string | undefined)[];
    emailFlows: (string | undefined)[];
    features: (string | undefined)[];
    actions: (string | undefined)[];
    allTags: string[];
  };
  recentTestSuites: (string | undefined)[];
  recentFlows: (string | undefined)[];
}

export interface OAuthCacheResponse {
  message: string;
}

export interface ProviderInfoResponse {
  provider: string;
  accountCount: number;
  accounts: Array<{
    id: string;
    email: string;
    name: string;
    status: string;
    twoFactorEnabled: boolean;
  }>;
  endpoints: Record<string, unknown>;
  supported: boolean;
}

// Health Check Types for Mock Backend Client
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  message?: string;
  details?: Record<string, any>;
  responseTime?: number;
  lastCheck: string;
  critical: boolean;
}

export interface SystemHealth {
  status: HealthStatus;
  version: string;
  timestamp: string;
  uptime: number;
  environment: string;
  components: Record<string, ComponentHealth>;
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    critical_unhealthy: number;
  };
}

export interface InternalSystemHealth extends SystemHealth {
  server_info: {
    type: string;
    version: string;
    features: {
      httpApi: boolean;
      socketApi: boolean;
      authentication: string;
      typescript: boolean;
    };
  };
}

export interface HealthPingResponse {
  status: 'ok' | 'error';
  timestamp: string;
  server?: string;
}

export interface UptimeResponse {
  uptime_ms: number;
  uptime_seconds: number;
  uptime_human: string;
  timestamp: string;
  server?: string;
}

export interface HealthCheckersResponse {
  checkers: string[];
  count: number;
  server?: string;
}

export interface HealthSummaryResponse {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  environment: string;
  components_summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    critical_unhealthy: number;
  };
}
