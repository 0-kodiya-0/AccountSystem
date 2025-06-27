import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import {
  Account,
  AccountSessionInfo,
  AccountState,
  LoadingState,
  SessionState,
  SessionAccount,
  SessionAccountsState,
} from '../types';
import { enableMapSet } from 'immer';

enableMapSet();

// Main store state - Updated with SessionAccountsState
interface AppState {
  session: SessionState;
  accounts: Record<string, AccountState>; // Full account data
  sessionAccounts: SessionAccountsState; // Session accounts with their own loading state
}

// Store actions - Updated session account actions
interface AppActions {
  // Session actions
  setSessionStatus: (status: LoadingState, operation?: string) => void;
  setSessionData: (data: AccountSessionInfo) => void;
  setSessionError: (error: string | null) => void;
  setSessionOperation: (operation: string | null) => void;
  clearSession: () => void;

  // Account actions (full account data)
  setAccountStatus: (accountId: string, status: LoadingState, operation?: string) => void;
  setAccountData: (accountId: string, data: Account) => void;
  setAccountError: (accountId: string, error: string | null) => void;
  setAccountOperation: (accountId: string, operation: string | null) => void;
  setAccountsData: (accounts: Account[]) => void;
  updateAccountData: (accountId: string, updates: Partial<Account>) => void;
  removeAccount: (accountId: string) => void;
  clearAccountOperation: (accountId: string) => void;

  // Session accounts actions (with separate state management)
  setSessionAccountsStatus: (status: LoadingState, operation?: string) => void;
  setSessionAccountsData: (accounts: SessionAccount[]) => void;
  setSessionAccountsError: (error: string | null) => void;
  setSessionAccountData: (accountId: string, data: SessionAccount) => void;
  updateSessionAccountData: (accountId: string, updates: Partial<SessionAccount>) => void;
  removeSessionAccount: (accountId: string) => void;
  clearSessionAccounts: () => void;

  // Getters
  getSessionState: () => SessionState;
  getSessionAccountsState: () => SessionAccountsState;
  getAccountState: (accountId: string) => AccountState;
  getSessionAccount: (accountId: string) => SessionAccount | undefined;
  getAllSessionAccounts: () => SessionAccount[];
  shouldLoadAccount: (accountId: string, maxAge?: number) => boolean;
  shouldLoadSession: (maxAge?: number) => boolean;
  shouldLoadSessionAccounts: (maxAge?: number) => boolean;
}

// STATIC DEFAULT STATES - These are created once and reused
export const DEFAULT_SESSION_STATE: SessionState = {
  data: null,
  status: 'idle',
  currentOperation: null,
  error: null,
  lastLoaded: null,
};

export const DEFAULT_ACCOUNT_STATE: AccountState = {
  data: null,
  status: 'idle',
  currentOperation: null,
  error: null,
  lastLoaded: null,
};

export const DEFAULT_SESSION_ACCOUNTS_STATE: SessionAccountsState = {
  data: [],
  status: 'idle',
  currentOperation: null,
  error: null,
  lastLoaded: null,
};

// Helper functions that return static objects
const createDefaultSessionState = (): SessionState => ({ ...DEFAULT_SESSION_STATE });
const createDefaultAccountState = (): AccountState => ({ ...DEFAULT_ACCOUNT_STATE });
const createDefaultSessionAccountsState = (): SessionAccountsState => ({ ...DEFAULT_SESSION_ACCOUNTS_STATE, data: [] });

