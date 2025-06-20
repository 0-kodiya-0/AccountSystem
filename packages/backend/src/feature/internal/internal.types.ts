import { AccountType } from '../account/Account.types';
import { SessionAccount, AccountSessionInfo } from '../session/session.types';
import { Account } from '../account/Account.types';
import { TokenInfo } from '../tokens/Token.types';

// ============================================================================
// Token Verification Types
// ============================================================================

export interface TokenVerificationRequest {
  token: string;
  tokenType?: 'access' | 'refresh';
}

export interface TokenVerificationResponse {
  valid: boolean;
  accountId?: string;
  accountType?: AccountType;
  isRefreshToken?: boolean;
  expiresAt?: number;
  tokenInfo: TokenInfo;
  // OAuth specific fields
  oauthAccessToken?: string;
  oauthRefreshToken?: string;
  // Error info if invalid
  error?: string;
}

export interface TokenInfoRequest {
  token: string;
  tokenType?: 'access' | 'refresh';
}

export interface TokenInfoResponse {
  tokenInfo: TokenInfo;
  tokenType: string;
}

// ============================================================================
// User Information Types
// ============================================================================

export interface UserByIdResponse {
  user: Account;
  accountId: string;
}

export interface UserByEmailResponse {
  user: Account;
  email: string;
}

export interface UserExistsResponse {
  exists: boolean;
  accountId: string;
}

// ============================================================================
// Session Information Types
// ============================================================================

export interface SessionInfoRequest {
  sessionCookie?: string; // Optional, will read from cookies if not provided
}

export interface SessionInfoResponse {
  session: AccountSessionInfo;
}

export interface SessionAccountsRequest {
  accountIds?: string[]; // Optional, will read from session if not provided
}

export interface SessionAccountsResponse {
  accounts: SessionAccount[];
  count: number;
}

export interface SessionValidationRequest {
  accountId?: string; // Optional account ID to check if it's in session
}

export interface SessionValidationResponse {
  session: AccountSessionInfo;
  // Optional fields when accountId is provided
  accountId?: string;
  isAccountInSession?: boolean;
  isCurrentAccount?: boolean;
}

// ============================================================================
// Health Check Types
// ============================================================================

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  server: string;
  version?: string;
  services?: Record<string, string>;
  endpoints?: Record<string, string>;
}

// ============================================================================
// Internal Service Authentication Types
// ============================================================================

export interface InternalServiceHeaders {
  'X-Internal-Service-ID': string;
  'X-Internal-Service-Secret': string;
}

// ============================================================================
// Socket.IO Specific Types
// ============================================================================

export interface InternalSocketData {
  serviceId: string;
  serviceName: string;
  authenticated: boolean;
}

export interface InternalSocketResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// Socket event callback type - fixed to be more generic
export type SocketCallback<T = unknown> = (response: InternalSocketResponse<T>) => void;

// Socket event data types
export interface SocketEventData {
  [key: string]: unknown;
}

// Health check socket response
export interface SocketHealthResponse {
  status: 'healthy';
  timestamp: string;
  server: 'internal-socket';
  serviceId: string;
  serviceName: string;
  authenticated: boolean;
  services: {
    accounts: 'available';
    sessions: 'available';
    tokens: 'available';
  };
}

// Ping response
export interface SocketPingResponse {
  pong: true;
  timestamp: string;
  serviceId: string;
  serviceName: string;
}

// Service connection response
export interface SocketConnectionResponse {
  success: true;
  message: string;
  serviceId: string;
  serviceName: string;
  authenticated: boolean;
}

// Connected service info
export interface ConnectedServiceInfo {
  serviceId: string;
  serviceName: string;
  authenticated: boolean;
}

// Notification data - simplified to avoid timestamp conflicts
export interface NotificationData {
  [key: string]: unknown;
}

// ============================================================================
// Error Response Types
// ============================================================================

export interface InternalApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export interface InternalApiSuccess<T = unknown> {
  success: true;
  data: T;
}
