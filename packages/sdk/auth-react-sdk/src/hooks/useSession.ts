import { useAppStore } from '../store/useAppStore';
import { LoadingState } from '../types';

export const useSession = () => {
  // Get session data from store
  const session = useAppStore((state) => state.session);

  // Get store actions directly
  const loadSession = useAppStore((state) => state.loadSession);
  const initializeSession = useAppStore((state) => state.initializeSession);
  const setCurrentAccount = useAppStore((state) => state.setCurrentAccount);
  const clearSession = useAppStore((state) => state.clearSession);
  const clearSessionError = useAppStore((state) => state.clearSessionError);
  const resetSessionState = useAppStore((state) => state.resetSessionState);

  // Derived session state
  const isAuthenticated = session.hasSession && session.isValid && session.accountIds.length > 0;
  const hasMultipleAccounts = session.accountIds.length > 1;
  const hasCurrentAccount = !!session.currentAccountId;

  return {
    // Session data
    session,
    isAuthenticated,
    hasMultipleAccounts,
    hasCurrentAccount,

    // Loading state checks
    isLoading: session.loadingState === LoadingState.LOADING,
    isReady: session.loadingState === LoadingState.READY,
    isIdle: session.loadingState === LoadingState.IDLE,
    isError: session.loadingState === LoadingState.ERROR,

    // Direct store actions
    loadSession,
    initializeSession,
    setCurrentAccount,
    clearSession,
    clearSessionError,
    resetSessionState,

    // Convenience method
    refreshSession: initializeSession,
  };
};
