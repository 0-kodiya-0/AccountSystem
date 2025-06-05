import { useState, useCallback } from 'react';
import { useAuth } from '../context/auth-context';
import { useAccountStore, useCurrentAccount } from '../store/account-store';

/**
 * Hook for managing account switching
 */
export const useAccountSwitcher = () => {
    const { switchAccount, logout, logoutAll } = useAuth();
    const { accounts } = useAccountStore();
    const currentAccount = useCurrentAccount();
    
    const [switching, setSwitching] = useState(false);

    const switchTo = useCallback(async (accountId: string) => {
        try {
            setSwitching(true);
            switchAccount(accountId);
        } finally {
            setSwitching(false);
        }
    }, [switchAccount]);

    const logoutAccount = useCallback(async (accountId?: string) => {
        try {
            setSwitching(true);
            await logout(accountId);
        } finally {
            setSwitching(false);
        }
    }, [logout]);

    const logoutAllAccounts = useCallback(async () => {
        try {
            setSwitching(true);
            await logoutAll();
        } finally {
            setSwitching(false);
        }
    }, [logoutAll]);

    return {
        accounts,
        currentAccount,
        switching,
        switchTo,
        logoutAccount,
        logoutAllAccounts,
        hasMultipleAccounts: accounts.length > 1
    };
};
