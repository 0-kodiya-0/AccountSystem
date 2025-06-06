import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Account, AccountType, OAuthProviders } from '../types';

// Only persist essential identifiers
interface PersistedAccountState {
    accountIds: string[];
    currentAccountId: string | null;
    disabledAccountIds: string[];
}

// Full state includes runtime data
interface AccountState extends PersistedAccountState {
    // Runtime account data (not persisted)
    accountsData: Map<string, Account>;

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
        tempToken: string | null;
    };
}

interface AccountActions {
    // Account management
    addAccount: (account: Account) => void;
    updateAccount: (accountId: string, updates: Partial<Account>) => void;
    removeAccount: (accountId: string) => void;
    clearAccounts: () => void;
    setAccountData: (accountId: string, account: Account) => void;

    // Account state management
    disableAccount: (accountId: string) => void;
    enableAccount: (accountId: string) => void;
    isAccountDisabled: (accountId: string) => boolean;

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

    // Getters
    getAccountIds: () => string[];
    getActiveAccountIds: () => string[];
    getDisabledAccountIds: () => string[];
    getAccounts: () => Account[];
    getActiveAccounts: () => Account[];
    getDisabledAccounts: () => Account[];
    getAccountById: (accountId: string) => Account | null;
    getAccountsByType: (type: AccountType) => Account[];

    // Utilities
    hasAccounts: () => boolean;
    hasActiveAccounts: () => boolean;
    hasDisabledAccounts: () => boolean;
    isAuthenticated: () => boolean;
    hasAccountData: (accountId: string) => boolean;
    needsAccountData: (accountId: string) => boolean;
}

type AccountStore = AccountState & AccountActions;

