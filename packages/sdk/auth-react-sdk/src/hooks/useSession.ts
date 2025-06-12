import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { LoadingState } from '../types';

export const useSession = () => {
  const store = useAppStore();

  const refreshSession = useCallback(async () => {
    return store.refreshSession();
  }, [store.refreshSession]);

  const clearSession = useCallback(() => {
    store.clearSession();
  }, [store.clearSession]);

  const setCurrentAccount = useCallback(
    async (accountId: string | null) => {
      return store.setCurrentAccount(accountId);
    },
    [store.setCurrentAccount],
  );

  const resetState = useCallback(() => {
    store.resetSessionState();
  }, [store.resetSessionState]);

  return {
    session: store.session,
    loadingState: store.session.loadingState,
    isLoading: store.session.loadingState === LoadingState.LOADING,
    isReady: store.session.loadingState === LoadingState.READY,
    isIdle: store.session.loadingState === LoadingState.IDLE,
    isError: store.session.loadingState === LoadingState.ERROR,
    isInitializing: store.ui.initializationState === LoadingState.LOADING,
    initializationState: store.ui.initializationState,
    refreshSession,
    clearSession,
    setCurrentAccount,
    resetState,
  };
};
