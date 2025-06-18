import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { Account, AccountSessionInfo, AccountState, LoadingState, SessionState } from '../types';
import { enableMapSet } from 'immer';

enableMapSet();

// Main store state
interface AppState {
  session: SessionState;
  accounts: Record<string, AccountState>;
  tempToken: string | null;
}

// Store actions
interface AppActions {
  // Session actions
  setSessionStatus: (status: LoadingState, operation?: string) => void;
  setSessionData: (data: AccountSessionInfo) => void;
  setSessionError: (error: string | null) => void;
  setSessionOperation: (operation: string | null) => void;
  clearSession: () => void;

  // Account actions
  setAccountStatus: (accountId: string, status: LoadingState, operation?: string) => void;
  setAccountData: (accountId: string, data: Account) => void;
  setAccountError: (accountId: string, error: string | null) => void;
  setAccountOperation: (accountId: string, operation: string | null) => void;
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
const createDefaultSessionState = (): SessionState => ({
  data: null,
  status: 'idle',
  currentOperation: null,
  error: null,
  lastLoaded: null,
});

const createDefaultAccountState = (): AccountState => ({
  data: null,
  status: 'idle',
  currentOperation: null,
  error: null,
  lastLoaded: null,
});

export const useAppStore = create<AppState & AppActions>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // Initial state
      session: createDefaultSessionState(),
      accounts: {},
      tempToken: null,

      // Session actions
      setSessionStatus: (status: LoadingState, operation?: string) => {
        set((state) => {
          state.session.status = status;
          state.session.currentOperation = operation || null;
          if (status !== 'error') {
            state.session.error = null;
          }
        });
      },

      setSessionData: (data: AccountSessionInfo) => {
        set((state) => {
          state.session.data = data;
          state.session.status = 'success';
          state.session.currentOperation = null;
          state.session.error = null;
          state.session.lastLoaded = Date.now();
        });
      },

      setSessionError: (error: string | null) => {
        set((state) => {
          state.session.error = error;
          state.session.status = error ? 'error' : 'idle';
          state.session.currentOperation = null;
        });
      },

      setSessionOperation: (operation: string | null) => {
        set((state) => {
          state.session.currentOperation = operation;
        });
      },

      clearSession: () => {
        set((state) => {
          state.session = createDefaultSessionState();
          state.accounts = {};
          state.tempToken = null;
        });
      },

      // Account actions
      setAccountStatus: (accountId: string, status: LoadingState, operation?: string) => {
        set((state) => {
          if (!state.accounts[accountId]) {
            state.accounts[accountId] = createDefaultAccountState();
          }
          state.accounts[accountId].status = status;
          state.accounts[accountId].currentOperation = operation || null;
          if (status !== 'error') {
            state.accounts[accountId].error = null;
          }
        });
      },

      setAccountData: (accountId: string, data: Account) => {
        set((state) => {
          if (!state.accounts[accountId]) {
            state.accounts[accountId] = createDefaultAccountState();
          }
          state.accounts[accountId].data = data;
          state.accounts[accountId].status = 'success';
          state.accounts[accountId].currentOperation = null;
          state.accounts[accountId].error = null;
          state.accounts[accountId].lastLoaded = Date.now();
        });
      },

      setAccountError: (accountId: string, error: string | null) => {
        set((state) => {
          if (!state.accounts[accountId]) {
            state.accounts[accountId] = createDefaultAccountState();
          }
          state.accounts[accountId].error = error;
          state.accounts[accountId].status = error ? 'error' : 'idle';
          state.accounts[accountId].currentOperation = null;
        });
      },

      setAccountOperation: (accountId: string, operation: string | null) => {
        set((state) => {
          if (!state.accounts[accountId]) {
            state.accounts[accountId] = createDefaultAccountState();
          }
          state.accounts[accountId].currentOperation = operation;
        });
      },

      setAccountsData: (accounts: Account[]) => {
        set((state) => {
          accounts.forEach((account) => {
            if (!state.accounts[account.id]) {
              state.accounts[account.id] = createDefaultAccountState();
            }
            state.accounts[account.id].data = account;
            state.accounts[account.id].status = 'success';
            state.accounts[account.id].lastLoaded = Date.now();
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
            if (
              state.accounts[accountId].status === 'updating' ||
              state.accounts[accountId].status === 'saving' ||
              state.accounts[accountId].status === 'deleting'
            ) {
              state.accounts[accountId].status = 'idle';
            }
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
        return get().accounts[accountId];
      },

      shouldLoadAccount: (accountId: string, maxAge: number = 5 * 60 * 1000) => {
        const accountState = get().accounts[accountId];

        // Don't load if currently loading or updating
        if (accountState?.status === 'loading' || accountState?.status === 'updating') {
          return false;
        }

        // Load if no data
        if (!accountState?.data) return true;

        // Load if no timestamp or data is stale
        if (!accountState.lastLoaded) return true;
        if (Date.now() - accountState.lastLoaded > maxAge) return true;

        return false;
      },

      shouldLoadSession: (maxAge: number = 5 * 60 * 1000) => {
        const sessionState = get().session;

        // Don't load if currently loading
        if (sessionState.status === 'loading') return false;

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
