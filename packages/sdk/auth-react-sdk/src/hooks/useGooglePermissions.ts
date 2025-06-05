import { useState, useCallback } from 'react';
import { AuthSDKError, TokenCheckResponse } from '../types';
import { useAuth } from '../context/auth-context';
import { useCurrentAccount } from '../store/account-store';

/**
 * Hook for managing Google permissions
 */
export const useGooglePermissions = (accountId?: string) => {
    const { requestGooglePermission, checkGoogleScopes } = useAuth();
    const currentAccount = useCurrentAccount();
    const targetAccountId = accountId || currentAccount?.id;
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [scopeChecks, setScopeChecks] = useState<Record<string, TokenCheckResponse>>({});

    const checkScopes = useCallback(async (scopeNames: string[]) => {
        if (!targetAccountId) return null;

        const cacheKey = scopeNames.sort().join(',');
        
        try {
            setLoading(true);
            setError(null);
            const result = await checkGoogleScopes(targetAccountId, scopeNames);
            setScopeChecks(prev => ({ ...prev, [cacheKey]: result }));
            return result;
        } catch (err) {
            const message = err instanceof AuthSDKError ? err.message : 'Failed to check scopes';
            setError(message);
            return null;
        } finally {
            setLoading(false);
        }
    }, [checkGoogleScopes, targetAccountId]);

    const requestPermission = useCallback((scopeNames: string[], redirectUrl?: string) => {
        if (!targetAccountId) return;
        requestGooglePermission(targetAccountId, scopeNames, redirectUrl);
    }, [requestGooglePermission, targetAccountId]);

    const getCachedScopeCheck = useCallback((scopeNames: string[]) => {
        const cacheKey = scopeNames.sort().join(',');
        return scopeChecks[cacheKey] || null;
    }, [scopeChecks]);

    const hasPermission = useCallback((scopeNames: string[]) => {
        const cached = getCachedScopeCheck(scopeNames);
        return cached?.summary?.allGranted || false;
    }, [getCachedScopeCheck]);

    return {
        loading,
        error,
        checkScopes,
        requestPermission,
        getCachedScopeCheck,
        hasPermission,
        clearError: () => setError(null),
        clearCache: () => setScopeChecks({})
    };
};