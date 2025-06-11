import { create } from 'zustand';
import { AccountSessionInfo, Account, LoadingInfo } from '../types';

interface AuthState {
    // Session State
    session: AccountSessionInfo | null;
    
    // Account State
    accountsData: Map<string, Account>;
    
    // Loading States
    loadingStates: Map<string, LoadingInfo>;
    
    // Auth Flow State
    tempToken: string | null;
    
    // Error States
    errors: Map<string, string>;
}

interface AuthActions {
    // Session Management
    setSession: (session: AccountSessionInfo) => void;
    clearSession: () => void;
    
    // Account Data Management
    setAccountData: (accountId: string, account: Account) => void;
    setSessionAccountData: (accountId: string, sessionAccount: Partial<Account>) => void;
    updateAccountData: (accountId: string, updates: Partial<Account>) => void;
    removeAccountData: (accountId: string) => void;
    clearAllAccountData: () => void;
    
    // Loading State Management
    setLoadingState: (key: string, loadingInfo: LoadingInfo) => void;
    clearLoadingState: (key: string) => void;
    
    // Error Management
    setError: (key: string, error: string) => void;
    clearError: (key: string) => void;
    clearAllErrors: () => void;
    
    // Temp Token Management
    setTempToken: (token: string) => void;
    clearTempToken: () => void;
    
    // Computed Getters
    getAccountIds: () => string[];
    getCurrentAccountId: () => string | null;
    getCurrentAccount: () => Account | null;
    getAccounts: () => Account[];
    getAccountById: (accountId: string) => Account | null;
    hasValidSession: () => boolean;
    isAuthenticated: () => boolean;
    hasAccountData: (accountId: string) => boolean;
    hasFullAccountData: (accountId: string) => boolean;
    needsAccountData: (accountId: string) => boolean;
    getLoadingState: (key: string) => LoadingInfo | null;
    getError: (key: string) => string | null;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()((set, get) => ({
    // Initial State
    session: null,
    accountsData: new Map(),
    loadingStates: new Map(),
    tempToken: null,
    errors: new Map(),

    // Session Management
    setSession: (session) => set({ session }),
    clearSession: () => set({ 
        session: null,
        accountsData: new Map(),
        tempToken: null
    }),

    // Account Data Management
    setAccountData: (accountId, account) => set((state) => {
        const newAccountsData = new Map(state.accountsData);
        newAccountsData.set(accountId, account);
        return { accountsData: newAccountsData };
    }),

    setSessionAccountData: (accountId, partialAccount) => set((state) => {
        const newAccountsData = new Map(state.accountsData);
        const existing = newAccountsData.get(accountId);
        
        // Only set if we don't already have full account data
        if (!existing || (existing as any)._isSessionDataOnly) {
            const sessionAccount = {
                ...partialAccount,
                id: accountId,
                _isSessionDataOnly: true
            };
            newAccountsData.set(accountId, sessionAccount as Account);
        }
        return { accountsData: newAccountsData };
    }),

    updateAccountData: (accountId, updates) => set((state) => {
        const newAccountsData = new Map(state.accountsData);
        const existingAccount = newAccountsData.get(accountId);

        if (existingAccount) {
            const updatedAccount = { ...existingAccount, ...updates };
            newAccountsData.set(accountId, updatedAccount);
        }

        return { accountsData: newAccountsData };
    }),

    removeAccountData: (accountId) => set((state) => {
        const newAccountsData = new Map(state.accountsData);
        newAccountsData.delete(accountId);
        return { accountsData: newAccountsData };
    }),

    clearAllAccountData: () => set({
        accountsData: new Map()
    }),

    // Loading State Management
    setLoadingState: (key, loadingInfo) => set((state) => {
        const newLoadingStates = new Map(state.loadingStates);
        newLoadingStates.set(key, loadingInfo);
        return { loadingStates: newLoadingStates };
    }),

    clearLoadingState: (key) => set((state) => {
        const newLoadingStates = new Map(state.loadingStates);
        newLoadingStates.delete(key);
        return { loadingStates: newLoadingStates };
    }),

    // Error Management
    setError: (key, error) => set((state) => {
        const newErrors = new Map(state.errors);
        newErrors.set(key, error);
        return { errors: newErrors };
    }),

    clearError: (key) => set((state) => {
        const newErrors = new Map(state.errors);
        newErrors.delete(key);
        return { errors: newErrors };
    }),

    clearAllErrors: () => set({
        errors: new Map()
    }),

    // Temp Token Management
    setTempToken: (tempToken) => set({ tempToken }),
    clearTempToken: () => set({ tempToken: null }),

    // Computed Getters
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
        const state = get();
        return state.accountsData.get(accountId) || null;
    },

    hasValidSession: () => {
        const state = get();
        return Boolean(state.session?.hasSession && state.session?.isValid);
    },

    isAuthenticated: () => {
        const state = get();
        return state.hasValidSession() && state.getAccountIds().length > 0;
    },

    hasAccountData: (accountId) => {
        const state = get();
        return state.accountsData.has(accountId);
    },

    hasFullAccountData: (accountId) => {
        const state = get();
        const account = state.accountsData.get(accountId);
        return Boolean(account && !(account as any)._isSessionDataOnly);
    },

    needsAccountData: (accountId) => {
        const state = get();
        const accountIds = state.getAccountIds();
        return accountIds.includes(accountId) && !state.accountsData.has(accountId);
    },

    getLoadingState: (key) => {
        const state = get();
        return state.loadingStates.get(key) || null;
    },

    getError: (key) => {
        const state = get();
        return state.errors.get(key) || null;
    }
}));