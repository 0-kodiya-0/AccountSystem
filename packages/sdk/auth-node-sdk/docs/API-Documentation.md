# Auth Node SDK - API Documentation

Complete API reference for the Auth Node SDK.

## Table of Contents

- [Configuration](#configuration)
- [AuthSDK Class](#authsdk-class)
- [Middleware](#middleware)
- [AuthClient](#authclient)
- [AuthSocketClient](#authsocketclient)
- [Types](#types)
- [Error Handling](#error-handling)

## Configuration

### AuthSDKConfig

Configuration object for initializing the SDK.

```typescript
interface AuthSDKConfig {
    authServiceUrl: string;      // URL of the AccountSystem service
    serviceName: string;         // Internal service identifier
    serviceSecret: string;       // Service authentication secret
    certificates: {
        key: string;             // Path to client private key
        cert: string;            // Path to client certificate
        ca: string;              // Path to CA certificate
    };
    requestTimeout?: number;     // Request timeout in milliseconds (default: 10000)
}
```

**Example:**

```javascript
const config = {
    authServiceUrl: 'https://auth.example.com',
    serviceName: 'my-service',
    serviceSecret: 'secret-key-123',
    certificates: {
        key: '/certs/client.key',
        cert: '/certs/client.crt',
        ca: '/certs/ca.crt'
    },
    requestTimeout: 15000
};
```

## AuthSDK Class

Main SDK class providing static methods for configuration and middleware creation.

### Static Methods

#### `configure(config: AuthSDKConfig): void`

Configures the SDK with service credentials and certificates.

```javascript
AuthSDK.configure({
    authServiceUrl: 'https://auth.example.com',
    serviceName: 'my-service',
    serviceSecret: 'secret',
    certificates: {
        key: '/path/to/client.key',
        cert: '/path/to/client.crt',
        ca: '/path/to/ca.crt'
    }
});
```

**Throws:** Error if SDK is already configured

#### `getInstance(): AuthSDK`

Returns the singleton SDK instance.

```javascript
const sdk = AuthSDK.getInstance();
const client = sdk.getAuthClient;
const socketClient = sdk.getSocketClient;
```

**Throws:** Error if SDK not configured

## Middleware

Express middleware functions for authentication and authorization.

### Session Validation

#### `validateSession(): RequestHandler`

Validates user session and populates request with account information.

```javascript
app.use('/:accountId/protected', AuthSDK.validateSession());
```

**Request Modifications:**

- `req.account: SafeAccount` - User account information
- `req.accountType: AccountType` - Account type ('local' or 'oauth')
- `req.oauthAccessToken?: string` - OAuth access token (for OAuth accounts)

**Errors:**

- `400` - Missing account ID
- `401` - Invalid or missing tokens

#### `validateSessionWithRedirect(): RequestHandler`

Same as `validateSession()` but handles token refresh automatically with redirects.

```javascript
app.use('/:accountId/api', AuthSDK.validateSessionWithRedirect());
```

**Redirect Behavior:**

- Access token expired → Redirects to refresh endpoint
- Refresh token expired → Redirects to logout endpoint

### Account Type Validation

#### `requireAccountType(type: AccountType): RequestHandler`

Requires a specific account type.

```javascript
// Require OAuth accounts only
app.use('/:accountId/oauth-only', 
    AuthSDK.validateSession(),
    AuthSDK.requireAccountType('oauth')
);

// Require local accounts only
app.use('/:accountId/local-only',
    AuthSDK.validateSession(), 
    AuthSDK.requireAccountType('local')
);
```

**Parameters:**

- `type: 'local' | 'oauth'` - Required account type

**Errors:**

- `401` - Account not loaded (use validateSession first)
- `403` - Account type mismatch

### Google API Scope Validation

#### `requireGoogleScope(scopeName: string): RequestHandler`

Requires a single Google API scope.

```javascript
app.use('/:accountId/gmail', 
    AuthSDK.validateSession(),
    AuthSDK.requireGoogleScope('gmail.readonly')
);
```

**Parameters:**

- `scopeName: string` - Google scope name (e.g., 'gmail.readonly', 'calendar.events')

#### `requireGoogleScopes(scopeNames: string[]): RequestHandler`

Requires multiple Google API scopes.

```javascript
app.use('/:accountId/gmail-calendar',
    AuthSDK.validateSession(),
    AuthSDK.requireGoogleScopes(['gmail.readonly', 'calendar.events'])
);
```

**Parameters:**

- `scopeNames: string[]` - Array of Google scope names

**Request Modifications:**

- `req.validatedScopes: string[]` - Array of validated scope names

**Errors:**

- `401` - Account not loaded or missing OAuth token
- `403` - Insufficient scopes or non-OAuth account

#### `requireGoogleScopeUrl(scopeUrl: string): RequestHandler`

Requires a Google API scope by full URL.

```javascript
app.use('/gmail', AuthSDK.requireGoogleScopeUrl('https://www.googleapis.com/auth/gmail.readonly'));
```

#### `requireGoogleScopeUrls(scopeUrls: string[]): RequestHandler`

Requires multiple Google API scopes by full URLs.

## AuthClient

HTTP client for direct API calls to the auth service.

### Methods

#### `getUserInfo(accountId: string): Promise<UserSearchResult>`

Get user account information.

```javascript
const authClient = AuthSDK.getInstance().getAuthClient;

try {
    const result = await authClient.getUserInfo('account-123');
    console.log('User:', result.account.userDetails.name);
} catch (error) {
    console.error('User not found:', error.message);
}
```

**Returns:** `UserSearchResult`

```typescript
interface UserSearchResult {
    account: SafeAccount;
    accountType: AccountType;
    status: AccountStatus;
}
```

#### `searchUserByEmail(email: string): Promise<UserSearchResult>`

Search for a user by email address.

```javascript
const user = await authClient.searchUserByEmail('user@example.com');
```

#### `validateSession(accountId: string, accessToken?: string, refreshToken?: string): Promise<SessionValidationResult>`

Validate a user session.

```javascript
const session = await authClient.validateSession('account-123', 'access-token-here');
console.log('Valid session:', session.valid);
```

**Returns:** `SessionValidationResult`

```typescript
interface SessionValidationResult {
    valid: boolean;
    account: SafeAccount;
    accountType: AccountType;
    tokenType: 'access' | 'refresh';
    oauthAccessToken?: string;
    oauthRefreshToken?: string;
}
```

#### `validateGoogleAccess(accountId: string, accessToken: string, requiredScopes?: string[]): Promise<GoogleValidationResult>`

Validate Google API access and check required scopes.

```javascript
const result = await authClient.validateGoogleAccess(
    'account-123',
    'oauth-token',
    ['gmail.readonly', 'calendar.events']
);

if (result.allScopesGranted) {
    console.log('All scopes available');
} else {
    console.log('Missing scopes:', 
        Object.keys(result.scopeResults).filter(scope => !result.scopeResults[scope])
    );
}
```

**Returns:** `GoogleValidationResult`

```typescript
interface GoogleValidationResult {
    valid: boolean;
    accountId: string;
    tokenInfo: any;
    scopeResults: Record<string, boolean>;
    allScopesGranted: boolean;
    requiredScopes: string[];
}
```

#### `verifyGoogleToken(accountId: string, accessToken: string): Promise<TokenVerificationResult>`

Verify that a Google token belongs to the specified account.

```javascript
const verification = await authClient.verifyGoogleToken('account-123', 'oauth-token');
if (!verification.valid) {
    console.error('Token verification failed:', verification.reason);
}
```

#### `getUserScopes(accountId: string): Promise<ScopesResult>`

Get all Google scopes granted to a user.

```javascript
const scopes = await authClient.getUserScopes('account-123');
console.log(`User has ${scopes.scopeCount} scopes:`, scopes.scopes);
```

#### `getGoogleTokenInfo(accountId: string, accessToken: string): Promise<GoogleTokenInfoResult>`

Get detailed Google token information.

```javascript
const tokenInfo = await authClient.getGoogleTokenInfo('account-123', 'oauth-token');
console.log('Token expires in:', tokenInfo.tokenInfo.expiresIn, 'seconds');
```

## AuthSocketClient

WebSocket client for real-time notifications.

### Methods

#### `connect(): Promise<void>`

Connect to the notification service.

```javascript
const socketClient = AuthSDK.getInstance().getSocketClient;

try {
    await socketClient.connect();
    console.log('Connected to notifications');
} catch (error) {
    console.error('Connection failed:', error.message);
}
```

#### `subscribeToAccount(accountId: string): Promise<void>`

Subscribe to notifications for a specific account.

```javascript
await socketClient.subscribeToAccount('account-123');
```

#### `unsubscribeFromAccount(accountId: string): Promise<void>`

Unsubscribe from account notifications.

```javascript
await socketClient.unsubscribeFromAccount('account-123');
```

#### `subscribeToAccounts(accountIds: string[]): Promise<void>`

Subscribe to notifications for multiple accounts.

```javascript
await socketClient.subscribeToAccounts(['account-1', 'account-2', 'account-3']);
```

#### `onNotification(event: string, callback: (data: InternalNotificationData) => void): void`

Listen for notification events.

```javascript
socketClient.onNotification('notification:new', (data) => {
    console.log('New notification for account:', data.accountId);
    console.log('Notification data:', data);
});

socketClient.onNotification('notification:updated', (data) => {
    console.log('Notification updated:', data);
});

socketClient.onNotification('notification:deleted', (notificationId) => {
    console.log('Notification deleted:', notificationId);
});
```

**Common Events:**

- `notification:new` - New notification created
- `notification:updated` - Notification updated
- `notification:deleted` - Notification deleted
- `notification:all-read` - All notifications marked as read
- `notification:all-deleted` - All notifications deleted

#### `offNotification(event: string, callback?: Function): void`

Stop listening for notification events.

```javascript
// Remove specific callback
socketClient.offNotification('notification:new', specificCallback);

// Remove all callbacks for event
socketClient.offNotification('notification:new');
```

#### `ping(): Promise<any>`

Send a ping to test connection.

```javascript
try {
    const response = await socketClient.ping();
    console.log('Ping response:', response);
} catch (error) {
    console.error('Ping failed:', error.message);
}
```

#### `disconnect(): void`

Disconnect from the notification service.

```javascript
socketClient.disconnect();
```

### Properties

#### `isConnected: boolean`

Check if socket is connected.

```javascript
if (socketClient.isConnected) {
    await socketClient.subscribeToAccount('account-123');
}
```

#### `getSubscriptions: string[]`

Get list of currently subscribed account IDs.

```javascript
const subscriptions = socketClient.getSubscriptions;
console.log('Subscribed to accounts:', subscriptions);
```

## Types

### Core Types

```typescript
enum AccountType {
    Local = 'local',
    OAuth = 'oauth'
}

enum AccountStatus {
    Active = 'active',
    Inactive = 'inactive', 
    Unverified = 'unverified',
    Suspended = 'suspended'
}

enum OAuthProviders {
    Google = 'google',
    Microsoft = 'microsoft',
    Facebook = 'facebook'
}

interface SafeAccount {
    id: string;
    created: string;
    updated: string;
    accountType: AccountType;
    status: AccountStatus;
    provider?: OAuthProviders;
    userDetails: UserDetails;
    security: {
        twoFactorEnabled: boolean;
        sessionTimeout: number;
        autoLock: boolean;
    };
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
```

### API Response Types

```typescript
interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: any;
    };
}

interface InternalNotificationData {
    accountId?: string;
    timestamp: string;
    [key: string]: any;
}
```

### Error Codes

```typescript
enum ApiErrorCode {
    INVALID_STATE = 'INVALID_STATE',
    INVALID_PROVIDER = 'INVALID_PROVIDER',
    MISSING_DATA = 'MISSING_DATA',
    DATABASE_ERROR = 'DATABASE_ERROR',
    AUTH_FAILED = 'AUTH_FAILED',
    USER_EXISTS = 'USER_EXISTS',
    USER_NOT_FOUND = 'USER_NOT_FOUND',
    PERMISSION_DENIED = 'PERMISSION_DENIED',
    INSUFFICIENT_SCOPE = 'INSUFFICIENT_SCOPE',
    INVALID_REQUEST = 'INVALID_REQUEST',
    SERVER_ERROR = 'SERVER_ERROR',
    RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
    SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
    CONNECTION_ERROR = 'CONNECTION_ERROR',
    TIMEOUT_ERROR = 'TIMEOUT_ERROR',
    TOKEN_EXPIRED = 'TOKEN_EXPIRED',
    TOKEN_INVALID = 'TOKEN_INVALID',
    TOKEN_REVOKED = 'TOKEN_REVOKED',
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    INVALID_PARAMETERS = 'INVALID_PARAMETERS'
}
```

## Error Handling

### Common Error Scenarios

#### Authentication Errors

```javascript
try {
    const result = await authClient.validateSession('account-123', 'invalid-token');
} catch (error) {
    if (error.message.includes('TOKEN_INVALID')) {
        // Handle invalid token
        console.log('Token is invalid, redirect to login');
    } else if (error.message.includes('TOKEN_EXPIRED')) {
        // Handle expired token
        console.log('Token expired, try to refresh');
    }
}
```

#### Scope Validation Errors

```javascript
app.use('/:accountId/gmail',
    AuthSDK.validateSession(),
    AuthSDK.requireGoogleScopes(['gmail.readonly']),
    (error, req, res, next) => {
        if (error.code === 'INSUFFICIENT_SCOPE') {
            res.status(403).json({
                error: 'Missing Gmail permissions',
                requiredScopes: ['gmail.readonly'],
                permissionUrl: `/oauth/permission/gmail.readonly?accountId=${req.params.accountId}`
            });
        } else {
            next(error);
        }
    }
);
```

#### Connection Errors

```javascript
try {
    await socketClient.connect();
} catch (error) {
    if (error.message.includes('CONNECTION_ERROR')) {
        console.log('Failed to connect to notification service, continuing without real-time updates');
        // Continue without notifications
    } else {
        throw error; // Re-throw unexpected errors
    }
}
```

### Best Practices

1. **Always wrap SDK calls in try-catch blocks**
2. **Check error codes for specific handling**
3. **Provide fallback behavior for non-critical features**
4. **Log errors appropriately for debugging**
5. **Handle token expiration gracefully**

### Express Error Handler Example

```javascript
app.use((error, req, res, next) => {
    console.error('Auth SDK Error:', error);
    
    switch (error.code) {
        case 'AUTH_FAILED':
        case 'TOKEN_INVALID':
        case 'TOKEN_EXPIRED':
            res.status(401).json({ error: 'Authentication required' });
            break;
            
        case 'INSUFFICIENT_SCOPE':
        case 'PERMISSION_DENIED':
            res.status(403).json({ error: 'Insufficient permissions' });
            break;
            
        case 'USER_NOT_FOUND':
        case 'RESOURCE_NOT_FOUND':
            res.status(404).json({ error: 'Resource not found' });
            break;
            
        case 'RATE_LIMIT_EXCEEDED':
            res.status(429).json({ error: 'Rate limit exceeded' });
            break;
            
        default:
            res.status(500).json({ error: 'Internal server error' });
    }
});
```
