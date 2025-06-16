import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { Account, SessionAccount, AccountSessionInfo } from '../types';
import { enableMapSet } from 'immer';

enableMapSet();

type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastLoaded: number | null;
};

type AsyncOperation = {
  loading: boolean;
  error: string | null;
};

interface AppState {
  // Session state with three-state pattern
  session: AsyncState<AccountSessionInfo> & {
    switchingAccount: AsyncOperation;
    loadingAccounts: AsyncOperation;
  };

  // Account data cache with per-account three-state
  accounts: Map<string, AsyncState<Account>>;

  // Temporary token for 2FA flows
  tempToken: string | null;
}

const createAsyncState = <T>(initialData: T | null = null): AsyncState<T> => ({
  data: initialData,
  loading: false,
  error: null,
  lastLoaded: null,
});

const createAsyncOperation = (): AsyncOperation => ({
  loading: false,
  error: null,
});

interface AppActions {
  setSessionLoading: (loading: boolean) => void;
  setSessionData: (data: AccountSessionInfo) => void;
  setSessionError: (error: string | null) => void;
  clearSession: () => void;

  setSwitchingAccount: (loading: boolean, error?: string | null) => void;
  setLoadingAccounts: (loading: boolean, error?: string | null) => void;

  setAccountLoading: (accountId: string, loading: boolean) => void;
  setAccountData: (accountId: string, data: Account) => void;
  setAccountError: (accountId: string, error: string | null) => void;
  setAccountsData: (accounts: SessionAccount[]) => void;
  updateAccountData: (accountId: string, updates: Partial<Account>) => void;
  removeAccount: (accountId: string) => void;

  setTempToken: (token: string) => void;
  clearTempToken: () => void;

  getSessionState: () => AsyncState<AccountSessionInfo>;
  getAccountState: (accountId: string) => AsyncState<Account>;
  shouldLoadAccount: (accountId: string, maxAge?: number) => boolean;
}

export const useAppStore = create<AppState & AppActions>()(
  subscribeWithSelector(
    immer((set, get) => ({
      session: {
        ...createAsyncState<AccountSessionInfo>(),
        switchingAccount: createAsyncOperation(),
        loadingAccounts: createAsyncOperation(),
      },

      accounts: new Map(),
      tempToken: null,

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
          state.session = {
            ...createAsyncState<AccountSessionInfo>(),
            switchingAccount: createAsyncOperation(),
            loadingAccounts: createAsyncOperation(),
          };
          state.accounts.clear();
          state.tempToken = null;
        });
      },

      setSwitchingAccount: (loading: boolean, error: string | null = null) => {
        set((state) => {
          state.session.switchingAccount.loading = loading;
          state.session.switchingAccount.error = error;
        });
      },

      setLoadingAccounts: (loading: boolean, error: string | null = null) => {
        set((state) => {
          state.session.loadingAccounts.loading = loading;
          state.session.loadingAccounts.error = error;
        });
      },

      setAccountLoading: (accountId: string, loading: boolean) => {
        set((state) => {
          if (!state.accounts.has(accountId)) {
            state.accounts.set(accountId, createAsyncState<Account>());
          }
          const accountState = state.accounts.get(accountId)!;
          accountState.loading = loading;
          if (loading) {
            accountState.error = null;
          }
        });
      },

      setAccountData: (accountId: string, data: Account) => {
        set((state) => {
          if (!state.accounts.has(accountId)) {
            state.accounts.set(accountId, createAsyncState<Account>());
          }
          const accountState = state.accounts.get(accountId)!;
          accountState.data = data;
          accountState.loading = false;
          accountState.error = null;
          accountState.lastLoaded = Date.now();
        });
      },

      setAccountError: (accountId: string, error: string | null) => {
        set((state) => {
          if (!state.accounts.has(accountId)) {
            state.accounts.set(accountId, createAsyncState<Account>());
          }
          const accountState = state.accounts.get(accountId)!;
          accountState.error = error;
          accountState.loading = false;
        });
      },

      setAccountsData: (accounts: SessionAccount[]) => {
        set((state) => {
          accounts.forEach((account) => {
            if (!state.accounts.has(account.id)) {
              state.accounts.set(account.id, createAsyncState<Account>());
            }
            const accountState = state.accounts.get(account.id)!;
            accountState.data = account as Account;
            accountState.lastLoaded = Date.now();
          });
          state.session.loadingAccounts.loading = false;
          state.session.loadingAccounts.error = null;
        });
      },

      updateAccountData: (accountId: string, updates: Partial<Account>) => {
        set((state) => {
          const accountState = state.accounts.get(accountId);
          if (accountState?.data) {
            accountState.data = { ...accountState.data, ...updates };
          }
        });
      },

      removeAccount: (accountId: string) => {
        set((state) => {
          state.accounts.delete(accountId);

          // Update session data if it exists
          if (state.session.data) {
            state.session.data.accountIds = state.session.data.accountIds.filter((id) => id !== accountId);
            if (state.session.data.currentAccountId === accountId) {
              state.session.data.currentAccountId = state.session.data.accountIds[0] || null;
            }
          }
        });
      },

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

      getSessionState: () => {
        const { switchingAccount, loadingAccounts, ...sessionState } = get().session;
        return sessionState;
      },

      getAccountState: (accountId: string) => {
        return get().accounts.get(accountId) || createAsyncState<Account>();
      },

      shouldLoadAccount: (accountId: string, maxAge: number = 5 * 60 * 1000) => {
        const accountState = get().accounts.get(accountId);

        // Don't load if already loading
        if (accountState?.loading) return false;

        // Load if no data
        if (!accountState?.data) return true;

        // Load if no timestamp or data is stale
        if (!accountState.lastLoaded) return true;
        if (Date.now() - accountState.lastLoaded > maxAge) return true;

        return false;
      },
    })),
  ),
);
