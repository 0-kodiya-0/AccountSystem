import { useCallback, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { Account } from '../types';

export const useAccount = (accountId?: string) => {
  const store = useAppStore();

  const targetAccountId = accountId || store.session.currentAccountId;
  const account = targetAccountId ? store.accounts.data.get(targetAccountId) : null;
  const isLoading = targetAccountId ? store.accounts.loadingStates.get(targetAccountId) || false : false;
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

  useEffect(() => {
    if (targetAccountId && !account && !isLoading && !error) {
      loadAccount(targetAccountId);
    }
  }, [targetAccountId, account, isLoading, error]);

  return {
    account,
    isLoading,
    error,
    loadAccount,
    updateAccount,
    removeAccount,
    clearError,
  };
};
