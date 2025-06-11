'use client';

// Main exports
export { HttpClient } from './client/HttpClient';
export { SocketClient } from './client/socketClient';

// Context and Provider
export { AuthProvider } from './context/AuthProvider';

// Components
export { AuthGuard } from './components/AuthGuard';

// Routing and Protection Hooks
export { useAuthCallbackHandler } from './hooks/useAuthCallbackHandler';
export { useAuthRedirectHandler } from './hooks/useAuthRedirectHandler';
export { useAuthGuard } from './hooks/useAuthGuard';

// Workflow Hooks (NEW)
export { useEmailVerification } from './hooks/useEmailVerification';
export { usePasswordReset } from './hooks/usePasswordReset';
export { use2FASetup } from './hooks/use2FASetup';
export { use2FAVerification } from './hooks/use2FAVerification';

// Store exports
export {
  useAccountStore,
  useCurrentAccount,
  useAccounts,
  useAuthState,
  useAuthFlowState,
  useMissingFullAccountIds,
  useAccountDataStatus,
  useAccountIds,
  useAccountSession,
  useMissingAccountIds,
} from './store/account-store';

// Data Management Hooks
export { useNotifications } from './hooks/useNotifications';
export { useRealtimeNotifications } from './hooks/useRealtimeNotifications';
export { useSocket } from './hooks/useSocket';
export { useAccount } from './hooks/useAccount';

// Type exports (with new workflow types)
export * from './types';

// Utility exports
export * from './utils';

// Version export
export const version = '1.0.0';
