import { AccountType } from '../account/Account.types';
import { SessionAccount, AccountSessionInfo } from '../session/session.types';
import { Account } from '../account/Account.types';
import { TokenInfo } from '../tokens/Token.types';

// ============================================================================
// Socket.IO Event Interfaces (Best Practice Pattern)
// ============================================================================

/**
 * Events that the server can emit to clients
 */
export interface InternalServerToClientEvents {
  // Connection events
  connected: (data: {
    success: true;
    message: string;
    serviceId: string;
    serviceName: string;
    authenticated: boolean;
  }) => void;

  // Notification events (server -> client)
  'user-updated': (data: { accountId: string; user: Account; timestamp: string }) => void;
  'user-deleted': (data: { accountId: string; timestamp: string }) => void;
  'session-expired': (data: { accountId: string; sessionId: string; timestamp: string }) => void;
  'session-updated': (data: { accountId: string; session: AccountSessionInfo; timestamp: string }) => void;
  'service-notification': (data: { message: string; level: 'info' | 'warn' | 'error'; timestamp: string }) => void;
  'maintenance-mode': (data: { enabled: boolean; message?: string; timestamp: string }) => void;
}

/**
 * Events that clients can send to the server with responses
 */
export interface InternalClientToServerEvents {
  // Token verification events
  'auth:verify-token': (
    data: { token: string; tokenType?: 'access' | 'refresh' },
    callback: (response: {
      success: boolean;
      data?: {
        valid: boolean;
        accountId?: string;
        accountType?: AccountType;
        isRefreshToken?: boolean;
        expiresAt?: number;
        tokenInfo: TokenInfo;
        oauthAccessToken?: string;
        oauthRefreshToken?: string;
        error?: string;
      };
      error?: { code: string; message: string };
    }) => void,
  ) => void;

  'auth:token-info': (
    data: { token: string; tokenType?: 'access' | 'refresh' },
    callback: (response: {
      success: boolean;
      data?: { tokenInfo: TokenInfo; tokenType: string };
      error?: { code: string; message: string };
    }) => void,
  ) => void;

  // User information events
  'users:get-by-id': (
    data: { accountId: string },
    callback: (response: {
      success: boolean;
      data?: { user: Account; accountId: string };
      error?: { code: string; message: string };
    }) => void,
  ) => void;

  'users:get-by-email': (
    data: { email: string },
    callback: (response: {
      success: boolean;
      data?: { user: Account; email: string };
      error?: { code: string; message: string };
    }) => void,
  ) => void;

  'users:exists': (
    data: { accountId: string },
    callback: (response: {
      success: boolean;
      data?: { exists: boolean; accountId: string };
      error?: { code: string; message: string };
    }) => void,
  ) => void;

  // Session information events
  'session:get-info': (
    data: { sessionCookie?: string },
    callback: (response: {
      success: boolean;
      data?: { session: AccountSessionInfo };
      error?: { code: string; message: string };
    }) => void,
  ) => void;

  'session:get-accounts': (
    data: { accountIds?: string[]; sessionCookie?: string },
    callback: (response: {
      success: boolean;
      data?: { accounts: SessionAccount[]; count: number };
      error?: { code: string; message: string };
    }) => void,
  ) => void;

  'session:validate': (
    data: { accountId?: string; sessionCookie?: string },
    callback: (response: {
      success: boolean;
      data?: {
        session: AccountSessionInfo;
        accountId?: string;
        isAccountInSession?: boolean;
        isCurrentAccount?: boolean;
      };
      error?: { code: string; message: string };
    }) => void,
  ) => void;

  // Utility events
  health: (
    data: Record<string, never>,
    callback: (response: {
      success: boolean;
      data?: {
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
      };
      error?: { code: string; message: string };
    }) => void,
  ) => void;

  ping: (
    data: Record<string, never>,
    callback: (response: {
      success: boolean;
      data?: {
        pong: true;
        timestamp: string;
        serviceId: string;
        serviceName: string;
      };
      error?: { code: string; message: string };
    }) => void,
  ) => void;
}

/**
 * Inter-server events (for scaling across multiple servers)
 */
export interface InternalInterServerEvents {
  'server:ping': () => void;
  'server:pong': () => void;
  'user:updated': (data: { accountId: string; user: Account }) => void;
  'user:deleted': (data: { accountId: string }) => void;
  'session:expired': (data: { accountId: string; sessionId: string }) => void;
  'maintenance:toggle': (data: { enabled: boolean; message?: string }) => void;
}

/**
 * Socket data attached to each connection
 */
export interface InternalSocketData {
  serviceId: string;
  serviceName: string;
  authenticated: boolean;
  connectedAt: string;
  lastActivity: string;
}

// ============================================================================
// Type aliases for cleaner usage
// ============================================================================

export type InternalSocketResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
};

export type InternalEventCallback<T = unknown> = (response: InternalSocketResponse<T>) => void;

// Connected service info
export interface ConnectedServiceInfo {
  serviceId: string;
  serviceName: string;
  authenticated: boolean;
  connectedAt: string;
  lastActivity: string;
}

// ============================================================================
// Backward compatibility types (for existing code)
// ============================================================================

export interface SocketEventData {
  [key: string]: unknown;
}

export type SocketCallback<T = unknown> = (response: InternalSocketResponse<T>) => void;

export interface NotificationData {
  [key: string]: unknown;
}
