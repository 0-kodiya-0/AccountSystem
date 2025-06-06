# @accountsystem/auth-react-sdk

A comprehensive React SDK for the AccountSystem authentication service, providing seamless integration for local authentication, OAuth flows, account management, and real-time notifications.

## Features

### 🔐 Authentication Methods

- **Local Authentication**: Email/password with strong security features
- **OAuth Integration**: Google, Microsoft, Facebook (easily extensible)
- **Two-Factor Authentication**: TOTP-based 2FA with backup codes
- **Account Switching**: Multi-account support with easy switching

### 📱 Account Management

- **Profile Management**: Update user details and security settings
- **Session Management**: Token refresh, logout, and session monitoring
- **Security Settings**: Password changes, 2FA setup, session timeouts
- **Account Recovery**: Password reset and email verification flows

### 🔔 Real-time Notifications

- **Live Updates**: Socket.IO-based real-time notification system
- **Browser Notifications**: Native browser notification support
- **Sound Alerts**: Customizable notification sounds
- **Notification Management**: Mark as read, delete, filter by type

### 🔑 Google Permissions

- **Scope Management**: Request and check Google API permissions
- **Dynamic Permissions**: Request additional scopes as needed
- **Permission Validation**: Verify current access levels

### 🎯 Developer Experience

- **TypeScript First**: Full type safety and excellent IDE support
- **React Hooks**: Modern React patterns with custom hooks
- **Zustand Store**: Lightweight state management
- **Error Handling**: Comprehensive error handling with user-friendly messages

## Installation

```bash
npm install @accountsystem/auth-react-sdk
```

## Quick Start

### 1. Setup the AuthProvider

```tsx
import React from 'react';
import { AuthProvider, HttpClient } from '@accountsystem/auth-react-sdk';

// Initialize the HTTP client
const client = new HttpClient({
  baseURL: 'https://your-auth-service.com'
});

function App() {
  return (
    <AuthProvider client={client}>
      <YourApp />
    </AuthProvider>
  );
}

export default App;
```

### 2. Basic Usage Example

```tsx
import React from 'react';
import { useAuth, useLocalAuth } from '@accountsystem/auth-react-sdk';

function LoginForm() {
  const { isAuthenticated, currentAccount } = useAuth();
  const { login, isAuthenticating, error } = useLocalAuth();

  const handleLogin = async (email: string, password: string) => {
    try {
      await login({ email, password });
    } catch (err) {
      // Error handling is managed by the hook
    }
  };

  if (isAuthenticated) {
    return <div>Welcome, {currentAccount?.userDetails.name}!</div>;
  }

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const formData = new FormData(e.target as HTMLFormElement);
      handleLogin(
        formData.get('email') as string,
        formData.get('password') as string
      );
    }}>
      <input name="email" type="email" placeholder="Email" required />
      <input name="password" type="password" placeholder="Password" required />
      <button type="submit" disabled={isAuthenticating}>
        {isAuthenticating ? 'Logging in...' : 'Login'}
      </button>
      {error && <div className="error">{error}</div>}
    </form>
  );
}
```

> **📚 For more comprehensive examples, see our [Examples Documentation](./docs/examples.md)**

## Available Hooks

### Authentication Hooks

- `useAuth()` - Main authentication context and methods
- `useLocalAuth()` - Local authentication (email/password) flows
- `useOAuth()` - OAuth authentication flows

### Account Management Hooks

- `useAccount(accountId?)` - Account data and management
- `useAccountSwitcher()` - Multi-account switching functionality

### Notification Hooks

- `useNotifications(accountId?)` - Core notification management
- `useRealtimeNotifications()` - Real-time notification updates
- `useNotificationsBadge()` - Unread count and badge display
- `useNotificationsFeed()` - Filtered notification lists
- `useNotificationSettings()` - Notification preferences

### Permission Hooks

- `useGooglePermissions(accountId?)` - Google API permission management

### Utility Hooks

- `useSocket()` - Low-level Socket.IO connection management

## Configuration Options

### HttpClient Configuration

```tsx
const client = new HttpClient({
  baseURL: 'https://api.example.com',
  timeout: 30000,
  withCredentials: true
});
```

### Socket Configuration

```tsx
const socketConfig = {
  url: 'https://api.example.com',
  path: '/socket.io',
  reconnect: true,
  maxReconnectAttempts: 5,
  reconnectDelay: 1000
};
```

## Error Handling

The SDK provides comprehensive error handling with typed error objects:

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
      default:
        console.log('Unknown error:', error.message);
    }
  }
}
```

## TypeScript Support

The SDK is built with TypeScript and provides full type safety:

```tsx
import type { 
  Account, 
  Notification, 
  LocalLoginRequest,
  OAuthProviders 
} from '@accountsystem/auth-react-sdk';

// All types are fully typed and documented
const handleLogin = async (request: LocalLoginRequest) => {
  // TypeScript will validate the request object
};
```

## Documentation

- **[Examples](./docs/examples.md)** - Comprehensive usage examples
- **[API Reference](./docs/api-reference.md)** - Detailed API documentation
- **[Data Flow](./docs/data-flow.md)** - Understanding the SDK architecture

## Requirements

- React 18+
- TypeScript 4.5+ (optional but recommended)
- Modern browser with WebSocket support

## Browser Support

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

## Support

- **Documentation**: [GitHub Repository](https://github.com/0-kodiya-0/AccountSystem)
- **Issues**: [GitHub Issues](https://github.com/0-kodiya-0/AccountSystem/issues)
- **Discussions**: [GitHub Discussions](https://github.com/0-kodiya-0/AccountSystem/discussions)
