'use client';

import { HttpClient } from '../../sdk/auth-react-sdk/src';
import { getEnvironmentConfig } from './utils';

// Get configuration
const config = getEnvironmentConfig();

// Create HTTP client instance
export const authClient = new HttpClient({
  backendUrl: config.backendUrl,
  proxyPath: config.proxyPath,
  timeout: 30000,
  withCredentials: true, // Important for cookie-based auth
});

// Socket configuration for real-time features
export const socketConfig = {
  url: config.socketUrl,
  path: '/socket.io',
  reconnect: true,
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
  timeout: 5000,
  transports: ['websocket', 'polling'] as ('websocket' | 'polling')[],
};

// Auth configuration object
export const authConfig = {
  client: authClient,
  socket: socketConfig,
  features: {
    oauth: config.enableOAuth,
    localAuth: config.enableLocalAuth,
    twoFactor: config.enable2FA,
  },
  branding: {
    appName: config.appName,
    companyName: config.companyName,
    supportEmail: config.supportEmail,
    privacyUrl: config.privacyUrl,
    termsUrl: config.termsUrl,
  },
  redirects: {
    home: config.homeUrl || '/dashboard',
    afterLogin: config.homeUrl || '/dashboard',
    afterLogout: '/login',
    afterSignup: '/check-email',
  },
  development: {
    debugMode: config.debugMode,
    environment: config.environment,
  },
};

// Export individual pieces for convenience
export { authClient as client, socketConfig as socket };
export default authConfig;
