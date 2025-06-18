// packages/sdk/auth-react-sdk/src/hooks/useSession.ts
import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useAuthService } from '../context/ServicesProvider';
import { AccountSessionInfo, LoadingState, Account } from '../types';
import { getStatusHelpers, parseApiError } from '../utils';

interface SessionOperations {
  load: () => Promise<void>;
  logoutAll: () => Promise<void>;
  setCurrentAccount: (accountId: string | null) => Promise<void>;
}

interface SessionOptions {
  autoLoad?: boolean; // Whether to automatically load session on mount (default: true)
}

interface SessionReturn {
  // Session data
  data: AccountSessionInfo | null;
  status: LoadingState;
  currentOperation: string | null;
  error: string | null;

  // Convenience getters
  isLoading: boolean;
  isUpdating: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  isIdle: boolean;
  hasError: boolean;
  isSuccess: boolean;

  // Derived state
  isAuthenticated: boolean;
  hasAccount: boolean;
  currentAccountId: string | null;
  accountIds: string[];

  // Basic account list (just data, no operations)
  accounts: Account[];

  // Operations
  operations: SessionOperations;
}

export function useSession(options: SessionOptions = {}): SessionReturn {
  const { autoLoad = true } = options;
  const authService = useAuthService();

  // Store state
  const sessionState = useAppStore((state) => state.getSessionState());
  const allAccounts = useAppStore((state) => state.accounts);

  const setSessionStatus = useAppStore((state) => state.setSessionStatus);
  const setSessionData = useAppStore((state) => state.setSessionData);
  const setSessionError = useAppStore((state) => state.setSessionError);
  const clearSession = useAppStore((state) => state.clearSession);
  const setAccountsData = useAppStore((state) => state.setAccountsData);

  // Session operations
  const sessionOperations: SessionOperations = {
    load: async () => {
      try {
        setSessionStatus('loading', 'loadSession');

        const sessionResponse = await authService.getAccountSession();
        setSessionData(sessionResponse.session);

        if (sessionResponse.session.accountIds.length > 0) {
          const accountsData = await authService.getSessionAccountsData(sessionResponse.session.accountIds);
          setAccountsData(accountsData as Account[]);
        }
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to load session');
        setSessionError(apiError.message);
      }
    },

    logoutAll: async () => {
      try {
        setSessionStatus('updating', 'logoutAll');

        if (sessionState.data?.accountIds.length) {
          await authService.logoutAll(sessionState.data.accountIds);
        }

        clearSession();
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to logout all');
        setSessionError(apiError.message);
      }
    },

    setCurrentAccount: async (accountId: string | null) => {
      try {
        setSessionStatus('updating', 'setCurrentAccount');

        await authService.setCurrentAccountInSession(accountId);

        // Refresh session to get updated current account
        const sessionResponse = await authService.getAccountSession();
        setSessionData(sessionResponse.session);
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to set current account');
        setSessionError(apiError.message);
      }
    },
  };

  // Auto-load session on mount (if enabled)
  useEffect(() => {
    if (autoLoad && useAppStore.getState().shouldLoadSession()) {
      sessionOperations.load();
    }
  }, [autoLoad]);

  // Derived state
  const isAuthenticated = !!(
    sessionState.data?.hasSession &&
    sessionState.data?.isValid &&
    sessionState.data?.accountIds.length > 0
  );
  const hasAccount = !!sessionState.data?.currentAccountId;
  const currentAccountId = sessionState.data?.currentAccountId || null;
  const accountIds = sessionState.data?.accountIds || [];

  // Get accounts data (just the data, no operations)
  const accounts: Account[] = accountIds.map((id) => allAccounts[id]?.data).filter(Boolean) as Account[];

  return {
    // Session data
    data: sessionState.data,
    status: sessionState.status,
    currentOperation: sessionState.currentOperation,
    error: sessionState.error,

    // Convenience getters
    ...getStatusHelpers(sessionState.status),

    // Derived state
    isAuthenticated,
    hasAccount,
    currentAccountId,
    accountIds,

    // Basic account list
    accounts,

    // Operations
    operations: sessionOperations,
  };
}
