// Main exports
export { HttpClient } from './client/http-client';
export { SocketClient } from "./client/socket-client";

// Context and Provider
export { AuthProvider, useAuth } from './context/auth-context';
export { NotificationsProvider, useNotificationsContext } from './context/notifications-context';

// Callback handling
export { useAuthCallbackHandler } from './hooks/useAuthCallbackHandler';

// Store exports
export { 
    useAccountStore, 
    useCurrentAccount as useCurrentAccountFromStore, // Rename to avoid confusion with hook
    useAccounts as useAccountsFromStore, // Rename to avoid confusion with hook
    useAllAccounts,
    useDisabledAccounts,
    useAuthState, 
    useOAuthState,
    useAccountDataStatus,
    useAccountIds
} from './store/account-store';

// Hook exports
export { useNotifications } from "./hooks/useNotifications";
export { useRealtimeNotifications } from "./hooks/useRealtimeNotifications";
export { useSocket } from "./hooks/useSocket";
export { useAccount } from "./hooks/useAccount";

// Type exports
export * from './types';

// Utility exports
export * from './utils';

// Version export
export const version = '1.0.0';