export const useAccountStore = create<AccountStore>()(
    persist(
        (set, get) => ({
            // Initial state
            accountIds: [],
            currentAccountId: null,
            disabledAccountIds: [],

            // Runtime data (not persisted)
            accountsData: new Map<string, Account>(),
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
            addAccount: (account) => set((state) => {
                const newAccountsData = new Map(state.accountsData);
                newAccountsData.set(account.id, account);

                const newAccountIds = state.accountIds.includes(account.id)
                    ? state.accountIds
                    : [...state.accountIds, account.id];

                const newDisabledAccountIds = state.disabledAccountIds.filter(id => id !== account.id);

                return {
                    accountIds: newAccountIds,
                    disabledAccountIds: newDisabledAccountIds,
                    accountsData: newAccountsData
                };
            }),

            updateAccount: (accountId, updates) => set((state) => {
                const newAccountsData = new Map(state.accountsData);
                const existingAccount = newAccountsData.get(accountId);

                if (existingAccount) {
                    newAccountsData.set(accountId, { ...existingAccount, ...updates });
                }

                return { accountsData: newAccountsData };
            }),

            removeAccount: (accountId) => set((state) => {
                const newAccountsData = new Map(state.accountsData);
                newAccountsData.delete(accountId);

                const newAccountIds = state.accountIds.filter(id => id !== accountId);
                const newDisabledAccountIds = state.disabledAccountIds.filter(id => id !== accountId);

                // If removing current account, switch to next active account
                const activeAccountIds = newAccountIds.filter(id => !newDisabledAccountIds.includes(id));
                const newCurrentAccountId = state.currentAccountId === accountId
                    ? (activeAccountIds.length > 0 ? activeAccountIds[0] : null)
                    : state.currentAccountId;

                return {
                    accountIds: newAccountIds,
                    disabledAccountIds: newDisabledAccountIds,
                    currentAccountId: newCurrentAccountId,
                    accountsData: newAccountsData
                };
            }),

            clearAccounts: () => set({
                accountIds: [],
                currentAccountId: null,
                disabledAccountIds: [],
                accountsData: new Map(),
                error: null
            }),

            setAccountData: (accountId, account) => set((state) => {
                const newAccountsData = new Map(state.accountsData);
                newAccountsData.set(accountId, account);
                return { accountsData: newAccountsData };
            }),

            // Account state management
            disableAccount: (accountId) => set((state) => {
                if (!state.accountIds.includes(accountId)) return state;

                const newDisabledAccountIds = state.disabledAccountIds.includes(accountId)
                    ? state.disabledAccountIds
                    : [...state.disabledAccountIds, accountId];

                // If disabling current account, switch to next active account
                const activeAccountIds = state.accountIds.filter(id => !newDisabledAccountIds.includes(id));
                const newCurrentAccountId = state.currentAccountId === accountId
                    ? (activeAccountIds.length > 0 ? activeAccountIds[0] : null)
                    : state.currentAccountId;

                return {
                    disabledAccountIds: newDisabledAccountIds,
                    currentAccountId: newCurrentAccountId
                };
            }),

            enableAccount: (accountId) => set((state) => ({
                disabledAccountIds: state.disabledAccountIds.filter(id => id !== accountId)
            })),

            isAccountDisabled: (accountId) => {
                return get().disabledAccountIds.includes(accountId);
            },

            // Current account
            setCurrentAccount: (accountId) => set({ currentAccountId: accountId }),

            getCurrentAccount: () => {
                const state = get();
                if (!state.currentAccountId) return null;

                // Return null if account is disabled
                if (state.disabledAccountIds.includes(state.currentAccountId)) {
                    return null;
                }

                return state.accountsData.get(state.currentAccountId) || null;
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

            // Getters
            getAccountIds: () => get().accountIds,

            getActiveAccountIds: () => {
                const state = get();
                return state.accountIds.filter(id => !state.disabledAccountIds.includes(id));
            },

            getDisabledAccountIds: () => get().disabledAccountIds,

            getAccounts: () => {
                const state = get();
                return state.accountIds
                    .map(id => state.accountsData.get(id))
                    .filter((account): account is Account => account !== undefined);
            },

            getActiveAccounts: () => {
                const state = get();
                return state.getActiveAccountIds()
                    .map(id => state.accountsData.get(id))
                    .filter((account): account is Account => account !== undefined);
            },

            getDisabledAccounts: () => {
                const state = get();
                return state.disabledAccountIds
                    .map(id => state.accountsData.get(id))
                    .filter((account): account is Account => account !== undefined);
            },

            getAccountById: (accountId) => {
                return get().accountsData.get(accountId) || null;
            },

            getAccountsByType: (type) => {
                const state = get();
                return state.getActiveAccounts().filter(account => account.accountType === type);
            },

            // Utilities
            hasAccounts: () => get().accountIds.length > 0,

            hasActiveAccounts: () => get().getActiveAccountIds().length > 0,

            hasDisabledAccounts: () => get().getDisabledAccountIds().length > 0,

            isAuthenticated: () => get().hasActiveAccounts(),

            hasAccountData: (accountId) => get().accountsData.has(accountId),

            needsAccountData: (accountId) => {
                const state = get();
                return state.accountIds.includes(accountId) && !state.accountsData.has(accountId);
            }
        }),
        {
            name: 'account-system-auth-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                // Only persist essential identifiers
                accountIds: state.accountIds,
                currentAccountId: state.currentAccountId,
                disabledAccountIds: state.disabledAccountIds
                // accountsData is NOT persisted - it's runtime only
            }),
            version: 1, // Increment version for migration
        }
    )
);

// Enhanced selector hooks that handle data fetching
export const useCurrentAccount = () => useAccountStore(state => state.getCurrentAccount());
export const useAccounts = () => useAccountStore(state => state.getActiveAccounts());
export const useAllAccounts = () => useAccountStore(state => state.getAccounts());
export const useDisabledAccounts = () => useAccountStore(state => state.getDisabledAccounts());

export const useAuthState = () => useAccountStore(state => ({
    isLoading: state.isLoading,
    isAuthenticating: state.isAuthenticating,
    error: state.error,
    isAuthenticated: state.isAuthenticated(),
    hasActiveAccounts: state.hasActiveAccounts()
}));

export const useOAuthState = () => useAccountStore(state => state.oauthState);

// New hooks for account data management
export const useAccountDataStatus = (accountId?: string) => useAccountStore(state => {
    if (!accountId) return { hasData: false, needsData: false };

    return {
        hasData: state.hasAccountData(accountId),
        needsData: state.needsAccountData(accountId)
    };
});

export const useAccountIds = () => useAccountStore(state => ({
    all: state.getAccountIds(),
    active: state.getActiveAccountIds(),
    disabled: state.getDisabledAccountIds()
}));