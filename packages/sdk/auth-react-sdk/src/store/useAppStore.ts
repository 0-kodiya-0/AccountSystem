import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { Account, AccountSessionInfo } from '../types';
import { enableMapSet } from 'immer';

enableMapSet();

// Session state structure
interface SessionState {
  data: AccountSessionInfo | null;
  loading: boolean;
  error: string | null;
  lastLoaded: number | null;
}

// Account state structure
interface AccountState {
  data: Account | null;
  loading: boolean;
  error: string | null;
  lastLoaded: number | null;
  currentOperation: string | null; // Track which operation is running
}

// Main store state
interface AppState {
  session: SessionState;
  accounts: Record<string, AccountState>;
  tempToken: string | null;
}

// Store actions
interface AppActions {
  // Session actions
  setSessionLoading: (loading: boolean) => void;
  setSessionData: (data: AccountSessionInfo) => void;
  setSessionError: (error: string | null) => void;
  clearSession: () => void;

  // Account actions
  setAccountLoading: (accountId: string, loading: boolean, operation?: string) => void;
  setAccountData: (accountId: string, data: Account) => void;
  setAccountError: (accountId: string, error: string | null) => void;
  setAccountsData: (accounts: Account[]) => void;
  updateAccountData: (accountId: string, updates: Partial<Account>) => void;
  removeAccount: (accountId: string) => void;
  clearAccountOperation: (accountId: string) => void;

  // Temp token actions
  setTempToken: (token: string) => void;
  clearTempToken: () => void;

  // Getters
  getSessionState: () => SessionState;
  getAccountState: (accountId: string) => AccountState;
  shouldLoadAccount: (accountId: string, maxAge?: number) => boolean;
  shouldLoadSession: (maxAge?: number) => boolean;
}

// Helper functions
const createSessionState = (): SessionState => ({
  data: null,
  loading: false,
  error: null,
  lastLoaded: null,
});

const createAccountState = (): AccountState => ({
  data: null,
  loading: false,
  error: null,
  lastLoaded: null,
  currentOperation: null,
});

export const useAppStore = create<AppState & AppActions>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // Initial state
      session: createSessionState(),
      accounts: {},
      tempToken: null,

      // Session actions
      setSessionLoading: (loading: boolean) => {
        set((state) => {
          state.session.loading = loading;
          if (loading) {
            state.session.error = null;
          }
        });
      },

      setSessionData: (data: AccountSessionInfo) => {
        set((state) => {
          state.session.data = data;
          state.session.loading = false;
          state.session.error = null;
          state.session.lastLoaded = Date.now();
        });
      },

      setSessionError: (error: string | null) => {
        set((state) => {
          state.session.error = error;
          state.session.loading = false;
        });
      },

      clearSession: () => {
        set((state) => {
          state.session = createSessionState();
          state.accounts = {};
          state.tempToken = null;
        });
      },

      // Account actions
      setAccountLoading: (accountId: string, loading: boolean, operation?: string) => {
        set((state) => {
          if (!state.accounts[accountId]) {
            state.accounts[accountId] = createAccountState();
          }
          state.accounts[accountId].loading = loading;
          state.accounts[accountId].currentOperation = loading ? operation || null : null;
          if (loading) {
            state.accounts[accountId].error = null;
          }
        });
      },

      setAccountData: (accountId: string, data: Account) => {
        set((state) => {
          if (!state.accounts[accountId]) {
            state.accounts[accountId] = createAccountState();
          }
          state.accounts[accountId].data = data;
          state.accounts[accountId].loading = false;
          state.accounts[accountId].error = null;
          state.accounts[accountId].lastLoaded = Date.now();
          state.accounts[accountId].currentOperation = null;
        });
      },

      setAccountError: (accountId: string, error: string | null) => {
        set((state) => {
          if (!state.accounts[accountId]) {
            state.accounts[accountId] = createAccountState();
          }
          state.accounts[accountId].error = error;
          state.accounts[accountId].loading = false;
          state.accounts[accountId].currentOperation = null;
        });
      },

      setAccountsData: (accounts: Account[]) => {
        set((state) => {
          accounts.forEach((account) => {
            if (!state.accounts[account.id]) {
              state.accounts[account.id] = createAccountState();
            }
            state.accounts[account.id].data = account;
            state.accounts[account.id].lastLoaded = Date.now();
            state.accounts[account.id].loading = false;
            state.accounts[account.id].error = null;
          });
        });
      },

      updateAccountData: (accountId: string, updates: Partial<Account>) => {
        set((state) => {
          if (state.accounts[accountId]?.data) {
            state.accounts[accountId].data = {
              ...state.accounts[accountId].data!,
              ...updates,
            };
          }
        });
      },

      removeAccount: (accountId: string) => {
        set((state) => {
          delete state.accounts[accountId];

          // Update session data if it exists
          if (state.session.data) {
            state.session.data.accountIds = state.session.data.accountIds.filter((id) => id !== accountId);
            if (state.session.data.currentAccountId === accountId) {
              state.session.data.currentAccountId = state.session.data.accountIds[0] || null;
            }
          }
        });
      },

      clearAccountOperation: (accountId: string) => {
        set((state) => {
          if (state.accounts[accountId]) {
            state.accounts[accountId].currentOperation = null;
            state.accounts[accountId].loading = false;
          }
        });
      },

      // Temp token actions
      setTempToken: (token: string) => {
        set((state) => {
          state.tempToken = token;
        });
      },

      clearTempToken: () => {
        set((state) => {
          state.tempToken = null;
        });
      },

      // Getters
      getSessionState: () => {
        return get().session;
      },

      getAccountState: (accountId: string) => {
        return get().accounts[accountId] || createAccountState();
      },

      shouldLoadAccount: (accountId: string, maxAge: number = 5 * 60 * 1000) => {
        const accountState = get().accounts[accountId];

        // Don't load if already loading
        if (accountState?.loading) return false;

        // Load if no data
        if (!accountState?.data) return true;

        // Load if no timestamp or data is stale
        if (!accountState.lastLoaded) return true;
        if (Date.now() - accountState.lastLoaded > maxAge) return true;

        return false;
      },

      shouldLoadSession: (maxAge: number = 5 * 60 * 1000) => {
        const sessionState = get().session;

        // Don't load if already loading
        if (sessionState.loading) return false;

        // Load if no data
        if (!sessionState.data) return true;

        // Load if no timestamp or data is stale
        if (!sessionState.lastLoaded) return true;
        if (Date.now() - sessionState.lastLoaded > maxAge) return true;

        return false;
      },
    })),
  ),
);
