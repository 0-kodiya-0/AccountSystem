import { useEffect, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useAuthService } from '../context/ServicesProvider';
import { AccountSessionInfo, LoadingState, SessionAccount, SessionAccountsState } from '../types';
import { getStatusHelpers, parseApiError } from '../utils';

interface SessionOperations {
  load: () => Promise<void>;
  loadSessionAccounts: () => Promise<void>;
  logoutAll: () => Promise<void>;
  setCurrentAccount: (accountId: string | null) => Promise<void>;
}

interface SessionOptions {
  autoLoad?: boolean; // Whether to automatically load session on mount (default: true)
  autoLoadSessionAccounts?: boolean; // Whether to automatically load session accounts data (default: false)
}

interface SessionReturn {
  // Session data
  data: AccountSessionInfo | null;
  status: LoadingState;
  currentOperation: string | null;
  error: string | null;

  // Session convenience getters
  isLoading: boolean;
  isUpdating: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  isIdle: boolean;
  hasError: boolean;
  isSuccess: boolean;

  // Session accounts state (separate from main session)
  sessionAccounts: SessionAccountsState;

  // Session accounts convenience getters
  sessionAccountsLoading: boolean;
  sessionAccountsError: string | null;
  sessionAccountsSuccess: boolean;

  // Derived state
  isAuthenticated: boolean;
  hasAccount: boolean;
  currentAccountId: string | null;
  accountIds: string[];

  // Session account list (lightweight data from getSessionAccountsData)
  accounts: SessionAccount[];

  // Operations
  operations: SessionOperations;
}

export function useSession(options: SessionOptions = {}): SessionReturn {
  const { autoLoad = true, autoLoadSessionAccounts = false } = options;
  const authService = useAuthService();

  // Store state
  const sessionState = useAppStore((state) => state.getSessionState());
  const sessionAccountsState = useAppStore((state) => state.getSessionAccountsState());

  const setSessionStatus = useAppStore((state) => state.setSessionStatus);
  const setSessionData = useAppStore((state) => state.setSessionData);
  const setSessionError = useAppStore((state) => state.setSessionError);
  const clearSession = useAppStore((state) => state.clearSession);

  const setSessionAccountsStatus = useAppStore((state) => state.setSessionAccountsStatus);
  const setSessionAccountsData = useAppStore((state) => state.setSessionAccountsData);
  const setSessionAccountsError = useAppStore((state) => state.setSessionAccountsError);

  // Session operations
  const sessionOperations = useMemo<SessionOperations>(
    () => ({
      load: async () => {
        try {
          setSessionStatus('loading', 'loadSession');

          const sessionResponse = await authService.getAccountSession();
          setSessionData(sessionResponse.session);
        } catch (error) {
          const apiError = parseApiError(error, 'Failed to load session');
          setSessionError(apiError.message);
        }
      },

      loadSessionAccounts: async () => {
        try {
          // Check if we have session data with account IDs
          const currentSessionData = sessionState.data || useAppStore.getState().getSessionState().data;
          if (!currentSessionData?.accountIds.length) {
            console.warn('No account IDs available to load session accounts');
            return;
          }

          setSessionAccountsStatus('loading', 'loadSessionAccounts');

          const sessionAccountsData = await authService.getSessionAccountsData(currentSessionData.accountIds);
          setSessionAccountsData(sessionAccountsData as SessionAccount[]);
        } catch (error) {
          const apiError = parseApiError(error, 'Failed to load session accounts');
          setSessionAccountsError(apiError.message);
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
    }),
    [autoLoadSessionAccounts],
  );

  // Auto-load session on mount (if enabled)
  useEffect(() => {
    if (autoLoad && useAppStore.getState().shouldLoadSession()) {
      sessionOperations.load();
    }
  }, [autoLoad, sessionState.status]);

  useEffect(() => {
    // Automatically load session accounts if configured to do so
    if (autoLoadSessionAccounts && useAppStore.getState().shouldLoadSessionAccounts()) {
      sessionOperations.loadSessionAccounts();
    }
  }, [autoLoadSessionAccounts, sessionState.status]);

  // Derived state
  const isAuthenticated = autoLoadSessionAccounts
    ? !!(
        sessionState.data?.hasSession &&
        sessionState.data?.isValid &&
        sessionState.data?.accountIds.length > 0 &&
        sessionAccountsState.data &&
        sessionAccountsState.data.length > 0
      )
    : !!(sessionState.data?.hasSession && sessionState.data?.isValid && sessionState.data?.accountIds.length > 0);
  const hasAccount = !!sessionState.data?.currentAccountId;
  const currentAccountId = sessionState.data?.currentAccountId || null;
  const accountIds = sessionState.data?.accountIds || [];

  // Return session accounts (lightweight data) sorted by account IDs order
  const accounts: SessionAccount[] = accountIds
    .map((id) => sessionAccountsState.data.find((acc) => acc.id === id))
    .filter(Boolean) as SessionAccount[];

  // Session accounts convenience getters
  const sessionAccountsHelpers = getStatusHelpers(sessionAccountsState.status);

  return {
    // Session data
    data: sessionState.data,
    status: sessionState.status,
    currentOperation: sessionState.currentOperation,
    error: sessionState.error,

    // Session convenience getters
    ...getStatusHelpers(sessionState.status),

    // Session accounts state (separate from main session)
    sessionAccounts: sessionAccountsState,

    // Session accounts convenience getters
    sessionAccountsLoading: sessionAccountsHelpers.isLoading,
    sessionAccountsError: sessionAccountsState.error,
    sessionAccountsSuccess: sessionAccountsHelpers.isSuccess,

    // Derived state
    isAuthenticated,
    hasAccount,
    currentAccountId,
    accountIds,

    // Session account list (lightweight data)
    accounts,

    // Operations
    operations: sessionOperations,
  };
}
