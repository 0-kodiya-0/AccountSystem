import { useCallback, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { LoadingState, type Account } from '../types';

export const useAccount = (accountId?: string) => {
  const store = useAppStore();

  const targetAccountId = accountId || store.session.currentAccountId;
  const account = targetAccountId ? store.accounts.data.get(targetAccountId) : null;
  const loadingState = targetAccountId
    ? store.accounts.loadingStates.get(targetAccountId) || LoadingState.IDLE
    : LoadingState.IDLE;
  const error = targetAccountId ? store.accounts.errors.get(targetAccountId) : null;

  const loadAccount = useCallback(
    async (id: string) => {
      return store.loadAccount(id);
    },
    [store.loadAccount],
  );

  const updateAccount = useCallback(
    (id: string, updates: Partial<Account>) => {
      store.updateAccount(id, updates);
    },
    [store.updateAccount],
  );

  const removeAccount = useCallback(
    (id: string) => {
      store.removeAccount(id);
    },
    [store.removeAccount],
  );

  const clearError = useCallback(() => {
    if (targetAccountId) {
      store.clearError(targetAccountId);
    }
  }, [store.clearError, targetAccountId]);

  const resetState = useCallback(() => {
    if (targetAccountId) {
      store.resetAccountState(targetAccountId);
    }
  }, [store.resetAccountState, targetAccountId]);

  useEffect(() => {
    if (targetAccountId && !account && loadingState === LoadingState.IDLE && !error) {
      loadAccount(targetAccountId);
    }
  }, [targetAccountId, loadingState, error]);

  return {
    account,
    loadingState,
    isLoading: loadingState === LoadingState.LOADING,
    isReady: loadingState === LoadingState.READY,
    isIdle: loadingState === LoadingState.IDLE,
    isError: loadingState === LoadingState.ERROR,
    error,
    loadAccount,
    updateAccount,
    removeAccount,
    clearError,
    resetState,
  };
};
