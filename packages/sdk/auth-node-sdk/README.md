# Auth Node SDK

Node.js SDK for AccountSystem authentication microservice. This SDK provides Express middleware and utilities to integrate with the AccountSystem authentication service, supporting both local authentication and OAuth (Google, Microsoft, Facebook) with advanced features like 2FA, session management, and real-time notifications.

## Features

- 🔐 **Session Validation**: Middleware for validating user sessions
- 🎯 **Account Type Enforcement**: Require specific account types (Local/OAuth)
- 🔑 **Google API Integration**: Validate Google OAuth scopes and permissions
- 🔄 **Automatic Token Refresh**: Handle token expiration gracefully
- 📡 **Real-time Notifications**: WebSocket client for live updates
- 🛡️ **Secure Communication**: mTLS authentication with the auth service
- 📝 **TypeScript Support**: Full type definitions included
- ⚡ **Express Middleware**: Easy integration with Express.js applications

## Installation

```bash
npm install @accountsystem/auth-node-sdk
```

## Quick Start

### 1. Configure the SDK

```javascript
import { AuthSDK } from '@accountsystem/auth-node-sdk';

// Configure the SDK with your service credentials
AuthSDK.configure({
  authServiceUrl: 'https://your-auth-service.com',
  serviceName: 'your-service-name',
  serviceSecret: 'your-service-secret',
  certificates: {
    key: '/path/to/your/client.key',
    cert: '/path/to/your/client.crt',
    ca: '/path/to/ca.crt'
  },
  requestTimeout: 10000 // optional, defaults to 10 seconds
});
```

### 2. Use Authentication Middleware

```javascript
import express from 'express';
import { AuthSDK } from '@accountsystem/auth-node-sdk';

const app = express();

// Validate session for protected routes
app.use('/:accountId/protected', AuthSDK.validateSession());

// Require specific account type
app.use('/:accountId/oauth-only', 
  AuthSDK.validateSession(),
  AuthSDK.requireAccountType('oauth')
);

// Require Google API scopes
app.use('/:accountId/gmail', 
  AuthSDK.validateSession(),
  AuthSDK.requireGoogleScope('gmail.readonly')
);

// Multiple scopes
app.use('/:accountId/calendar-gmail', 
  AuthSDK.validateSession(),
  AuthSDK.requireGoogleScopes(['gmail.readonly', 'calendar.events'])
);

// Your protected route
app.get('/:accountId/protected/data', (req, res) => {
  // req.account contains the authenticated user's account information
  res.json({
    message: 'Hello authenticated user!',
    account: req.account
  });
});
```

### 3. Use the Client Directly

```javascript
import { AuthSDK } from '@accountsystem/auth-node-sdk';

const authClient = AuthSDK.getInstance().getAuthClient;

// Get user information
try {
  const userInfo = await authClient.getUserInfo('account-id-123');
  console.log('User:', userInfo.account.userDetails.name);
} catch (error) {
  console.error('Failed to get user info:', error.message);
}

// Search user by email
const user = await authClient.searchUserByEmail('user@example.com');

// Validate session
const session = await authClient.validateSession('account-id', 'access-token');

// Get user's Google scopes
const scopes = await authClient.getUserScopes('account-id');
```

### 4. Real-time Notifications

```javascript
import { AuthSDK } from '@accountsystem/auth-node-sdk';

const socketClient = AuthSDK.getInstance().getSocketClient;

// Connect to notification service
await socketClient.connect();

// Subscribe to account notifications
await socketClient.subscribeToAccount('account-id-123');

// Listen for notifications
socketClient.onNotification('notification:new', (data) => {
  console.log('New notification:', data);
});

socketClient.onNotification('notification:updated', (data) => {
  console.log('Notification updated:', data);
});
```

## Configuration Options

### Required Configuration

```javascript
{
  authServiceUrl: 'https://your-auth-service.com',  // Your AccountSystem service URL
  serviceName: 'your-service-name',                 // Internal service identifier
  serviceSecret: 'your-service-secret',             // Service authentication secret
  certificates: {
    key: '/path/to/client.key',                     // Client private key for mTLS
    cert: '/path/to/client.crt',                    // Client certificate for mTLS  
    ca: '/path/to/ca.crt'                          // CA certificate for verification
  }
}
```

### Optional Configuration

```javascript
{
  requestTimeout: 10000  // Request timeout in milliseconds (default: 10000)
}
```

## Security

This SDK uses **mutual TLS (mTLS)** for secure communication with the AccountSystem service. The authentication flow includes:

1. **Client Certificate Validation** - Your service must present a valid client certificate signed by the same CA as the auth service
2. **Service Header Authentication** - The SDK automatically sends service identification headers
3. **Request Signing** - All requests are authenticated using your service credentials

Ensure your certificates are properly configured and secured. No additional configuration is needed on the auth service side.

## Error Handling

The SDK throws errors with descriptive messages. Wrap your calls in try-catch blocks:

```javascript
try {
  const user = await authClient.getUserInfo(accountId);
} catch (error) {
  console.error('Auth error:', error.message);
  // Handle the error appropriately
}
```

## TypeScript Support

This SDK is written in TypeScript and provides full type definitions. All types are exported:

```typescript
import { SafeAccount, AccountType, AuthSDKConfig } from '@accountsystem/auth-node-sdk';
```

## License

MIT License - see LICENSE file for details.