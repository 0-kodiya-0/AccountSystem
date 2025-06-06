# API Reference

This document provides detailed API documentation for the `@accountsystem/auth-react-sdk`.

## Table of Contents

1. [Context Providers](#context-providers)
2. [Core Hooks](#core-hooks)
3. [Authentication Hooks](#authentication-hooks)
4. [Account Management Hooks](#account-management-hooks)
5. [Notification Hooks](#notification-hooks)
6. [Permission Hooks](#permission-hooks)
7. [Utility Hooks](#utility-hooks)
8. [Client Classes](#client-classes)
9. [Type Definitions](#type-definitions)
10. [Error Handling](#error-handling)

## Context Providers

### AuthProvider

Main authentication context provider that manages authentication state and provides methods for auth operations.

```tsx
interface AuthProviderProps {
  children: ReactNode;
  client: HttpClient;
  autoRefreshAccount?: boolean;
}

<AuthProvider client={client} autoRefreshAccount={true}>
  {children}
</AuthProvider>
```

**Props:**

- `client` (HttpClient): HTTP client instance for API communication
- `autoRefreshAccount` (boolean, optional): Whether to auto-refresh current account on mount (default: true)

### NotificationsProvider

Provides real-time notification functionality with Socket.IO integration.

```tsx
interface NotificationsProviderProps {
  children: ReactNode;
  socketConfig: SocketConfig;
  accountId?: string;
  autoSubscribe?: boolean;
  enableSound?: boolean;
  enableBrowserNotifications?: boolean;
  maxRetainedUpdates?: number;
  fetchOnMount?: boolean;
  pollingInterval?: number;
}

<NotificationsProvider
  socketConfig={socketConfig}
  autoSubscribe={true}
  enableSound={true}
  enableBrowserNotifications={true}
  maxRetainedUpdates={50}
  fetchOnMount={true}
>
  {children}
</NotificationsProvider>
```

**Props:**

- `socketConfig` (SocketConfig): Socket.IO configuration
- `accountId` (string, optional): Specific account ID to subscribe to
- `autoSubscribe` (boolean, optional): Auto-subscribe on mount (default: true)
- `enableSound` (boolean, optional): Enable notification sounds (default: true)
- `enableBrowserNotifications` (boolean, optional): Enable browser notifications (default: true)
- `maxRetainedUpdates` (number, optional): Max real-time updates to keep in memory (default: 50)
- `fetchOnMount` (boolean, optional): Fetch notifications on mount (default: true)
- `pollingInterval` (number, optional): Fallback polling interval when Socket.IO is not available

## Core Hooks

### useAuth()

Main authentication hook providing access to all auth methods and state.

```tsx
const {
  // Client instance
  client,

  // State
  accounts,
  currentAccount,
  isLoading,
  isAuthenticating,
  error,
  isAuthenticated,
  oauthState,

  // Local Authentication
  localSignup,
  localLogin,
  verifyTwoFactor,
  requestPasswordReset,
  resetPassword,

  // OAuth Authentication
  startOAuthSignup,
  startOAuthSignin,
  handleOAuthCallback,

  // Account Management
  fetchAccount,
  updateAccount,
  changePassword,
  setupTwoFactor,
  switchAccount,
  logout,
  logoutAll,

  // Google Permissions
  requestGooglePermission,
  checkGoogleScopes,

  // Utilities
  clearError,
  refreshCurrentAccount
} = useAuth();
```

**Returns:**

- `client` (HttpClient): HTTP client instance
- `accounts` (Account[]): Array of all authenticated accounts
- `currentAccount` (Account | null): Currently active account
- `isLoading` (boolean): General loading state
- `isAuthenticating` (boolean): Authentication in progress
- `error` (string | null): Current error message
- `isAuthenticated` (boolean): Whether user is authenticated
- `oauthState` (OAuthState): OAuth flow state

**Methods:**

- `localSignup(data: LocalSignupRequest): Promise<{accountId: string}>`: Register new local account
- `localLogin(data: LocalLoginRequest): Promise<LocalLoginResponse>`: Login with email/password
- `verifyTwoFactor(data: TwoFactorVerifyRequest): Promise<LocalLoginResponse>`: Verify 2FA code
- `requestPasswordReset(email: string): Promise<void>`: Request password reset
- `resetPassword(token: string, data: ResetPasswordRequest): Promise<void>`: Reset password with token
- `startOAuthSignup(provider: OAuthProviders, redirectUrl?: string): void`: Start OAuth signup
- `startOAuthSignin(provider: OAuthProviders, redirectUrl?: string): void`: Start OAuth signin
- `handleOAuthCallback(params: URLSearchParams): Promise<void>`: Handle OAuth callback
- `fetchAccount(accountId: string): Promise<Account>`: Fetch account details
- `updateAccount(accountId: string, updates: Partial<Account>): Promise<Account>`: Update account
- `changePassword(accountId: string, data: PasswordChangeRequest): Promise<void>`: Change password
- `setupTwoFactor(accountId: string, data: TwoFactorSetupRequest): Promise<TwoFactorSetupResponse>`: Setup 2FA
- `switchAccount(accountId: string): void`: Switch to different account
- `logout(accountId?: string): Promise<void>`: Logout single account
- `logoutAll(): Promise<void>`: Logout all accounts
- `requestGooglePermission(accountId: string, scopes: string[], redirectUrl?: string): void`: Request Google permissions
- `checkGoogleScopes(accountId: string, scopes: string[]): Promise<TokenCheckResponse>`: Check Google scopes
- `clearError(): void`: Clear current error
- `refreshCurrentAccount(): Promise<void>`: Refresh current account data

## Authentication Hooks

### useLocalAuth()

Hook for local authentication flows (email/password).

```tsx
const {
  // State
  isAuthenticating,
  error,
  formErrors,
  requires2FA,
  
  // Actions
  signup,
  login,
  verify2FA,
  requestPasswordReset,
  resetPassword,
  
  // Utilities
  clearFormErrors,
  getFieldError
} = useLocalAuth();
```

**Returns:**

- `isAuthenticating` (boolean): Authentication in progress
- `error` (string | null): General error message
- `formErrors` (Record<string, string>): Field-specific validation errors
- `requires2FA` (boolean): Whether 2FA verification is required

**Methods:**

- `signup(data: LocalSignupRequest): Promise<{accountId: string}>`: Register new account
- `login(data: LocalLoginRequest): Promise<LocalLoginResponse>`: Login with credentials
- `verify2FA(code: string): Promise<LocalLoginResponse>`: Verify 2FA code
- `requestPasswordReset(email: string): Promise<void>`: Request password reset
- `resetPassword(token: string, password: string, confirmPassword: string): Promise<void>`: Reset password
- `clearFormErrors(): void`: Clear form validation errors
- `getFieldError(field: string): string | null`: Get error for specific field

### useOAuth()

Hook for OAuth authentication flows.

```tsx
const {
  // State
  isInProgress,
  provider,
  isAuthenticating,
  error,

  // Actions
  signupWithProvider,
  signinWithProvider,

  // Utilities
  isOAuthCallback
} = useOAuth();
```

**Returns:**

- `isInProgress` (boolean): OAuth flow in progress
- `provider` (OAuthProviders | null): Current OAuth provider
- `isAuthenticating` (boolean): Authentication in progress
- `error` (string | null): Current error message

**Methods:**

- `signupWithProvider(provider: OAuthProviders, redirectUrl?: string): void`: Start OAuth signup
- `signinWithProvider(provider: OAuthProviders, redirectUrl?: string): void`: Start OAuth signin
- `isOAuthCallback(): boolean`: Check if current URL is OAuth callback

## Account Management Hooks

### useAccount(accountId?)

Hook for managing a specific account.

```tsx
const {
  account,
  loading,
  error,
  refetch,
  updateAccount,
  clearError
} = useAccount(accountId);
```

**Parameters:**

- `accountId` (string, optional): Specific account ID (defaults to current account)

**Returns:**

- `account` (Account | null): Account data
- `loading` (boolean): Loading state
- `error` (string | null): Error message
- `refetch(): Promise<void>`: Refresh account data
- `updateAccount(updates: Partial<Account>): Promise<Account>`: Update account
- `clearError(): void`: Clear error

### useAccountSwitcher()

Hook for managing multiple accounts and switching between them.

```tsx
const {
  accounts,
  currentAccount,
  switching,
  switchTo,
  logoutAccount,
  logoutAllAccounts,
  hasMultipleAccounts
} = useAccountSwitcher();
```

**Returns:**

- `accounts` (Account[]): All authenticated accounts
- `currentAccount` (Account | null): Currently active account
- `switching` (boolean): Account switch in progress
- `hasMultipleAccounts` (boolean): Whether user has multiple accounts

**Methods:**

- `switchTo(accountId: string): Promise<void>`: Switch to account
- `logoutAccount(accountId?: string): Promise<void>`: Logout specific account
- `logoutAllAccounts(): Promise<void>`: Logout all accounts

## Notification Hooks

### useNotifications(accountId?)

Core hook for notification management.

```tsx
const {
  notifications,
  unreadCount,
  loading,
  error,
  refetch,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  updateNotification,
  createNotification,
  clearError
} = useNotifications(accountId);
```

**Parameters:**

- `accountId` (string, optional): Account ID (defaults to current account)

**Returns:**

- `notifications` (Notification[]): Array of notifications
- `unreadCount` (number): Number of unread notifications
- `loading` (boolean): Loading state
- `error` (string | null): Error message

**Methods:**

- `refetch(): Promise<void>`: Refresh notifications
- `markAsRead(notificationId: string): Promise<void>`: Mark notification as read
- `markAllAsRead(): Promise<void>`: Mark all notifications as read
- `deleteNotification(notificationId: string): Promise<void>`: Delete notification
- `deleteAllNotifications(): Promise<void>`: Delete all notifications
- `updateNotification(notificationId: string, updates: Partial<Notification>): Promise<Notification>`: Update notification
- `createNotification(notification: CreateNotificationRequest): Promise<Notification>`: Create notification
- `clearError(): void`: Clear error

### useNotificationsBadge()

Hook for notification badge display.

```tsx
const {
  unreadCount,
  hasUnread,
  badgeText,
  showBadge
} = useNotificationsBadge();
```

**Returns:**

- `unreadCount` (number): Number of unread notifications
- `hasUnread` (boolean): Whether there are unread notifications
- `badgeText` (string): Formatted badge text (e.g., "99+" for counts over 99)
- `showBadge` (boolean): Whether to show the badge

### useNotificationsFeed(options?)

Hook for filtered notification lists.

```tsx
const {
  notifications,
  loading,
  error,
  markAsRead,
  deleteNotification,
  isEmpty,
  hasMore
} = useNotificationsFeed({
  type: 'info',
  limit: 20,
  unreadOnly: false
});
```

**Parameters:**

- `options.type` (NotificationType, optional): Filter by notification type
- `options.limit` (number, optional): Maximum number of notifications (default: 20)
- `options.unreadOnly` (boolean, optional): Show only unread notifications (default: false)

**Returns:**

- `notifications` (Notification[]): Filtered notifications
- `loading` (boolean): Loading state
- `error` (string | null): Error message
- `isEmpty` (boolean): Whether the list is empty
- `hasMore` (boolean): Whether there are more notifications available

### useRealtimeNotifications(options)

Hook for real-time notification updates.

```tsx
const {
  // Socket connection info
  isConnected,
  connectionState,

  // Real-time updates
  recentUpdates,
  lastUpdate,

  // Notification permissions
  browserNotificationsEnabled,
  requestBrowserPermission,

  // Controls
  subscribe,
  unsubscribe,
  clearUpdates,

  // Sound controls
  soundEnabled,
  setSoundEnabled,

  // Statistics
  updateCount,
  subscriptions
} = useRealtimeNotifications({
  socketConfig,
  accountId,
  autoSubscribe: true,
  enableSound: true,
  enableBrowserNotifications: true,
  maxRetainedUpdates: 50
});
```

**Parameters:**

- `socketConfig` (SocketConfig): Socket.IO configuration
- `accountId` (string, optional): Account ID to subscribe to
- `autoSubscribe` (boolean, optional): Auto-subscribe on connect (default: true)
- `enableSound` (boolean, optional): Enable notification sounds (default: true)
- `enableBrowserNotifications` (boolean, optional): Enable browser notifications (default: true)
- `maxRetainedUpdates` (number, optional): Max updates to retain (default: 50)

**Returns:**

- `isConnected` (boolean): Socket connection status
- `connectionState` (string): Connection state description
- `recentUpdates` (RealtimeNotificationUpdate[]): Recent real-time updates
- `lastUpdate` (RealtimeNotificationUpdate | null): Most recent update
- `browserNotificationsEnabled` (boolean): Browser notification permission status
- `soundEnabled` (boolean): Sound notification status
- `updateCount` (number): Total number of updates received
- `subscriptions` (string[]): List of subscribed account IDs

**Methods:**

- `requestBrowserPermission(): Promise<boolean>`: Request browser notification permission
- `subscribe(accountId: string): Promise<void>`: Subscribe to account notifications
- `unsubscribe(accountId: string): Promise<void>`: Unsubscribe from account notifications
- `clearUpdates(): void`: Clear update history
- `setSoundEnabled(enabled: boolean): void`: Enable/disable sound notifications

### useNotificationSettings()

Hook for notification preferences and settings.

```tsx
const {
  soundEnabled,
  setSoundEnabled,
  browserNotificationsEnabled,
  requestBrowserPermission,
  isConnected,
  connectionState,
  subscribe,
  unsubscribe,
  isRealTimeAvailable
} = useNotificationSettings();
```

**Returns:**

- `soundEnabled` (boolean): Sound notification status
- `browserNotificationsEnabled` (boolean): Browser notification permission
- `isConnected` (boolean): Real-time connection status
- `connectionState` (string): Connection state
- `isRealTimeAvailable` (boolean): Whether real-time notifications are available

**Methods:**

- `setSoundEnabled(enabled: boolean): void`: Toggle sound notifications
- `requestBrowserPermission(): Promise<boolean>`: Request browser permission
- `subscribe(accountId: string): Promise<void>`: Subscribe to notifications
- `unsubscribe(accountId: string): Promise<void>`: Unsubscribe from notifications

### useNotificationAlerts()

Hook for real-time notification alerts and updates.

```tsx
const {
  lastUpdate,
  recentUpdates,
  clearUpdates,
  soundEnabled,
  setSoundEnabled,
  browserNotificationsEnabled,
  requestBrowserPermission,
  hasRecentUpdates,
  latestUpdateType
} = useNotificationAlerts();
```

**Returns:**

- `lastUpdate` (RealtimeNotificationUpdate | null): Most recent update
- `recentUpdates` (RealtimeNotificationUpdate[]): Array of recent updates
- `soundEnabled` (boolean): Sound notification status
- `browserNotificationsEnabled` (boolean): Browser notification status
- `hasRecentUpdates` (boolean): Whether there are recent updates
- `latestUpdateType` (string | undefined): Type of the latest update

**Methods:**

- `clearUpdates(): void`: Clear recent updates
- `setSoundEnabled(enabled: boolean): void`: Toggle sound notifications
- `requestBrowserPermission(): Promise<boolean>`: Request browser permission

## Permission Hooks

### useGooglePermissions(accountId?)

Hook for managing Google API permissions.

```tsx
const {
  loading,
  error,
  checkScopes,
  requestPermission,
  getCachedScopeCheck,
  hasPermission,
  clearError,
  clearCache
} = useGooglePermissions(accountId);
```

**Parameters:**

- `accountId` (string, optional): Account ID (defaults to current account)

**Returns:**

- `loading` (boolean): Loading state
- `error` (string | null): Error message

**Methods:**

- `checkScopes(scopeNames: string[]): Promise<TokenCheckResponse | null>`: Check scope permissions
- `requestPermission(scopeNames: string[], redirectUrl?: string): void`: Request permissions
- `getCachedScopeCheck(scopeNames: string[]): TokenCheckResponse | null`: Get cached scope check
- `hasPermission(scopeNames: string[]): boolean`: Check if permissions are granted
- `clearError(): void`: Clear error
- `clearCache(): void`: Clear cached scope checks

## Utility Hooks

### useSocket(config, options?)

Low-level Socket.IO connection management hook.

```tsx
const {
  // Connection state
  connectionState,
  connectionInfo,
  isConnected,
  isSupported,

  // Connection control
  connect,
  disconnect,
  reconnect,

  // Subscription management
  subscribe,
  unsubscribe,
  subscriptions,

  // Event listeners
  on,
  off,

  // Utilities
  getLatency,
  ping
} = useSocket(config, {
  autoConnect: true,
  autoSubscribe: true,
  accountId: 'account-123'
});
```

**Parameters:**

- `config` (SocketConfig): Socket configuration
- `options.autoConnect` (boolean, optional): Auto-connect on mount (default: true)
- `options.autoSubscribe` (boolean, optional): Auto-subscribe to account (default: true)
- `options.accountId` (string, optional): Account ID for auto-subscription

**Returns:**

- `connectionState` (SocketConnectionState): Current connection state
- `connectionInfo` (SocketConnectionInfo): Detailed connection information
- `isConnected` (boolean): Whether socket is connected
- `isSupported` (boolean): Whether Socket.IO is supported
- `subscriptions` (string[]): Array of subscribed account IDs

**Methods:**

- `connect(): Promise<void>`: Connect to socket
- `disconnect(): void`: Disconnect from socket
- `reconnect(): Promise<void>`: Reconnect to socket
- `subscribe(accountId: string): Promise<void>`: Subscribe to account notifications
- `unsubscribe(accountId: string): Promise<void>`: Unsubscribe from notifications
- `on(event, listener): void`: Add event listener
- `off(event, listener?): void`: Remove event listener
- `getLatency(): number | null`: Get connection latency
- `ping(): void`: Send ping to server

## Client Classes

### HttpClient

HTTP client for API communication.

```tsx
const client = new HttpClient({
  baseURL: 'https://api.example.com',
  timeout: 30000,
  withCredentials: true
});
```

**Constructor Options:**

- `baseURL` (string): API base URL
- `timeout` (number, optional): Request timeout in milliseconds (default: 30000)
- `withCredentials` (boolean, optional): Include credentials in requests (default: true)

**Methods:**

- Account Management: `getAccount()`, `updateAccount()`, `searchAccount()`
- Authentication: `localSignup()`, `localLogin()`, `verifyTwoFactor()`
- OAuth: `redirectToOAuthSignup()`, `redirectToOAuthSignin()`
- Passwords: `requestPasswordReset()`, `resetPassword()`, `changePassword()`
- 2FA: `setupTwoFactor()`, `verifyTwoFactorSetup()`, `generateBackupCodes()`
- Google: `getGoogleTokenInfo()`, `checkGoogleScopes()`, `requestGooglePermission()`
- Notifications: `getNotifications()`, `createNotification()`, `markAsRead()`
- Session: `logout()`, `logoutAll()`, `refreshToken()`, `revokeToken()`

### SocketClient

Socket.IO client for real-time communication.

```tsx
const socketClient = new SocketClient({
  url: 'https://api.example.com',
  path: '/socket.io',
  reconnect: true,
  maxReconnectAttempts: 5,
  reconnectDelay: 1000
});
```

**Constructor Options:**

- `url` (string): Socket server URL
- `path` (string, optional): Socket.IO path (default: '/socket.io')
- `reconnect` (boolean, optional): Enable auto-reconnect (default: true)
- `maxReconnectAttempts` (number, optional): Max reconnection attempts (default: 5)
- `reconnectDelay` (number, optional): Delay between reconnects in ms (default: 1000)
- `timeout` (number, optional): Connection timeout (default: 5000)
- `transports` (string[], optional): Transport types (default: ['websocket', 'polling'])

**Methods:**

- `connect(): Promise<void>`: Connect to socket server
- `disconnect(): void`: Disconnect from socket server
- `subscribe(accountId: string): Promise<void>`: Subscribe to account notifications
- `unsubscribe(accountId: string): Promise<void>`: Unsubscribe from notifications
- `on(event, listener): void`: Add event listener
- `off(event, listener?): void`: Remove event listener
- `getConnectionState(): SocketConnectionState`: Get connection state
- `isConnected(): boolean`: Check if connected
- `getLatency(): number | null`: Get connection latency

## Type Definitions

### Core Types

```tsx
// Account related
enum AccountStatus {
  Active = 'active',
  Inactive = 'inactive',
  Unverified = 'unverified',
  Suspended = 'suspended'
}

enum AccountType {
  Local = 'local',
  OAuth = 'oauth'
}

enum OAuthProviders {
  Google = 'google',
  Microsoft = 'microsoft',
  Facebook = 'facebook'
}

interface UserDetails {
  firstName?: string;
  lastName?: string;
  name: string;
  email?: string;
  imageUrl?: string;
  birthdate?: string;
  username?: string;
  emailVerified?: boolean;
}

interface SecuritySettings {
  twoFactorEnabled: boolean;
  sessionTimeout: number;
  autoLock: boolean;
}

interface Account {
  id: string;
  created: string;
  updated: string;
  accountType: AccountType;
  status: AccountStatus;
  userDetails: UserDetails;
  security: SecuritySettings;
  provider?: OAuthProviders;
}
```

### Authentication Types

```tsx
// Local auth
interface LocalSignupRequest {
  firstName: string;
  lastName: string;
  email: string;
  username?: string;
  password: string;
  confirmPassword: string;
  birthdate?: string;
  agreeToTerms: boolean;
}

interface LocalLoginRequest {
  email?: string;
  username?: string;
  password: string;
  rememberMe?: boolean;
}

interface LocalLoginResponse {
  accountId?: string;
  name?: string;
  requiresTwoFactor?: boolean;
  tempToken?: string;
}

interface TwoFactorVerifyRequest {
  token: string;
  tempToken: string;
}

interface PasswordResetRequest {
  email: string;
}

interface ResetPasswordRequest {
  password: string;
  confirmPassword: string;
}

interface PasswordChangeRequest {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface TwoFactorSetupRequest {
  password: string;
  enableTwoFactor: boolean;
}

interface TwoFactorSetupResponse {
  qrCode?: string;
  secret?: string;
  backupCodes?: string[];
}
```

### Notification Types

```tsx
type NotificationType = 'info' | 'success' | 'warning' | 'error';

interface Notification {
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

interface CreateNotificationRequest {
  title: string;
  message: string;
  type: NotificationType;
  link?: string;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
}

interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
}

interface RealtimeNotificationUpdate {
  type: 'new' | 'updated' | 'deleted' | 'all_read';
  notification?: Notification;
  notificationId?: string;
  accountId: string;
  timestamp: number;
}
```

### Google Permission Types

```tsx
type ServiceType = 'gmail' | 'calendar' | 'drive' | 'docs' | 'sheets' | 'people' | 'meet';
type ScopeLevel = 'readonly' | 'full' | 'send' | 'compose' | 'events' | 'file' | 'create' | 'edit';

interface GoogleTokenInfo {
  accessToken: string;
  scope?: string;
  audience?: string;
  expiresIn?: number;
  issuedAt?: number;
  userId?: string;
  email?: string;
  emailVerified?: boolean;
}

interface ScopeCheckResult {
  hasAccess: boolean;
  scopeName: string;
  scopeUrl: string;
}

interface TokenCheckResponse {
  summary: {
    totalRequested: number;
    totalGranted: number;
    allGranted: boolean;
  };
  requestedScopeNames: string[];
  requestedScopeUrls: string[];
  results: Record<string, ScopeCheckResult>;
}
```

### Socket Types

```tsx
enum SocketConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

interface SocketConfig {
  url: string;
  path?: string;
  reconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  timeout?: number;
  forceNew?: boolean;
  transports?: ('websocket' | 'polling')[];
}

interface SocketConnectionInfo {
  state: SocketConnectionState;
  connectedAt?: Date;
  reconnectAttempts: number;
  lastError?: string;
  latency?: number;
}

enum NotificationSocketEvents {
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
  ERROR = 'error'
}
```

### Configuration Types

```tsx
interface SDKConfig {
  baseURL: string;
  timeout?: number;
  withCredentials?: boolean;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
```

## Error Handling

### AuthSDKError

Custom error class for SDK-specific errors.

```tsx
class AuthSDKError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public data?: Record<string, any>
  );
}

enum ErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_FAILED = 'AUTH_FAILED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INSUFFICIENT_SCOPE = 'INSUFFICIENT_SCOPE',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  SERVER_ERROR = 'SERVER_ERROR'
}
```

**Usage:**

```tsx
import { AuthSDKError, ErrorCode } from '@accountsystem/auth-react-sdk';

try {
  await login({ email, password });
} catch (error) {
  if (error instanceof AuthSDKError) {
    switch (error.code) {
      case ErrorCode.AUTH_FAILED:
        console.log('Invalid credentials');
        break;
      case ErrorCode.NETWORK_ERROR:
        console.log('Network connection failed');
        break;
      case ErrorCode.VALIDATION_ERROR:
        console.log('Validation failed:', error.data);
        break;
      default:
        console.log('Unknown error:', error.message);
    }
  }
}
```

### Error Handling Patterns

#### Hook-level Error Handling

Most hooks provide built-in error handling:

```tsx
const { login, error, clearError } = useLocalAuth();

// Error is automatically set by the hook
if (error) {
  return <div className="error">{error}</div>;
}

// Clear error when needed
const handleRetry = () => {
  clearError();
  // Retry the operation
};
```

#### Form Validation Errors

Some hooks provide field-specific validation errors:

```tsx
const { signup, formErrors, getFieldError } = useLocalAuth();

return (
  <form>
    <input 
      name="email" 
      className={formErrors.email ? 'error' : ''}
    />
    {formErrors.email && (
      <span className="field-error">{formErrors.email}</span>
    )}
    
    {/* Or use the helper function */}
    {getFieldError('password') && (
      <span className="field-error">{getFieldError('password')}</span>
    )}
  </form>
);
```

#### Global Error Handling

You can implement global error handling using the auth context:

```tsx
function ErrorBoundary() {
  const { error, clearError } = useAuth();

  useEffect(() => {
    if (error) {
      // Log to error reporting service
      console.error('Auth Error:', error);
      
      // Show toast notification
      showToast(error, 'error');
      
      // Auto-clear after 5 seconds
      setTimeout(clearError, 5000);
    }
  }, [error, clearError]);

  return null;
}
```

## Utility Functions

The SDK also provides utility functions for common operations:

```tsx
import {
  validatePasswordStrength,
  validateEmail,
  formatAccountName,
  getAccountInitials,
  formatNotificationTime,
  buildGoogleScopeUrls
} from '@accountsystem/auth-react-sdk';

// Password validation
const validation = validatePasswordStrength('myPassword123!');
console.log(validation.isValid); // boolean
console.log(validation.errors); // string[]
console.log(validation.strength); // 'weak' | 'fair' | 'strong'

// Email validation
const isValid = validateEmail('user@example.com'); // boolean

// Account display helpers
const displayName = formatAccountName('John', 'Doe', 'John Doe'); // 'John Doe'
const initials = getAccountInitials('John Doe'); // 'JD'

// Notification time formatting
const timeAgo = formatNotificationTime(Date.now() - 300000); // '5m ago'

// Google scope URL building
const scopeUrls = buildGoogleScopeUrls(['gmail.readonly', 'calendar.events']);
// ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/calendar.events']
```

## Best Practices

### 1. Provider Setup

Always wrap your app with the required providers:

```tsx
function App() {
  return (
    <AuthProvider client={httpClient}>
      <NotificationsProvider socketConfig={socketConfig}>
        <Router>
          <Routes>
            {/* Your routes */}
          </Routes>
        </Router>
      </NotificationsProvider>
    </AuthProvider>
  );
}
```

### 2. Error Handling

Implement comprehensive error handling:

```tsx
const MyComponent = () => {
  const { login, error, clearError } = useLocalAuth();

  const handleLogin = async (data) => {
    try {
      clearError(); // Clear previous errors
      await login(data);
    } catch (err) {
      // Error is automatically handled by the hook
      // You can add additional error handling here if needed
    }
  };

  return (
    <div>
      {error && (
        <div className="error-banner">
          {error}
          <button onClick={clearError}>×</button>
        </div>
      )}
      {/* Your component content */}
    </div>
  );
};
```

### 3. Loading States

Always handle loading states for better UX:

```tsx
const MyComponent = () => {
  const { account, loading, refetch } = useAccount();
  const { isAuthenticating } = useAuth();

  if (loading || isAuthenticating) {
    return <LoadingSpinner />;
  }

  return (
    <div>
      {/* Your content */}
    </div>
  );
};
```

### 4. Real-time Updates

For real-time features, combine static data with live updates:

```tsx
const NotificationCenter = () => {
  const { notifications } = useNotifications();
  const { lastUpdate, clearUpdates } = useRealtimeNotifications(socketConfig);

  useEffect(() => {
    if (lastUpdate) {
      // Handle real-time update
      showToast(`New ${lastUpdate.type} notification`);
    }
  }, [lastUpdate]);

  return (
    <div>
      {/* Notification list */}
    </div>
  );
};
```

### 5. Performance Optimization

Use selective subscriptions and memoization:

```tsx
const OptimizedComponent = React.memo(() => {
  const { currentAccount } = useAuth();
  const { notifications } = useNotificationsFeed({ 
    limit: 10,
    unreadOnly: true 
  });

  // Only re-render when specific data changes
  return useMemo(() => (
    <div>
      {/* Your content */}
    </div>
  ), [currentAccount?.id, notifications.length]);
});
```
