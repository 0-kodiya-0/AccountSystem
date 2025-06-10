import { create } from 'zustand';
import { Account, AccountType, AccountSessionInfo } from '../types';

// Extended Account type to track if data is from session (minimal) or full fetch
interface StoredAccount extends Partial<Account> {
    id: string; // Always required
    _isSessionDataOnly?: boolean; // Flag to indicate if this is minimal session data
}

// Pure runtime state - no persistence needed
interface AccountState {
    // Session info from backend (includes accountIds and currentAccountId)
    session: AccountSessionInfo | null;

    // Runtime account data (fetched based on session accountIds)
    accountsData: Map<string, StoredAccount>;

    // Temporary token for local auth 2FA (only thing we actually need)
    tempToken: string | null;
}

interface AccountActions {
    // Session management
    setSession: (session: AccountSessionInfo) => void;
    clearSession: () => void;

    // Account data management
    setAccountData: (accountId: string, account: Account) => void;
    setSessionAccountData: (accountId: string, sessionAccount: Partial<Account>) => void; // NEW
    updateAccountData: (accountId: string, updates: Partial<Account>) => void;
    removeAccountData: (accountId: string) => void;
    clearAllAccountData: () => void;

    // Temp token management (for local auth 2FA only)
    setTempToken: (tempToken: string) => void;
    clearTempToken: () => void;

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
    hasFullAccountData: (accountId: string) => boolean; // NEW
    needsAccountData: (accountId: string) => boolean;
    needsFullAccountData: (accountId: string) => boolean; // NEW
    getMissingAccountIds: () => string[];
    getMissingFullAccountIds: () => string[]; // NEW
}

type AccountStore = AccountState & AccountActions;

export const useAccountStore = create<AccountStore>()((set, get) => ({
    // Initial state - everything starts empty
    session: null,
    accountsData: new Map<string, StoredAccount>(),
    isLoading: false,
    isAuthenticating: false,
    error: null,
    tempToken: null,

    // Session management
    setSession: (session) => set({ session }),

    clearSession: () => set({ 
        session: null,
        accountsData: new Map()
    }),

    // Account data management
    setAccountData: (accountId, account) => set((state) => {
        const newAccountsData = new Map(state.accountsData);
        // Full account data - remove session data flag
        const fullAccount: StoredAccount = { ...account };
        delete fullAccount._isSessionDataOnly;
        newAccountsData.set(accountId, fullAccount);
        return { accountsData: newAccountsData };
    }),

    // NEW: Set minimal session account data
    setSessionAccountData: (accountId, partialAccount) => set((state) => {
        const newAccountsData = new Map(state.accountsData);
        // Only set if we don't already have full account data
        const existing = newAccountsData.get(accountId);
        if (!existing || existing._isSessionDataOnly) {
            const sessionStoredAccount: StoredAccount = {
                ...partialAccount,
                id: accountId, // Ensure id is always present
                _isSessionDataOnly: true
            };
            newAccountsData.set(accountId, sessionStoredAccount);
        }
        return { accountsData: newAccountsData };
    }),

    updateAccountData: (accountId, updates) => set((state) => {
        const newAccountsData = new Map(state.accountsData);
        const existingAccount = newAccountsData.get(accountId);

        if (existingAccount) {
            const updatedAccount: StoredAccount = { ...existingAccount, ...updates };
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

    // Temp token management (for local auth 2FA only)
    setTempToken: (tempToken) => set({ tempToken }),
    clearTempToken: () => set({ tempToken: null }),

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
        const account = currentAccountId ? state.accountsData.get(currentAccountId) : null;
        return account ? (account as Account) : null; // Cast to Account for external use
    },

    getAccounts: () => {
        const state = get();
        const accountIds = state.getAccountIds();
        return accountIds
            .map(id => state.accountsData.get(id))
            .filter((account): account is StoredAccount => account !== undefined)
            .map(account => account as Account); // Cast to Account for external use
    },

    getAccountById: (accountId) => {
        const account = get().accountsData.get(accountId);
        return account ? (account as Account) : null; // Cast to Account for external use
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

    // NEW: Check if we have full account data (not just session data)
    hasFullAccountData: (accountId) => {
        const account = get().accountsData.get(accountId);
        return Boolean(account && !account._isSessionDataOnly);
    },

    needsAccountData: (accountId) => {
        const state = get();
        const accountIds = state.getAccountIds();
        return accountIds.includes(accountId) && !state.accountsData.has(accountId);
    },

    // NEW: Check if we need full account data (we have session data but need full data)
    needsFullAccountData: (accountId) => {
        const state = get();
        const accountIds = state.getAccountIds();
        const account = state.accountsData.get(accountId);
        return Boolean(accountIds.includes(accountId) && (!account || account._isSessionDataOnly));
    },

    getMissingAccountIds: () => {
        const state = get();
        const accountIds = state.getAccountIds();
        return accountIds.filter(id => !state.accountsData.has(id));
    },

    // NEW: Get account IDs that need full data fetch
    getMissingFullAccountIds: () => {
        const state = get();
        const accountIds = state.getAccountIds();
        return accountIds.filter(id => {
            const account = state.accountsData.get(id);
            return !account || account._isSessionDataOnly;
        });
    }
}));

// Simplified selector hooks - these now return session data if that's all we have
export const useCurrentAccount = () => useAccountStore(state => state.getCurrentAccount());
export const useAccounts = () => useAccountStore(state => state.getAccounts());

export const useAuthState = () => useAccountStore(state => ({
    isAuthenticated: state.isAuthenticated(),
    hasAccounts: state.hasAccounts(),
    hasValidSession: state.hasValidSession()
}));

export const useAuthFlowState = () => useAccountStore(state => ({ tempToken: state.tempToken })); // Only temp token now

// Session-related hooks
export const useAccountSession = () => useAccountStore(state => state.session);

// Account data management hooks - updated to differentiate between session and full data
export const useAccountDataStatus = (accountId?: string) => useAccountStore(state => {
    if (!accountId) return { hasData: false, hasFullData: false, needsData: false, needsFullData: false };

    return {
        hasData: state.hasAccountData(accountId),
        hasFullData: state.hasFullAccountData(accountId),
        needsData: state.needsAccountData(accountId),
        needsFullData: state.needsFullAccountData(accountId)
    };
});

export const useAccountIds = () => useAccountStore(state => state.getAccountIds());
export const useMissingAccountIds = () => useAccountStore(state => state.getMissingAccountIds());
export const useMissingFullAccountIds = () => useAccountStore(state => state.getMissingFullAccountIds()); // NEW