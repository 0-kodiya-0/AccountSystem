// Main exports
export { HttpClient } from './client/http-client';
export { SocketClient } from "./client/socket-client";

// Context and Provider
export { AuthProvider, useAuth } from './context/auth-context';
export { NotificationsProvider, useNotificationsContext } from './context/notifications-context';

// Store exports
export { 
    useAccountStore, 
    useCurrentAccount, 
    useAccounts, 
    useAuthState, 
    useOAuthState 
} from './store/account-store';

// Type exports
export * from './types';

// Utility exports
export * from './utils';

export { useAccount } from "./hooks/useAccount";
export { useAccountSwitcher } from "./hooks/useAccountSwitcher";
export { useGooglePermissions } from "./hooks/useGooglePermissions";
export { useLocalAuth } from "./hooks/useLocalAuth";
export { useNotificationAlerts } from "./hooks/useNotificationAlerts";
export { useNotificationSettings } from "./hooks/useNotificationSettings";
export { useNotifications } from "./hooks/useNotifications";
export { useNotificationsBadge } from "./hooks/useNotificationsBadge";
export { useNotificationsFeed } from "./hooks/useNotificationsFeed";
export { useOAuth } from "./hooks/useOAuth";
export { useRealtimeNotifications } from "./hooks/useRealtimeNotifications";
export { useSocket } from "./hooks/useSocket";

// Version export
export const version = '1.0.0';