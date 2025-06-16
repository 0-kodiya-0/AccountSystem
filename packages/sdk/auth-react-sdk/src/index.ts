'use client';

export { AccountService } from './services/AccountService';
export { AuthService } from './services/AuthService';

// Main exports
export { HttpClient } from './client/HttpClient';

// Context and Provider
export { AuthProvider } from './context/AuthProvider';
export { ServicesProvider, useAccountService, useAuthService, useHttpClient } from './context/ServicesProvider';

// Components
export { AuthGuard } from './components/AuthGuard';

// Routing and Protection Hooks
export { useAuthCallbackHandler } from './hooks/useAuthCallbackHandler';

// Store exports
export * as useAppStore from './store/useAppStore';

export { useAccount } from './hooks/useAccount';
export { useGoogle } from './hooks/useGoogle';

// Type exports (with new workflow types)
export * from './types';

export * from './utils';

// Version export
export const version = '1.0.0';
