import { useState, useCallback } from 'react';
import { Account, AuthSDKError } from '../types';
import { useAuth } from '../context/auth-context';
import { useAccountStore, useCurrentAccount } from '../store/account-store';

export const useAccount = (accountId?: string) => {
    const { fetchAccount, updateAccount: updateAccountContext } = useAuth();
    const currentAccount = useCurrentAccount();
    const targetAccount = accountId ? useAccountStore(state => state.getAccountById(accountId)) : currentAccount;
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async () => {
        if (!targetAccount?.id) return;

        try {
            setLoading(true);
            setError(null);
            await fetchAccount(targetAccount.id);
        } catch (err) {
            const message = err instanceof AuthSDKError ? err.message : 'Failed to fetch account';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [fetchAccount, targetAccount?.id]);

    const updateAccount = useCallback(async (updates: Partial<Account>) => {
        if (!targetAccount?.id) return;

        try {
            setLoading(true);
            setError(null);
            const updated = await updateAccountContext(targetAccount.id, updates);
            return updated;
        } catch (err) {
            const message = err instanceof AuthSDKError ? err.message : 'Failed to update account';
            setError(message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [updateAccountContext, targetAccount?.id]);

    return {
        account: targetAccount,
        loading,
        error,
        refetch,
        updateAccount,
        clearError: () => setError(null)
    };
};