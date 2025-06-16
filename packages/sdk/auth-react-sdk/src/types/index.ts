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

export enum LoadingState {
  IDLE = 'idle',
  LOADING = 'loading',
  READY = 'ready',
  ERROR = 'error',
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
// Two-Step Signup Flow
// ============================================================================

export interface RequestEmailVerificationRequest {
  email: string;
}

export interface RequestEmailVerificationResponse {
  message: string;
  token: string;
  email: string;
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
// Local Authentication
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
// OAuth Authentication
// ============================================================================

export interface OAuthUrlResponse {
  authorizationUrl: string;
  state: string;
  provider: string;
  authType: string;
}

export interface PermissionUrlResponse {
  authorizationUrl: string;
  state: string;
  scopes: string[];
  accountId: string;
  userEmail: string;
}

export interface ReauthorizeUrlResponse {
  authorizationUrl: string | null;
  state?: string;
  scopes?: string[];
  accountId: string;
  userEmail?: string;
  message?: string;
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
// Standard Response Types
// ============================================================================

export interface PasswordResetRequestResponse {
  message: string;
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
// Notifications
// ============================================================================

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

// ============================================================================
// Socket/Real-time Types
// ============================================================================

export enum SocketConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

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

export interface SocketEventPayloads {
  [NotificationSocketEvents.SUBSCRIBE]: { accountId: string };
  [NotificationSocketEvents.UNSUBSCRIBE]: { accountId: string };
  [NotificationSocketEvents.PING]: undefined;
  [NotificationSocketEvents.NEW_NOTIFICATION]: Notification;
  [NotificationSocketEvents.UPDATED_NOTIFICATION]: Notification;
  [NotificationSocketEvents.DELETED_NOTIFICATION]: string;
  [NotificationSocketEvents.ALL_READ]: { accountId: string };
  [NotificationSocketEvents.SUBSCRIBED]: { accountId: string };
  [NotificationSocketEvents.UNSUBSCRIBED]: { accountId: string };
  [NotificationSocketEvents.PONG]: { timestamp: string };
  [NotificationSocketEvents.ERROR]: { message: string; code?: string };
}

export interface SocketConnectionInfo {
  state: SocketConnectionState;
  connectedAt?: Date;
  reconnectAttempts: number;
  lastError?: string;
  latency?: number;
}

export type SocketEventListener<T = any> = (data: T) => void;

export interface SocketManager {
  connect(): Promise<void>;
  disconnect(): void;
  subscribe(accountId: string): Promise<void>;
  unsubscribe(accountId: string): Promise<void>;
  getConnectionState(): SocketConnectionState;
  getLatency(): number | null;
  isConnected(): boolean;
}

export interface RealtimeNotificationUpdate {
  type: 'new' | 'updated' | 'deleted' | 'all_read';
  notification?: Notification;
  notificationId?: string;
  accountId: string;
  timestamp: number;
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

export enum ErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_FAILED = 'AUTH_FAILED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  INSUFFICIENT_SCOPE = 'INSUFFICIENT_SCOPE',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_EXISTS = 'USER_EXISTS',
  SERVER_ERROR = 'SERVER_ERROR',
  MISSING_DATA = 'MISSING_DATA',
}

export class AuthSDKError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public data?: Record<string, any>,
  ) {
    super(message);
    this.name = 'AuthSDKError';
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
