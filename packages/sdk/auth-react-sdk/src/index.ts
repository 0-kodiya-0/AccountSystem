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
export { useSignin } from './hooks/useSignin';
export { useSignup } from './hooks/useSignup';
export { useEmailVerification } from './hooks/useEmailVerification';
export { useTwoFactorVerification } from './hooks/useTwoFactorVerification';
export { useAuthCallback } from './hooks/useAuthCallback';

// Store exports
export { useAppStore } from './store/useAppStore';

// Type exports
export * from './types';

// Utilities
export * from './utils';

// Version export
export const version = '1.0.0';
