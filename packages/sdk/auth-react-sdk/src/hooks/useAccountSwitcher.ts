import { useState, useCallback } from 'react';
import { useAuth } from '../context/auth-context';
import { useCurrentAccount } from '../store/account-store';

/**
 * Hook for managing account switching with disabled account support
 */
export const useAccountSwitcher = () => {
    const { 
        switchAccount, 
        logout, 
        logoutAll, 
        accounts: activeAccounts,
        allAccounts,
        disabledAccounts,
        disableAccount,
        enableAccount,
        removeAccount,
        isAccountDisabled
    } = useAuth();
    const currentAccount = useCurrentAccount();
    
    const [switching, setSwitching] = useState(false);

    const switchTo = useCallback(async (accountId: string) => {
        if (isAccountDisabled(accountId)) {
            throw new Error('Cannot switch to disabled account');
        }

        try {
            setSwitching(true);
            switchAccount(accountId);
        } finally {
            setSwitching(false);
        }
    }, [switchAccount, isAccountDisabled]);

    const logoutAccount = useCallback(async (accountId?: string, keepInClient: boolean = false) => {
        try {
            setSwitching(true);
            await logout(accountId, !keepInClient); // clearClientAccountState = !keepInClient
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

    const reactivateAccount = useCallback(async (accountId: string) => {
        try {
            setSwitching(true);
            // Re-enable the account in client state
            enableAccount(accountId);
            
            // Note: The account needs to be re-authenticated since the backend session is cleared
            // This just makes it available for re-login
        } finally {
            setSwitching(false);
        }
    }, [enableAccount]);

    const permanentlyRemoveAccount = useCallback(async (accountId: string) => {
        try {
            setSwitching(true);
            removeAccount(accountId);
        } finally {
            setSwitching(false);
        }
    }, [removeAccount]);

    const temporarilyDisableAccount = useCallback(async (accountId: string) => {
        try {
            setSwitching(true);
            disableAccount(accountId);
        } finally {
            setSwitching(false);
        }
    }, [disableAccount]);

    // Helper function to get account status
    const getAccountStatus = useCallback((accountId: string): 'active' | 'disabled' | 'not_found' => {
        if (!allAccounts.find(a => a.id === accountId)) {
            return 'not_found';
        }
        return isAccountDisabled(accountId) ? 'disabled' : 'active';
    }, [allAccounts, isAccountDisabled]);

    // Helper function to get accounts by status
    const getAccountsByStatus = useCallback(() => {
        return {
            active: activeAccounts,
            disabled: disabledAccounts,
            all: allAccounts
        };
    }, [activeAccounts, disabledAccounts, allAccounts]);

    // Helper function to check if account can be switched to
    const canSwitchToAccount = useCallback((accountId: string): boolean => {
        const account = allAccounts.find(a => a.id === accountId);
        return account ? !isAccountDisabled(accountId) : false;
    }, [allAccounts, isAccountDisabled]);

    return {
        // Current state
        currentAccount,
        switching,
        
        // Account collections
        accounts: activeAccounts,
        allAccounts,
        disabledAccounts,
        
        // Basic actions
        switchTo,
        logoutAccount,
        logoutAllAccounts,
        
        // Disabled account management
        reactivateAccount,
        permanentlyRemoveAccount,
        temporarilyDisableAccount,
        
        // Status checkers
        isAccountDisabled,
        getAccountStatus,
        canSwitchToAccount,
        
        // Helpers
        getAccountsByStatus,
        hasMultipleAccounts: allAccounts.length > 1,
        hasActiveAccounts: activeAccounts.length > 0,
        hasDisabledAccounts: disabledAccounts.length > 0,
        
        // Account counts
        activeCount: activeAccounts.length,
        disabledCount: disabledAccounts.length,
        totalCount: allAccounts.length
    };
};