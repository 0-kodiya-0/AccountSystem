import { useCallback, useEffect, useMemo } from 'react';
import { useAuth } from './useAuth';
import { useServices } from './core/useServices';
import { useAuthCore } from './core/useAuthCore';
import { useDataLoading } from './useLoading';
import { Account, UseAccountOptions, AuthSDKError } from '../types';

export const useAccount = (
  accountIdOrIds?: string | string[],
  options: UseAccountOptions = {},
) => {
  const {
    autoFetch = true,
    refreshOnMount = false,
    refreshInterval = 0,
  } = options;

  // Only depend on useAuth - no circular dependencies
  const {
    session,
    isReady: isAuthReady,
    getAccountById,
    hasFullAccountData,
    needsAccountData,
  } = useAuth();

  const { accountService } = useServices();
  const store = useAuthCore();

  const {
    loadingInfo,
    isPending,
    isReady,
    hasError,
    setPending,
    setReady,
    setError,
    updateLoadingReason,
  } = useDataLoading('account data');

  // Normalize account IDs - OPTIMIZED: useMemo prevents recalculation
  const accountIds = useMemo(() => {
    if (!accountIdOrIds || !isAuthReady) return [];

    const sessionAccountIds = session?.accountIds || [];
    if (typeof accountIdOrIds === 'string') {
      return sessionAccountIds.includes(accountIdOrIds) ? [accountIdOrIds] : [];
    }
    return accountIdOrIds.filter((id) => sessionAccountIds.includes(id));
  }, [accountIdOrIds, isAuthReady, session?.accountIds]); // Only depend on values that affect calculation

  // Computed values - OPTIMIZED: useMemo for expensive operations
  const { accounts, account } = useMemo(() => {
    const accounts = accountIds
      .map((id) => getAccountById(id))
      .filter(Boolean) as Account[];
    const account = accounts[0] || null;
    return { accounts, account };
  }, [accountIds, getAccountById]); // Only recalculate when IDs change or getAccountById changes

  // Account operations - OPTIMIZED: useCallback with minimal dependencies
  const fetchAccount = useCallback(
    async (accountId: string): Promise<Account> => {
      try {
        updateLoadingReason(`Fetching account ${accountId}`);
        const account = await accountService.getAccount(accountId);
        store.setAccountData(accountId, account);
        return account;
      } catch (error) {
        const message =
          error instanceof AuthSDKError
            ? error.message
            : 'Failed to fetch account';
        setError(message);
        throw error;
      }
    },
    [accountService, store.setAccountData, updateLoadingReason, setError],
  );

  const updateAccount = useCallback(
    async (accountId: string, updates: Partial<Account>): Promise<Account> => {
      try {
        updateLoadingReason(`Updating account ${accountId}`);
        const account = await accountService.updateAccount(accountId, updates);
        store.updateAccountData(accountId, account);
        return account;
      } catch (error) {
        const message =
          error instanceof AuthSDKError
            ? error.message
            : 'Failed to update account';
        setError(message);
        throw error;
      }
    },
    [accountService, store.updateAccountData, updateLoadingReason, setError],
  );

  const refreshAll = useCallback(async (): Promise<(Account | null)[]> => {
    if (accountIds.length === 0) {
      setReady('No accounts to refresh');
      return [];
    }

    try {
      setPending(`Refreshing ${accountIds.length} account(s)`);

      const refreshedAccounts = await Promise.all(
        accountIds.map((id, index) => {
          updateLoadingReason(
            `Refreshing account ${index + 1} of ${accountIds.length}`,
          );
          return fetchAccount(id);
        }),
      );

      setReady(`All ${accountIds.length} account(s) refreshed successfully`);
      return refreshedAccounts;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to refresh accounts';
      setError(message);
      throw error;
    }
  }, [
    accountIds,
    fetchAccount,
    setPending,
    setReady,
    setError,
    updateLoadingReason,
  ]);

  const refresh = useCallback(async (): Promise<Account | null> => {
    const results = await refreshAll();
    return results[0] || null;
  }, [refreshAll]); // Only depends on refreshAll

  // Auto-fetch logic - OPTIMIZED: Only depends on values that affect the decision
  useEffect(() => {
    if (!isAuthReady) {
      return; // Don't set ready state if auth isn't ready yet
    }

    if (accountIds.length === 0) {
      setReady('Ready - no accounts to manage');
      return;
    }

    if (refreshOnMount) {
      updateLoadingReason('Refreshing on mount');
      refreshAll().catch((error) => {
        console.warn('Refresh on mount failed:', error);
      });
    } else if (autoFetch) {
      const needsFetch = accountIds.some(
        (id) => needsAccountData(id) || !hasFullAccountData(id),
      );
      if (needsFetch) {
        updateLoadingReason('Auto-fetching missing data');
        const fetchPromises = accountIds
          .filter((id) => needsAccountData(id) || !hasFullAccountData(id))
          .map((id) => fetchAccount(id));

        Promise.all(fetchPromises)
          .then(() => setReady('All account data loaded'))
          .catch((error) => {
            console.warn('Auto-fetch failed:', error);
          });
      } else {
        setReady('All account data available');
      }
    } else {
      setReady('Ready - auto-fetch disabled');
    }
  }, [isAuthReady, accountIds, refreshOnMount, autoFetch]);

  // Auto-refresh interval - OPTIMIZED: Only runs when interval is set and accounts exist
  useEffect(() => {
    if (accountIds.length === 0 || refreshInterval <= 0) return;

    const interval = setInterval(() => {
      refreshAll().catch((error) => {
        console.warn('Auto-refresh failed:', error);
      });
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [accountIds.length, refreshInterval, refreshAll]);

  return {
    // Data
    account,
    accounts,

    // Loading states
    loadingInfo,
    isPending,
    isReady,
    hasError,

    // Actions
    refresh,
    refreshAll,
    updateAccount,
    fetchAccount,
  };
};
