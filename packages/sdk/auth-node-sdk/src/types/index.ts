// ============================================================================
// Error Codes (matching your backend ApiErrorCode enum)
// ============================================================================

export enum ApiErrorCode {
  // Authentication & Authorization
  AUTH_FAILED = 'AUTH_FAILED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_REVOKED = 'TOKEN_REVOKED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INSUFFICIENT_SCOPE = 'INSUFFICIENT_SCOPE',

  // Validation Errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  INVALID_REQUEST = 'INVALID_REQUEST',
  MISSING_DATA = 'MISSING_DATA',
  INVALID_DETAILS = 'INVALID_DETAILS',

  // Resource Errors
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_EXISTS = 'USER_EXISTS',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_EXISTS = 'RESOURCE_EXISTS',
  RESOURCE_DELETED = 'RESOURCE_DELETED',

  // Server Errors
  SERVER_ERROR = 'SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  // Internal API Specific
  INTERNAL_ENDPOINT_NOT_FOUND = 'INTERNAL_ENDPOINT_NOT_FOUND',
  INVALID_STATE = 'INVALID_STATE',
  INVALID_PROVIDER = 'INVALID_PROVIDER',
  INVALID_SERVICE = 'INVALID_SERVICE',
  INVALID_SCOPE = 'INVALID_SCOPE',
}

// ============================================================================
// Type Definitions (matching backend types)
// ============================================================================

export enum AccountType {
  OAuth = 'oauth',
  Local = 'local',
}

export enum AccountStatus {
  Active = 'active',
  Inactive = 'inactive',
  Unverified = 'unverified',
  Suspended = 'suspended',
}

export enum OAuthProviders {
  Google = 'google',
  Microsoft = 'microsoft',
  Facebook = 'facebook',
}

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
  // Note: password and sensitive fields are not exposed in SDK
}

export interface Account {
  id: string;
  created: string;
  updated: string;
  accountType: AccountType;
  status: AccountStatus;
  userDetails: UserDetails;
  security: SecuritySettings;
  provider?: OAuthProviders; // Required when accountType === 'oauth'
}

export interface TokenInfo {
  type: 'local_jwt' | 'oauth_jwt' | 'local_refresh_jwt' | 'oauth_refresh_jwt';
  isExpired: boolean;
  isValid: boolean;
  expiresAt?: number;
  timeRemaining?: number;
  accountId?: string;
  error?: string;
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
// API Response Types
// ============================================================================

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
  timestamp?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

// ============================================================================
// Custom Error Class
// ============================================================================

export class InternalApiError extends Error {
  public readonly code: ApiErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: string;

  constructor(code: ApiErrorCode, message: string, statusCode: number = 500, details?: Record<string, unknown>) {
    super(message);
    this.name = 'InternalApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InternalApiError);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      ...(this.details && { details: this.details }),
    };
  }
}

// ============================================================================
// Specific Response Types
// ============================================================================

export interface TokenVerificationResponse {
  valid: boolean;
  accountId?: string;
  accountType?: AccountType;
  isRefreshToken?: boolean;
  expiresAt?: number;
  oauthAccessToken?: string;
  oauthRefreshToken?: string;
  error?: string;
}

export interface TokenInfoResponse {
  tokenInfo: TokenInfo;
  tokenType: string;
}

export interface UserResponse {
  user: Account;
  accountId: string;
}

export interface UserEmailResponse {
  user: Account;
  email: string;
}

export interface UserExistsResponse {
  exists: boolean;
  accountId: string;
}

export interface SessionInfoResponse {
  session: AccountSessionInfo;
}

export interface SessionAccountsResponse {
  accounts: SessionAccount[];
  count: number;
}

export interface SessionValidationResponse {
  session: AccountSessionInfo;
  accountId?: string;
  isAccountInSession?: boolean;
  isCurrentAccount?: boolean;
}

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  server: string;
  version?: string;
  features?: Record<string, boolean | string>;
  endpoints?: Record<string, string>;
  services?: Record<string, string>;
  socket?: {
    namespace: string;
    connectedServices: number;
    services: Array<{
      serviceId: string;
      serviceName: string;
      authenticated: boolean;
      connectedAt: string;
      lastActivity: string;
    }>;
  };
}

// ============================================================================
// Configuration Interfaces
// ============================================================================

export interface InternalHttpClientConfig {
  baseUrl: string;
  serviceId: string;
  serviceSecret: string;
  timeout?: number;
  retries?: number;
  enableLogging?: boolean;
}

export interface InternalSocketClientConfig {
  baseUrl: string;
  serviceId: string;
  serviceName: string;
  serviceSecret: string;
  namespace?: string;
  timeout?: number;
  enableLogging?: boolean;
  autoConnect?: boolean;
  maxReconnectAttempts?: number;
}

export interface SocketResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export type SocketCallback<T = unknown> = (response: SocketResponse<T>) => void;

// ============================================================================
// Socket Event Interfaces (matching backend)
// ============================================================================

export interface ServerToClientEvents {
  connected: (data: {
    success: true;
    message: string;
    serviceId: string;
    serviceName: string;
    authenticated: boolean;
  }) => void;

  'user-updated': (data: { accountId: string; user: Account; timestamp: string }) => void;
  'user-deleted': (data: { accountId: string; timestamp: string }) => void;
  'session-expired': (data: { accountId: string; sessionId: string; timestamp: string }) => void;
  'service-notification': (data: { message: string; level: 'info' | 'warn' | 'error'; timestamp: string }) => void;
  'maintenance-mode': (data: { enabled: boolean; message?: string; timestamp: string }) => void;

  connect: () => void;
  disconnect: (reason: string, details?: any) => void;
  connect_error: (error: Error) => void;
  reconnect: (attemptNumber: number) => void;
  reconnect_attempt: (attemptNumber: number) => void;
  reconnect_error: (error: Error) => void;
  reconnect_failed: () => void;
  ping: () => void;
  pong: () => void;
}

export interface ClientToServerEvents {
  'auth:verify-token': (
    data: { token: string; tokenType?: 'access' | 'refresh' },
    callback: SocketCallback<TokenVerificationResponse>,
  ) => void;

  'auth:token-info': (
    data: { token: string; tokenType?: 'access' | 'refresh' },
    callback: SocketCallback<TokenInfoResponse>,
  ) => void;

  'users:get-by-id': (data: { accountId: string }, callback: SocketCallback<UserResponse>) => void;

  'users:get-by-email': (data: { email: string }, callback: SocketCallback<UserEmailResponse>) => void;

  'users:exists': (data: { accountId: string }, callback: SocketCallback<UserExistsResponse>) => void;

  'session:get-info': (data: { sessionCookie?: string }, callback: SocketCallback<SessionInfoResponse>) => void;

  'session:get-accounts': (
    data: { accountIds?: string[]; sessionCookie?: string },
    callback: SocketCallback<SessionAccountsResponse>,
  ) => void;

  'session:validate': (
    data: { accountId?: string; sessionCookie?: string },
    callback: SocketCallback<SessionValidationResponse>,
  ) => void;

  health: (
    data: Record<string, never>,
    callback: SocketCallback<{
      status: 'healthy';
      timestamp: string;
      server: 'internal-socket';
      serviceId: string;
      serviceName: string;
      authenticated: boolean;
    }>,
  ) => void;

  ping: (
    data: Record<string, never>,
    callback: SocketCallback<{
      pong: true;
      timestamp: string;
      serviceId: string;
      serviceName: string;
    }>,
  ) => void;
}
