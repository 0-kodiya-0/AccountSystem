import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Account, AccountType, OAuthProviders } from '../types';

interface AccountState {
    // Current accounts
    accounts: Account[];
    currentAccountId: string | null;
    
    // Loading states
    isLoading: boolean;
    isAuthenticating: boolean;
    
    // Error state
    error: string | null;
    
    // OAuth state
    oauthState: {
        isInProgress: boolean;
        provider: OAuthProviders | null;
        redirectUrl: string | null;
        tempToken: string | null; // For 2FA flows
    };
}

interface AccountActions {
    // Account management
    setAccounts: (accounts: Account[]) => void;
    addAccount: (account: Account) => void;
    updateAccount: (accountId: string, updates: Partial<Account>) => void;
    removeAccount: (accountId: string) => void;
    clearAccounts: () => void;
    
    // Current account
    setCurrentAccount: (accountId: string | null) => void;
    getCurrentAccount: () => Account | null;
    
    // Loading states
    setLoading: (loading: boolean) => void;
    setAuthenticating: (authenticating: boolean) => void;
    
    // Error handling
    setError: (error: string | null) => void;
    clearError: () => void;
    
    // OAuth state management
    setOAuthInProgress: (provider: OAuthProviders, redirectUrl?: string) => void;
    setOAuthTempToken: (tempToken: string) => void;
    clearOAuthState: () => void;
    
    // Utilities
    hasAccounts: () => boolean;
    isAuthenticated: () => boolean;
    getAccountById: (accountId: string) => Account | null;
    getAccountsByType: (type: AccountType) => Account[];
    getPreferredAccount: () => Account | null;
}

type AccountStore = AccountState & AccountActions;

export const useAccountStore = create<AccountStore>()(
    persist(
        (set, get) => ({
            // Initial state
            accounts: [],
            currentAccountId: null,
            isLoading: false,
            isAuthenticating: false,
            error: null,
            oauthState: {
                isInProgress: false,
                provider: null,
                redirectUrl: null,
                tempToken: null,
            },

            // Account management
            setAccounts: (accounts) => set({ accounts }),
            
            addAccount: (account) => set((state) => {
                const existingIndex = state.accounts.findIndex(a => a.id === account.id);
                if (existingIndex >= 0) {
                    // Update existing account
                    const updatedAccounts = [...state.accounts];
                    updatedAccounts[existingIndex] = account;
                    return { accounts: updatedAccounts };
                } else {
                    // Add new account
                    return { accounts: [...state.accounts, account] };
                }
            }),
            
            updateAccount: (accountId, updates) => set((state) => ({
                accounts: state.accounts.map(account =>
                    account.id === accountId ? { ...account, ...updates } : account
                )
            })),
            
            removeAccount: (accountId) => set((state) => {
                const newAccounts = state.accounts.filter(a => a.id !== accountId);
                const newCurrentAccountId = state.currentAccountId === accountId 
                    ? (newAccounts.length > 0 ? newAccounts[0].id : null)
                    : state.currentAccountId;
                    
                return {
                    accounts: newAccounts,
                    currentAccountId: newCurrentAccountId
                };
            }),
            
            clearAccounts: () => set({
                accounts: [],
                currentAccountId: null,
                error: null
            }),

            // Current account
            setCurrentAccount: (accountId) => set({ currentAccountId: accountId }),
            
            getCurrentAccount: () => {
                const state = get();
                return state.currentAccountId 
                    ? state.accounts.find(a => a.id === state.currentAccountId) || null
                    : null;
            },

            // Loading states
            setLoading: (loading) => set({ isLoading: loading }),
            setAuthenticating: (authenticating) => set({ isAuthenticating: authenticating }),

            // Error handling
            setError: (error) => set({ error }),
            clearError: () => set({ error: null }),

            // OAuth state management
            setOAuthInProgress: (provider, redirectUrl) => set({
                oauthState: {
                    isInProgress: true,
                    provider,
                    redirectUrl: redirectUrl || null,
                    tempToken: null
                }
            }),
            
            setOAuthTempToken: (tempToken) => set((state) => ({
                oauthState: {
                    ...state.oauthState,
                    tempToken
                }
            })),
            
            clearOAuthState: () => set({
                oauthState: {
                    isInProgress: false,
                    provider: null,
                    redirectUrl: null,
                    tempToken: null
                }
            }),

            // Utilities
            hasAccounts: () => get().accounts.length > 0,
            
            isAuthenticated: () => get().accounts.length > 0,
            
            getAccountById: (accountId) => {
                return get().accounts.find(a => a.id === accountId) || null;
            },
            
            getAccountsByType: (type) => {
                return get().accounts.filter(a => a.accountType === type);
            },
            
            getPreferredAccount: () => {
                const state = get();
                
                // Return current account if set
                if (state.currentAccountId) {
                    const current = state.accounts.find(a => a.id === state.currentAccountId);
                    if (current) return current;
                }
                
                // Return first account if available
                return state.accounts.length > 0 ? state.accounts[0] : null;
            }
        }),
        {
            name: 'accountsystem-auth-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                // Only persist essential data
                accounts: state.accounts,
                currentAccountId: state.currentAccountId
                // Don't persist loading states, errors, or OAuth state
            }),
            version: 1,
            migrate: (persistedState: any, version: number) => {
                // Handle migrations if needed in the future
                if (version === 0) {
                    // Migration from version 0 to 1
                    return {
                        ...persistedState,
                        currentAccountId: null
                    };
                }
                return persistedState;
            }
        }
    )
);

// Selector hooks for specific data
export const useCurrentAccount = () => useAccountStore(state => state.getCurrentAccount());
export const useAccounts = () => useAccountStore(state => state.accounts);
export const useAuthState = () => useAccountStore(state => ({
    isLoading: state.isLoading,
    isAuthenticating: state.isAuthenticating,
    error: state.error,
    isAuthenticated: state.isAuthenticated()
}));
export const useOAuthState = () => useAccountStore(state => state.oauthState);