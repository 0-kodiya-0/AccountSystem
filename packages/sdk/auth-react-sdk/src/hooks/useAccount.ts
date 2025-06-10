import { useEffect, useState } from 'react';
import { useAuth } from '../context/auth-context';
import { useAccountStore } from '../store/account-store';
import { Account, UseAccountOptions } from '../types';

/**
 * Unified hook for managing account data with smart fetching
 * 
 * @param accountIdOrIds - Single account ID, array of IDs, or undefined for current account
 * @param options - Configuration options
 * 
 * @examples
 * ```ts
 * // Current account
 * const { account, isLoading, refresh } = useAccount();
 * 
 * // Single account
 * const { account, isLoading, refresh } = useAccount('account-id');
 * 
 * // Multiple accounts
 * const { accounts, isLoading, refreshAll } = useAccount(['id1', 'id2', 'id3']);
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

    const { ensureAccountData, refreshAccountData, clearError: clearAuthError } = useAuth();
    const { 
        getAccountById, 
        needsAccountData,
        getAccountIds // Get account IDs from session
    } = useAccountStore();
    
    const [isLoading, setIsLoading] = useState(false);
    const [isAccountFetched, setIsAccountFetched] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Normalize input to always work with array of IDs
    const accountIds: string[] = (() => {
        if (!accountIdOrIds) {
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
    const error = Object.values(errors)[0] || null;

    const refreshAll = async (): Promise<(Account | null)[]> => {
        if (accountIds.length === 0) return [];

        try {
            setIsLoading(true);
            setErrors({});
            
            const results = await Promise.allSettled(
                accountIds.map(id => refreshAccountData(id))
            );

            const newErrors: Record<string, string> = {};
            const refreshedAccounts: (Account | null)[] = [];

            results.forEach((result, index) => {
                const accountId = accountIds[index];
                if (result.status === 'rejected') {
                    newErrors[accountId] = result.reason?.message || 'Failed to refresh account';
                    refreshedAccounts.push(null);
                } else {
                    refreshedAccounts.push(result.value);
                }
            });

            setErrors(newErrors);
            return refreshedAccounts;
        } finally {
            setIsLoading(false);
        }
    };

    const refresh = async (): Promise<Account | null> => {
        const results = await refreshAll();
        return results[0] || null;
    };

    const fetchMissing = async (): Promise<(Account | null)[]> => {
        const missingIds = accountIds.filter(id => !getAccountById(id));
        if (missingIds.length === 0) return accounts;

        try {
            setIsLoading(true);
            setErrors(prevErrors => {
                const newErrors = { ...prevErrors };
                // Clear errors for accounts we're about to fetch
                missingIds.forEach(id => delete newErrors[id]);
                return newErrors;
            });
            
            const results = await Promise.allSettled(
                missingIds.map(id => ensureAccountData(id))
            );

            const newErrors: Record<string, string> = {};
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    const accountId = missingIds[index];
                    newErrors[accountId] = result.reason?.message || 'Failed to fetch account';
                }
            });

            setErrors(prevErrors => ({ ...prevErrors, ...newErrors }));
            
            // Return updated accounts array
            return accountIds.map(id => getAccountById(id));
        } finally {
            setIsLoading(false);
        }
    };

    const clearErrors = () => {
        setErrors({});
    };

    const clearError = () => {
        setErrors({});
        clearAuthError();
    };

    // Auto-refresh interval
    useEffect(() => {
        if (accountIds.length === 0 || refreshInterval <= 0) return;

        const interval = setInterval(() => {
            refreshAll();
        }, refreshInterval);

        return () => clearInterval(interval);
    }, [accountIds]); // Use join for stable dependency

    // Auto-fetch on mount or when accountIds change
    useEffect(() => {
        if (accountIds.length === 0 || isAccountFetched) return;

        if (refreshOnMount) {
            refreshAll();
        } else if (autoFetch) {
            const needsFetch = accountIds.some(id => needsAccountData(id));
            if (needsFetch) {
                fetchMissing();
            }
        }
        setIsAccountFetched(true)
    }, [accountIds]); // Use join for stable dependency

    return {
        account,
        accounts,
        isLoading,
        error,
        errors,
        refresh,
        refreshAll,
        clearError,
        clearErrors
    };
}