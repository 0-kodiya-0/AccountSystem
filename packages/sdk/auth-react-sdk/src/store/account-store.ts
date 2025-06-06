import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Account, AccountType, OAuthProviders } from '../types';

interface AccountState {
    // Current accounts
    accounts: Account[];
    currentAccountId: string | null;
    
    // Disabled accounts (logged out but kept for manual removal)
    disabledAccountIds: Set<string>;

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

    // Account state management
    disableAccount: (accountId: string) => void;
    enableAccount: (accountId: string) => void;
    isAccountDisabled: (accountId: string) => boolean;
    getActiveAccounts: () => Account[];
    getDisabledAccounts: () => Account[];

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
    hasActiveAccounts: () => boolean;
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
            disabledAccountIds: new Set<string>(),
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
                const newDisabledIds = new Set(state.disabledAccountIds);
                
                // Re-enable account if it was disabled
                newDisabledIds.delete(account.id);
                
                if (existingIndex >= 0) {
                    // Update existing account
                    const updatedAccounts = [...state.accounts];
                    updatedAccounts[existingIndex] = account;
                    return { 
                        accounts: updatedAccounts,
                        disabledAccountIds: newDisabledIds
                    };
                } else {
                    // Add new account
                    return { 
                        accounts: [...state.accounts, account],
                        disabledAccountIds: newDisabledIds
                    };
                }
            }),

            updateAccount: (accountId, updates) => set((state) => ({
                accounts: state.accounts.map(account =>
                    account.id === accountId ? { ...account, ...updates } : account
                )
            })),

            removeAccount: (accountId) => set((state) => {
                const newAccounts = state.accounts.filter(a => a.id !== accountId);
                const newDisabledIds = new Set(state.disabledAccountIds);
                newDisabledIds.delete(accountId);
                
                // If removing current account, switch to next active account
                const activeAccounts = newAccounts.filter(a => !newDisabledIds.has(a.id));
                const newCurrentAccountId = state.currentAccountId === accountId
                    ? (activeAccounts.length > 0 ? activeAccounts[0].id : null)
                    : state.currentAccountId;

                return {
                    accounts: newAccounts,
                    currentAccountId: newCurrentAccountId,
                    disabledAccountIds: newDisabledIds
                };
            }),

            clearAccounts: () => set({
                accounts: [],
                currentAccountId: null,
                disabledAccountIds: new Set<string>(),
                error: null
            }),

            // Account state management
            disableAccount: (accountId) => set((state) => {
                const newDisabledIds = new Set(state.disabledAccountIds);
                newDisabledIds.add(accountId);
                
                // If disabling current account, switch to next active account
                const activeAccounts = state.accounts.filter(a => a.id !== accountId && !newDisabledIds.has(a.id));
                const newCurrentAccountId = state.currentAccountId === accountId
                    ? (activeAccounts.length > 0 ? activeAccounts[0].id : null)
                    : state.currentAccountId;

                return {
                    disabledAccountIds: newDisabledIds,
                    currentAccountId: newCurrentAccountId
                };
            }),

            enableAccount: (accountId) => set((state) => {
                const newDisabledIds = new Set(state.disabledAccountIds);
                newDisabledIds.delete(accountId);
                return { disabledAccountIds: newDisabledIds };
            }),

            isAccountDisabled: (accountId) => {
                return get().disabledAccountIds.has(accountId);
            },

            getActiveAccounts: () => {
                const state = get();
                return state.accounts.filter(a => !state.disabledAccountIds.has(a.id));
            },

            getDisabledAccounts: () => {
                const state = get();
                return state.accounts.filter(a => state.disabledAccountIds.has(a.id));
            },

            // Current account
            setCurrentAccount: (accountId) => set({ currentAccountId: accountId }),

            getCurrentAccount: () => {
                const state = get();
                if (!state.currentAccountId) return null;
                
                const account = state.accounts.find(a => a.id === state.currentAccountId);
                // Return null if account is disabled
                if (account && state.disabledAccountIds.has(account.id)) {
                    return null;
                }
                return account || null;
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

            hasActiveAccounts: () => get().getActiveAccounts().length > 0,

            isAuthenticated: () => get().getActiveAccounts().length > 0,

            getAccountById: (accountId) => {
                return get().accounts.find(a => a.id === accountId) || null;
            },

            getAccountsByType: (type) => {
                const state = get();
                return state.accounts.filter(a => 
                    a.accountType === type && !state.disabledAccountIds.has(a.id)
                );
            },

            getPreferredAccount: () => {
                const state = get();

                // Return current account if set and active
                if (state.currentAccountId) {
                    const current = state.accounts.find(a => a.id === state.currentAccountId);
                    if (current && !state.disabledAccountIds.has(current.id)) {
                        return current;
                    }
                }

                // Return first active account if available
                const activeAccounts = state.getActiveAccounts();
                return activeAccounts.length > 0 ? activeAccounts[0] : null;
            }
        }),
        {
            name: 'account-system-auth-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                // Persist essential data including disabled account IDs
                accounts: state.accounts,
                currentAccountId: state.currentAccountId,
                disabledAccountIds: Array.from(state.disabledAccountIds) // Convert Set to Array for serialization
            }),
            version: 2, // Increment version for migration
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            migrate: (persistedState: any, version: number) => {
                if (version === 0 || version === 1) {
                    // Migration from version 0/1 to 2 - add disabledAccountIds
                    return {
                        ...persistedState,
                        disabledAccountIds: new Set() // Initialize as empty Set
                    };
                }
                
                // Convert disabledAccountIds from Array back to Set
                if (persistedState && Array.isArray(persistedState.disabledAccountIds)) {
                    persistedState.disabledAccountIds = new Set(persistedState.disabledAccountIds);
                }
                
                return persistedState;
            }
        }
    )
);

// Selector hooks for specific data
export const useCurrentAccount = () => useAccountStore(state => state.getCurrentAccount());
export const useAccounts = () => useAccountStore(state => state.getActiveAccounts()); // Only return active accounts by default
export const useAllAccounts = () => useAccountStore(state => state.accounts); // Return all accounts including disabled
export const useDisabledAccounts = () => useAccountStore(state => state.getDisabledAccounts());

export const useAuthState = () => useAccountStore(state => ({
    isLoading: state.isLoading,
    isAuthenticating: state.isAuthenticating,
    error: state.error,
    isAuthenticated: state.isAuthenticated(),
    hasActiveAccounts: state.hasActiveAccounts()
}));

export const useOAuthState = () => useAccountStore(state => state.oauthState);