'use client';

// Services
export { AccountService } from './services/AccountService';
export { AuthService } from './services/AuthService';
export { HttpClient } from './client/HttpClient';

// Context and Provider
export { ServicesProvider, useAccountService, useAuthService, useHttpClient } from './context/ServicesProvider';

// Components
export { AuthGuard } from './components/AuthGuard';

// NEW HOOKS - Main authentication hooks
export { useSession } from './hooks/useSession';
export { useLocalSignin } from './hooks/useLocalSignin';
export { useOAuthSignin } from './hooks/useOAuthSignin';
export { useLocalSignup } from './hooks/useLocalSignup';
export { useOAuthSignup } from './hooks/useOAuthSignup';
export { usePasswordReset } from './hooks/usePasswordReset';

// Store exports
export { useAppStore } from './store/useAppStore';

// Type exports
export * from './types';

// Utilities
export * from './utils';

// Version export
export const version = '1.0.0';
