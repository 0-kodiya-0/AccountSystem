// Core Data Types
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

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// Local Auth Types
export interface LocalSignupRequest {
  firstName: string;
  lastName: string;
  email: string;
  username?: string;
  password: string;
  confirmPassword: string;
  birthdate?: string;
  agreeToTerms: boolean;
}

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
}

export interface TwoFactorVerifyRequest {
  token: string;
  tempToken: string;
}

export interface PasswordResetRequest {
  email: string;
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

export interface TwoFactorSetupRequest {
  password: string;
  enableTwoFactor: boolean;
}

export interface TwoFactorSetupResponse {
  qrCode?: string;
  secret?: string;
  backupCodes?: string[];
}

// Google Permission Types
export type ServiceType =
  | 'gmail'
  | 'calendar'
  | 'drive'
  | 'docs'
  | 'sheets'
  | 'people'
  | 'meet';
export type ScopeLevel =
  | 'readonly'
  | 'full'
  | 'send'
  | 'compose'
  | 'events'
  | 'file'
  | 'create'
  | 'edit';

export interface GoogleTokenInfo {
  accessToken: string;
  scope?: string;
  audience?: string;
  expiresIn?: number;
  issuedAt?: number;
  userId?: string;
  email?: string;
  emailVerified?: boolean;
}

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

// Notification Types
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  accountId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  link?: string;
  timestamp: number;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateNotificationRequest {
  title: string;
  message: string;
  type: NotificationType;
  link?: string;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
}

// SDK Configuration
export interface SDKConfig {
  backendUrl: string;
  timeout?: number;
  withCredentials?: boolean;
  proxyPath?: string;
}

// Error Types
export class AuthSDKError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public data?: Record<string, any>,
  ) {
    super(message);
    this.name = 'AuthSDKError';
  }
}

export enum ErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_FAILED = 'AUTH_FAILED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INSUFFICIENT_SCOPE = 'INSUFFICIENT_SCOPE',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  SERVER_ERROR = 'SERVER_ERROR',
}

// OAuth Types
export interface OAuthAuthUrls {
  google: string;
  microsoft: string;
  facebook: string;
}

export interface OAuthCallbackParams {
  state?: string;
  code?: string;
  error?: string;
  redirectUrl?: string;
}

// Socket connection states
export enum SocketConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

// Socket configuration
export interface SocketConfig {
  url: string;
  path?: string;
  reconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  timeout?: number;
  forceNew?: boolean;
  transports?: ('websocket' | 'polling')[];
}

// Socket events for notifications
export enum NotificationSocketEvents {
  // Client to server
  SUBSCRIBE = 'notification:subscribe',
  UNSUBSCRIBE = 'notification:unsubscribe',
  PING = 'ping',

  // Server to client
  NEW_NOTIFICATION = 'notification:new',
  UPDATED_NOTIFICATION = 'notification:updated',
  DELETED_NOTIFICATION = 'notification:deleted',
  ALL_READ = 'notification:all-read',
  SUBSCRIBED = 'notification:subscribed',
  UNSUBSCRIBED = 'notification:unsubscribed',
  PONG = 'pong',
  ERROR = 'error',
}

// Socket event payloads
export interface SocketEventPayloads {
  [NotificationSocketEvents.SUBSCRIBE]: { accountId: string };
  [NotificationSocketEvents.UNSUBSCRIBE]: { accountId: string };
  [NotificationSocketEvents.PING]: undefined;

  [NotificationSocketEvents.NEW_NOTIFICATION]: Notification;
  [NotificationSocketEvents.UPDATED_NOTIFICATION]: Notification;
  [NotificationSocketEvents.DELETED_NOTIFICATION]: string; // notification ID
  [NotificationSocketEvents.ALL_READ]: { accountId: string };
  [NotificationSocketEvents.SUBSCRIBED]: { accountId: string };
  [NotificationSocketEvents.UNSUBSCRIBED]: { accountId: string };
  [NotificationSocketEvents.PONG]: { timestamp: string };
  [NotificationSocketEvents.ERROR]: { message: string; code?: string };
}

// Connection info
export interface SocketConnectionInfo {
  state: SocketConnectionState;
  connectedAt?: Date;
  reconnectAttempts: number;
  lastError?: string;
  latency?: number;
}

// Socket event listener
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SocketEventListener<T = any> = (data: T) => void;

// Socket event emitter interface
export interface SocketEventEmitter {
  on<K extends keyof SocketEventPayloads>(
    event: K,
    listener: SocketEventListener<SocketEventPayloads[K]>,
  ): void;

  off<K extends keyof SocketEventPayloads>(
    event: K,
    listener?: SocketEventListener<SocketEventPayloads[K]>,
  ): void;

  emit<K extends keyof SocketEventPayloads>(
    event: K,
    data: SocketEventPayloads[K],
  ): void;
}

// Real-time notification update
export interface RealtimeNotificationUpdate {
  type: 'new' | 'updated' | 'deleted' | 'all_read';
  notification?: Notification;
  notificationId?: string;
  accountId: string;
  timestamp: number;
}

// Socket hook state
export interface SocketState {
  connection: SocketConnectionInfo;
  subscriptions: Set<string>; // account IDs
  isSupported: boolean;
}

// Socket manager interface
export interface SocketManager {
  connect(): Promise<void>;
  disconnect(): void;
  subscribe(accountId: string): Promise<void>;
  unsubscribe(accountId: string): Promise<void>;
  getConnectionState(): SocketConnectionState;
  getLatency(): number | null;
  isConnected(): boolean;
}

