import { create } from 'zustand';
import { Account, AccountType, OAuthProviders, AccountSessionInfo } from '../types';

// Pure runtime state - no persistence needed
interface AccountState {
    // Session info from backend (includes accountIds and currentAccountId)
    session: AccountSessionInfo | null;

    // Runtime account data (fetched based on session accountIds)
    accountsData: Map<string, Account>;

    // Loading states
    isLoading: boolean;
    isAuthenticating: boolean;

    // Error state
    error: string | null;

    // OAuth state (temporary, no persistence needed)
    oauthState: {
        isInProgress: boolean;
        provider: OAuthProviders | null;
        redirectUrl: string | null;
        tempToken: string | null;
    };
}

interface AccountActions {
    // Session management
    setSession: (session: AccountSessionInfo) => void;
    clearSession: () => void;

    // Account data management
    setAccountData: (accountId: string, account: Account) => void;
    updateAccountData: (accountId: string, updates: Partial<Account>) => void;
    removeAccountData: (accountId: string) => void;
    clearAllAccountData: () => void;

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
    getCurrentAccountId: () => string | null;
    getCurrentAccount: () => Account | null;
    getAccounts: () => Account[];
    getAccountById: (accountId: string) => Account | null;
    getAccountsByType: (type: AccountType) => Account[];

    // Utilities
    hasSession: () => boolean;
    hasValidSession: () => boolean;
    hasAccounts: () => boolean;
    isAuthenticated: () => boolean;
    hasAccountData: (accountId: string) => boolean;
    needsAccountData: (accountId: string) => boolean;
    getMissingAccountIds: () => string[];
}

type AccountStore = AccountState & AccountActions;

export const useAccountStore = create<AccountStore>()((set, get) => ({
    // Initial state - everything starts empty
    session: null,
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

    // Session management
    setSession: (session) => set({ session }),

    clearSession: () => set({ 
        session: null,
        accountsData: new Map(),
        error: null
    }),

    // Account data management
    setAccountData: (accountId, account) => set((state) => {
        const newAccountsData = new Map(state.accountsData);
        newAccountsData.set(accountId, account);
        return { accountsData: newAccountsData };
    }),

    updateAccountData: (accountId, updates) => set((state) => {
        const newAccountsData = new Map(state.accountsData);
        const existingAccount = newAccountsData.get(accountId);

        if (existingAccount) {
            newAccountsData.set(accountId, { ...existingAccount, ...updates });
        }

        return { accountsData: newAccountsData };
    }),

    removeAccountData: (accountId) => set((state) => {
        const newAccountsData = new Map(state.accountsData);
        newAccountsData.delete(accountId);
        return { accountsData: newAccountsData };
    }),

    clearAllAccountData: () => set({
        accountsData: new Map(),
        error: null
    }),

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
    getAccountIds: () => {
        const state = get();
        return state.session?.accountIds || [];
    },

    getCurrentAccountId: () => {
        const state = get();
        return state.session?.currentAccountId || null;
    },

    getCurrentAccount: () => {
        const state = get();
        const currentAccountId = state.getCurrentAccountId();
        return currentAccountId ? state.accountsData.get(currentAccountId) || null : null;
    },

    getAccounts: () => {
        const state = get();
        const accountIds = state.getAccountIds();
        return accountIds
            .map(id => state.accountsData.get(id))
            .filter((account): account is Account => account !== undefined);
    },

    getAccountById: (accountId) => {
        return get().accountsData.get(accountId) || null;
    },

    getAccountsByType: (type) => {
        const state = get();
        return state.getAccounts().filter(account => account.accountType === type);
    },

    // Utilities
    hasSession: () => {
        const state = get();
        return state.session?.hasSession || false;
    },

    hasValidSession: () => {
        const state = get();
        return state.session?.hasSession && state.session?.isValid || false;
    },

    hasAccounts: () => {
        const state = get();
        return state.getAccountIds().length > 0;
    },

    isAuthenticated: () => {
        const state = get();
        return state.hasValidSession() && state.hasAccounts();
    },

    hasAccountData: (accountId) => {
        return get().accountsData.has(accountId);
    },

    needsAccountData: (accountId) => {
        const state = get();
        const accountIds = state.getAccountIds();
        return accountIds.includes(accountId) && !state.accountsData.has(accountId);
    },

    getMissingAccountIds: () => {
        const state = get();
        const accountIds = state.getAccountIds();
        return accountIds.filter(id => !state.accountsData.has(id));
    }
}));

// Simplified selector hooks
export const useCurrentAccount = () => useAccountStore(state => state.getCurrentAccount());
export const useAccounts = () => useAccountStore(state => state.getAccounts());

export const useAuthState = () => useAccountStore(state => ({
    isLoading: state.isLoading,
    isAuthenticating: state.isAuthenticating,
    error: state.error,
    isAuthenticated: state.isAuthenticated(),
    hasAccounts: state.hasAccounts(),
    hasValidSession: state.hasValidSession()
}));

export const useOAuthState = () => useAccountStore(state => state.oauthState);

// Session-related hooks
export const useAccountSession = () => useAccountStore(state => state.session);

// Account data management hooks
export const useAccountDataStatus = (accountId?: string) => useAccountStore(state => {
    if (!accountId) return { hasData: false, needsData: false };

    return {
        hasData: state.hasAccountData(accountId),
        needsData: state.needsAccountData(accountId)
    };
});

export const useAccountIds = () => useAccountStore(state => state.getAccountIds());
export const useMissingAccountIds = () => useAccountStore(state => state.getMissingAccountIds());