export const useAppStore = create<AppState & AppActions>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // Initial state - Updated sessionAccounts structure
      session: createDefaultSessionState(),
      accounts: {},
      sessionAccounts: createDefaultSessionAccountsState(),

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
          state.sessionAccounts = createDefaultSessionAccountsState(); // Clear session accounts with state reset
        });
      },

      // Account actions (full account data)
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

          // Also update session account data if it exists
          const sessionAccountIndex = state.sessionAccounts.data.findIndex((acc) => acc.id === accountId);
          if (sessionAccountIndex !== -1) {
            state.sessionAccounts.data[sessionAccountIndex] = {
              id: data.id,
              accountType: data.accountType,
              status: data.status,
              userDetails: {
                name: data.userDetails.name,
                email: data.userDetails.email,
                username: data.userDetails.username,
                imageUrl: data.userDetails.imageUrl,
              },
              provider: data.provider,
            };
          }
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

            // Also update session account data if it exists
            const sessionAccountIndex = state.sessionAccounts.data.findIndex((acc) => acc.id === account.id);
            if (sessionAccountIndex !== -1) {
              state.sessionAccounts.data[sessionAccountIndex] = {
                id: account.id,
                accountType: account.accountType,
                status: account.status,
                userDetails: {
                  name: account.userDetails.name,
                  email: account.userDetails.email,
                  username: account.userDetails.username,
                  imageUrl: account.userDetails.imageUrl,
                },
                provider: account.provider,
              };
            }
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

            // Also update session account data if relevant fields changed
            const sessionAccountIndex = state.sessionAccounts.data.findIndex((acc) => acc.id === accountId);
            if (sessionAccountIndex !== -1) {
              const updatedAccount = state.accounts[accountId].data!;
              state.sessionAccounts.data[sessionAccountIndex] = {
                id: updatedAccount.id,
                accountType: updatedAccount.accountType,
                status: updatedAccount.status,
                userDetails: {
                  name: updatedAccount.userDetails.name,
                  email: updatedAccount.userDetails.email,
                  username: updatedAccount.userDetails.username,
                  imageUrl: updatedAccount.userDetails.imageUrl,
                },
                provider: updatedAccount.provider,
              };
            }
          }
        });
      },

      removeAccount: (accountId: string) => {
        set((state) => {
          delete state.accounts[accountId];

          // Remove from session accounts too
          state.sessionAccounts.data = state.sessionAccounts.data.filter((acc) => acc.id !== accountId);

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

      // NEW: Session accounts actions with separate state management
      setSessionAccountsStatus: (status: LoadingState, operation?: string) => {
        set((state) => {
          state.sessionAccounts.status = status;
          state.sessionAccounts.currentOperation = operation || null;
          if (status !== 'error') {
            state.sessionAccounts.error = null;
          }
        });
      },

      setSessionAccountsData: (accounts: SessionAccount[]) => {
        set((state) => {
          state.sessionAccounts.data = accounts;
          state.sessionAccounts.status = 'success';
          state.sessionAccounts.currentOperation = null;
          state.sessionAccounts.error = null;
          state.sessionAccounts.lastLoaded = Date.now();
        });
      },

      setSessionAccountsError: (error: string | null) => {
        set((state) => {
          state.sessionAccounts.error = error;
          state.sessionAccounts.status = error ? 'error' : 'idle';
          state.sessionAccounts.currentOperation = null;
        });
      },

      setSessionAccountData: (accountId: string, data: SessionAccount) => {
        set((state) => {
          const existingIndex = state.sessionAccounts.data.findIndex((acc) => acc.id === accountId);
          if (existingIndex !== -1) {
            state.sessionAccounts.data[existingIndex] = data;
          } else {
            state.sessionAccounts.data.push(data);
          }
          state.sessionAccounts.lastLoaded = Date.now();
        });
      },

      updateSessionAccountData: (accountId: string, updates: Partial<SessionAccount>) => {
        set((state) => {
          const existingIndex = state.sessionAccounts.data.findIndex((acc) => acc.id === accountId);
          if (existingIndex !== -1) {
            state.sessionAccounts.data[existingIndex] = {
              ...state.sessionAccounts.data[existingIndex],
              ...updates,
            };
            state.sessionAccounts.lastLoaded = Date.now();
          }
        });
      },

      removeSessionAccount: (accountId: string) => {
        set((state) => {
          state.sessionAccounts.data = state.sessionAccounts.data.filter((acc) => acc.id !== accountId);
          state.sessionAccounts.lastLoaded = Date.now();
        });
      },

      clearSessionAccounts: () => {
        set((state) => {
          state.sessionAccounts = createDefaultSessionAccountsState();
        });
      },

      // Getters
      getSessionState: () => {
        return get().session;
      },

      getSessionAccountsState: () => {
        return get().sessionAccounts;
      },

      getAccountState: (accountId) => {
        return get().accounts[accountId];
      },

      getSessionAccount: (accountId: string) => {
        return get().sessionAccounts.data.find((acc) => acc.id === accountId);
      },

      getAllSessionAccounts: () => {
        return get().sessionAccounts.data;
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

      shouldLoadSessionAccounts: (maxAge: number = 5 * 60 * 1000) => {
        const sessionState = get().session;

        // If no session data exists, don't load session accounts
        if (!sessionState.data) return false;

        // Don't load if session is currently loading or has no accounts
        if (sessionState.status === 'loading' || sessionState.data.accountIds.length <= 0) return false;

        const sessionAccountsState = get().sessionAccounts;

        // Don't load if currently loading
        if (sessionAccountsState.status === 'loading') return false;

        // Load if no data
        if (sessionAccountsState.data.length === 0) return true;

        // Load if no timestamp or data is stale
        if (!sessionAccountsState.lastLoaded) return true;
        if (Date.now() - sessionAccountsState.lastLoaded > maxAge) return true;

        return false;
      },
    })),
  ),
);