export interface UseAccountOptions {
  /**
   * Whether to automatically fetch account data if missing
   * @default true
   */
  autoFetch?: boolean;

  /**
   * Whether to refresh data on mount even if it exists
   * @default false
   */
  refreshOnMount?: boolean;

  /**
   * Interval to refresh account data (in milliseconds)
   * Set to 0 to disable auto-refresh
   * @default 0
   */
  refreshInterval?: number;
}

export interface UseAccountResult {
  account: Account | null;
  isLoading: boolean;
  error: string | null;
  hasData: boolean;
  needsData: boolean;

  // Actions
  refresh: () => Promise<Account | null>;
  clearError: () => void;
}

export enum CallbackCode {
  // OAuth success codes
  OAUTH_SIGNIN_SUCCESS = 'oauth_signin_success',
  OAUTH_SIGNUP_SUCCESS = 'oauth_signup_success',
  OAUTH_PERMISSION_SUCCESS = 'oauth_permission_success',

  // Local auth success codes
  LOCAL_SIGNIN_SUCCESS = 'local_signin_success',
  LOCAL_SIGNUP_SUCCESS = 'local_signup_success',
  LOCAL_2FA_REQUIRED = 'local_2fa_required',
  LOCAL_EMAIL_VERIFIED = 'local_email_verified',
  LOCAL_PASSWORD_RESET_SUCCESS = 'local_password_reset_success',

  // Logout success codes
  LOGOUT_SUCCESS = 'logout_success',
  LOGOUT_DISABLE_SUCCESS = 'logout_disable_success',
  LOGOUT_ALL_SUCCESS = 'logout_all_success',

  // Error codes
  OAUTH_ERROR = 'oauth_error',
  LOCAL_AUTH_ERROR = 'local_auth_error',
  PERMISSION_ERROR = 'permission_error',
  INVALID_STATE = 'invalid_state',
  USER_NOT_FOUND = 'user_not_found',
  USER_EXISTS = 'user_exists',
  TOKEN_EXPIRED = 'token_expired',

  // Special flow codes
  PERMISSION_REAUTHORIZE = 'permission_reauthorize',
  ACCOUNT_SELECTION_REQUIRED = 'account_selection_required',
}

export interface CallbackData {
  code: CallbackCode;
  accountId?: string;
  accountIds?: string[];
  name?: string;
  provider?: OAuthProviders;
  tempToken?: string;
  service?: string;
  scopeLevel?: string;
  error?: string;
  message?: string;
  clearClientAccountState?: boolean;
  // Additional context data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export enum RedirectCode {
  // Success redirects
  AUTHENTICATED_WITH_ACCOUNT = 'authenticated_with_account',

  // Account management redirects
  ACCOUNT_SELECTION_REQUIRED = 'account_selection_required',
  ACCOUNT_DATA_LOAD_FAILED = 'account_data_load_failed',
  HAS_ACCOUNTS_BUT_NONE_ACTIVE = 'has_accounts_but_none_active',

  // Auth failure redirects
  NO_AUTHENTICATION = 'no_authentication',

  // Loading states
  LOADING_AUTH_STATE = 'loading_auth_state',
  LOADING_ACCOUNT_DATA = 'loading_account_data',
}

/**
 * Minimal account data returned in session responses
 * Only contains essential information needed for session management
 */
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

export interface GetAccountSessionResponse {
  session: AccountSessionInfo;
  accounts?: SessionAccount[]; // Minimal account data for session management
}

export enum AuthGuardDecision {
  LOADING = 'loading',
  SHOW_CONTENT = 'show_content',
  REDIRECT_TO_LOGIN = 'redirect_to_login',
  REDIRECT_TO_ACCOUNTS = 'redirect_to_accounts',
  REDIRECT_CUSTOM = 'redirect_custom',
}

export enum EmailVerificationStatus {
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error',
  INVALID_TOKEN = 'invalid_token',
  EXPIRED_TOKEN = 'expired_token',
}

export enum PasswordResetStatus {
  IDLE = 'idle',
  REQUESTING = 'requesting',
  REQUEST_SUCCESS = 'request_success',
  RESETTING = 'resetting',
  RESET_SUCCESS = 'reset_success',
  ERROR = 'error',
}

export enum TwoFactorSetupStatus {
  IDLE = 'idle',
  REQUESTING_SETUP = 'requesting_setup',
  SETUP_READY = 'setup_ready',
  VERIFYING_TOKEN = 'verifying_token',
  GENERATING_BACKUP_CODES = 'generating_backup_codes',
  COMPLETE = 'complete',
  ERROR = 'error',
}

export enum TwoFactorVerificationStatus {
  IDLE = 'idle',
  VERIFYING = 'verifying',
  SUCCESS = 'success',
  ERROR = 'error',
  INVALID_TOKEN = 'invalid_token',
  EXPIRED_SESSION = 'expired_session',
  LOCKED_OUT = 'locked_out',
}

/**
 * Loading states for async operations
 * Prevents flash of content by using proper state transitions
 */
export enum LoadingState {
  PENDING = 'pending', // Initial state - still loading/initializing
  READY = 'ready', // Data loaded successfully - show content
  ERROR = 'error', // Failed to load - show error state
}

/**
 * Extended loading state with additional context
 */
export interface LoadingInfo {
  state: LoadingState;
  reason?: string; // Human-readable reason for the state
  lastUpdated?: number; // Timestamp of last state change
  metadata?: Record<string, unknown>; // Additional context data
}
