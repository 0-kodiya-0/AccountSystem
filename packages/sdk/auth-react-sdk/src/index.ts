'use client';

export { ServiceManager } from './services/ServiceManager';
export { AccountService } from './services/AccountService';
export { AuthService } from './services/AuthService';
export { NotificationService } from './services/NotificationService';

// Main exports
export { HttpClient } from './client/HttpClient';
export { SocketClient } from './client/CustomSocketClient';

// Context and Provider
export { AuthProvider } from './context/AuthProvider';

// Components
export { AuthGuard } from './components/AuthGuard';

// Routing and Protection Hooks
export { useAuthCallbackHandler, CallbackCode } from './hooks/useAuthCallbackHandler';

// Workflow Hooks (NEW)
export { useAuth } from './hooks/useAuth';
export { useEmailVerification, EmailVerificationStatus } from './hooks/useEmailVerification';
export { usePasswordReset, PasswordResetStatus } from './hooks/usePasswordReset';
export { use2FASetup, TwoFactorSetupStatus } from './hooks/use2FASetup';
export { use2FAVerification, TwoFactorVerificationStatus } from './hooks/use2FAVerification';

// Store exports
export * as useAppStore from './store/useAppStore';

// Data Management Hooks
export { useNotifications } from './hooks/useNotifications';
export { useRealtimeNotifications } from './hooks/useRealtimeNotifications';

export { useAccount } from './hooks/useAccount';
export { useSession } from './hooks/useSession';
export { useGoogle } from './hooks/useGoogle';

// Type exports (with new workflow types)
export * from './types';

// Version export
export const version = '1.0.0';
