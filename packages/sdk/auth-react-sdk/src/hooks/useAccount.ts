import { useEffect, useCallback } from 'react';
import { useAuth } from '../context/auth-context';
import { useAccountStore } from '../store/account-store';
import { useDataLoading } from '../hooks/useLoading';
import { Account, UseAccountOptions } from '../types';

/**
 * Unified hook for managing account data with smart fetching and loading states
 * 
 * @param accountIdOrIds - Single account ID, array of IDs, or undefined for current account
 * @param options - Configuration options
 * 
 * @examples
 * ```ts
 * // Current account
 * const { account, isReady, isPending, hasError, refresh } = useAccount();
 * 
 * // Single account
 * const { account, isReady, isPending, hasError, refresh } = useAccount('account-id');
 * 
 * // Multiple accounts
 * const { accounts, isReady, isPending, hasError, refreshAll } = useAccount(['id1', 'id2', 'id3']);
 * ```
 */
export function useAccount(
    accountIdOrIds?: string | string[],
    options: UseAccountOptions = {}
) {
    const {
        autoFetch = true,
        refreshOnMount = false,
        refreshInterval = 0
    } = options;

    const { isReady: isAuthReady, ensureAccountData, refreshAccountData } = useAuth();
    const { 
        getAccountById, 
        needsAccountData,
        getAccountIds // Get account IDs from session
    } = useAccountStore();
    
    // Initialize loading state based on what we're fetching
    const entityName = (() => {
        if (!accountIdOrIds) return 'current account';
        if (typeof accountIdOrIds === 'string') return 'account';
        return `${accountIdOrIds.length} accounts`;
    })();

    const {
        loadingInfo,
        isPending,
        isReady,
        hasError,
        setPending,
        setReady,
        setError: setLoadingError,
        updateLoadingReason
    } = useDataLoading(entityName);

    // Normalize input to always work with array of IDs
    const accountIds: string[] = (() => {
        if (!accountIdOrIds || !isAuthReady) {
            return [];
        }
        if (typeof accountIdOrIds === 'string') {
            // Single ID - but only if it's in session
            const sessionAccountIds = getAccountIds();
            return sessionAccountIds.includes(accountIdOrIds) ? [accountIdOrIds] : [];
        }
        // Array of IDs - filter to only include accounts in session
        const sessionAccountIds = getAccountIds();
        return accountIdOrIds.filter(id => sessionAccountIds.includes(id));
    })();

    const accounts = accountIds.map(id => getAccountById(id));
    const account = accounts[0] || null;

    const refreshAll = useCallback(async (): Promise<(Account | null)[]> => {
        if (accountIds.length === 0) {
            setReady('No accounts to refresh');
            return [];
        }

        try {
            setPending(`Refreshing ${accountIds.length} account(s)`);
            
            const results = await Promise.allSettled(
                accountIds.map((id, index) => {
                    updateLoadingReason(`Refreshing account ${index + 1} of ${accountIds.length}`);
                    return refreshAccountData(id);
                })
            );

            const refreshedAccounts: (Account | null)[] = [];
            let errorCount = 0;

            results.forEach((result, index) => {
                const accountId = accountIds[index];
                if (result.status === 'rejected') {
                    console.warn(`Failed to refresh account ${accountId}:`, result.reason);
                    refreshedAccounts.push(null);
                    errorCount++;
                } else {
                    refreshedAccounts.push(result.value);
                }
            });

            if (errorCount > 0) {
                const successCount = accountIds.length - errorCount;
                if (successCount > 0) {
                    setReady(`${successCount} of ${accountIds.length} accounts refreshed successfully`);
                } else {
                    setLoadingError(`Failed to refresh all ${accountIds.length} account(s)`);
                }
            } else {
                setReady(`All ${accountIds.length} account(s) refreshed successfully`);
            }

            return refreshedAccounts;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to refresh accounts';
            setLoadingError(message);
            throw error;
        }
    }, [accountIds, setPending, setReady, setLoadingError, updateLoadingReason, refreshAccountData]);

    const refresh = useCallback(async (): Promise<Account | null> => {
        const results = await refreshAll();
        return results[0] || null;
    }, [refreshAll]);

    const fetchMissing = useCallback(async (): Promise<(Account | null)[]> => {
        const missingIds = accountIds.filter(id => !getAccountById(id));
        if (missingIds.length === 0) {
            setReady('All account data already available');
            return accounts;
        }

        try {
            setPending(`Loading ${missingIds.length} missing account(s)`);
            
            const results = await Promise.allSettled(
                missingIds.map((id, index) => {
                    updateLoadingReason(`Loading account ${index + 1} of ${missingIds.length}`);
                    return ensureAccountData(id);
                })
            );

            let errorCount = 0;
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    const accountId = missingIds[index];
                    console.warn(`Failed to fetch account ${accountId}:`, result.reason);
                    errorCount++;
                }
            });

            if (errorCount > 0) {
                const successCount = missingIds.length - errorCount;
                if (successCount > 0) {
                    setReady(`${successCount} of ${missingIds.length} accounts loaded successfully`);
                } else {
                    setLoadingError(`Failed to load all ${missingIds.length} missing account(s)`);
                }
            } else {
                setReady(`All ${missingIds.length} missing account(s) loaded successfully`);
            }
            
            // Return updated accounts array
            return accountIds.map(id => getAccountById(id));
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to fetch missing accounts';
            setLoadingError(message);
            throw error;
        }
    }, [accountIds, getAccountById, accounts, setPending, setReady, setLoadingError, updateLoadingReason, ensureAccountData]);

    // Auto-refresh interval
    useEffect(() => {
        if (accountIds.length === 0 || refreshInterval <= 0) return;

        const interval = setInterval(() => {
            refreshAll().catch(error => {
                console.warn('Auto-refresh failed:', error);
            });
        }, refreshInterval);

        return () => clearInterval(interval);
    }, [accountIds]); // Use join for stable dependency

    // Auto-fetch on mount or when accountIds change
    useEffect(() => {
        if (accountIds.length === 0) {
            setReady('No accounts to manage');
            return;
        }

        if (refreshOnMount) {
            updateLoadingReason('Refreshing on mount');
            refreshAll().catch(error => {
                console.warn('Refresh on mount failed:', error);
            });
        } else if (autoFetch) {
            const needsFetch = accountIds.some(id => needsAccountData(id));
            if (needsFetch) {
                updateLoadingReason('Auto-fetching missing data');
                fetchMissing().catch(error => {
                    console.warn('Auto-fetch failed:', error);
                });
            } else {
                setReady('All account data available');
            }
        } else {
            setReady('Ready - auto-fetch disabled');
        }
    }, [accountIds]); // Use join for stable dependency

    return {
        // Data
        account,
        accounts,
        
        // Loading states from the new pattern
        loadingInfo,
        isPending,
        isReady,
        hasError,
        
        // Legacy loading state for backward compatibility
        isLoading: isPending,
        error: loadingInfo.reason || null,
        
        // Actions
        refresh,
        refreshAll
    };
}