import React, { createContext, useContext, useEffect, useCallback, ReactNode } from 'react';
import { HttpClient } from '../client/http-client';
import { useAccountStore } from '../store/account-store';
import {
    Account,
    LocalSignupRequest,
    LocalLoginRequest,
    LocalLoginResponse,
    TwoFactorVerifyRequest,
    ResetPasswordRequest,
    PasswordChangeRequest,
    TwoFactorSetupRequest,
    OAuthProviders,
    AuthSDKError,
    TokenCheckResponse,
    TwoFactorSetupResponse
} from '../types';

interface AuthContextValue {
    // Client instance
    client: HttpClient;

    // Store selectors
    accounts: Account[];
    allAccounts: Account[];
    disabledAccounts: Account[];
    currentAccount: Account | null;
    isLoading: boolean;
    isAuthenticating: boolean;
    error: string | null;
    isAuthenticated: boolean;
    oauthState: {
        isInProgress: boolean;
        provider: OAuthProviders | null;
        redirectUrl: string | null;
        tempToken: string | null;
    };

    // Local Authentication
    localSignup: (data: LocalSignupRequest) => Promise<{ accountId: string }>;
    localLogin: (data: LocalLoginRequest) => Promise<LocalLoginResponse>;
    verifyTwoFactor: (data: TwoFactorVerifyRequest) => Promise<LocalLoginResponse>;
    requestPasswordReset: (email: string) => Promise<void>;
    resetPassword: (token: string, data: ResetPasswordRequest) => Promise<void>;

    // OAuth Authentication
    startOAuthSignup: (provider: OAuthProviders) => void;
    startOAuthSignin: (provider: OAuthProviders) => void;

    // Account Management
    fetchAccount: (accountId: string, force?: boolean) => Promise<Account>;
    updateAccount: (accountId: string, updates: Partial<Account>) => Promise<Account>;
    changePassword: (accountId: string, data: PasswordChangeRequest) => Promise<void>;
    setupTwoFactor: (accountId: string, data: TwoFactorSetupRequest) => Promise<TwoFactorSetupResponse>;
    switchAccount: (accountId: string) => void;
    logout: (accountId?: string, clearClientAccountState?: boolean) => Promise<void>;
    logoutAll: () => Promise<void>;

    // Account State Management
    disableAccount: (accountId: string) => void;
    enableAccount: (accountId: string) => void;
    removeAccount: (accountId: string) => void;
    isAccountDisabled: (accountId: string) => boolean;

    // Google Permissions
    requestGooglePermission: (accountId: string, scopes: string[]) => void;
    checkGoogleScopes: (accountId: string, scopes: string[]) => Promise<TokenCheckResponse>;

    // Data Management
    ensureAccountData: (accountId: string) => Promise<Account>;
    refreshAccountData: (accountId: string) => Promise<Account>;
    prefetchAccountsData: () => Promise<void>;

    // Store actions (exposed for hooks)
    addAccount: (account: Account) => void;
    setCurrentAccount: (accountId: string | null) => void;
    setOAuthTempToken: (tempToken: string) => void;
    clearOAuthState: () => void;
    setAuthenticating: (authenticating: boolean) => void;
    setError: (error: string | null) => void;
    clearError: () => void;
    setLoading: (loading: boolean) => void;

    // Utilities
    refreshCurrentAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
    children: ReactNode;
    client: HttpClient;
    autoFetchAccountData?: boolean;
    prefetchOnMount?: boolean;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
    children,
    client,
    autoFetchAccountData = true,
    prefetchOnMount = true
}) => {
    const {
        // State selectors
        getActiveAccounts,
        getAccounts,
        getDisabledAccounts,
        getCurrentAccount,
        isLoading,
        isAuthenticating,
        error,
        oauthState,
        hasActiveAccounts,
        isAuthenticated,
        getAccountById,
        hasAccountData,
        needsAccountData,
        getActiveAccountIds,

        // Actions
        addAccount,
        setAccountData,
        updateAccount: updateAccountInStore,
        removeAccount,
        setCurrentAccount,
        setLoading,
        setAuthenticating,
        setError,
        clearError,
        setOAuthInProgress,
        setOAuthTempToken,
        clearOAuthState,

        // Account state management
        disableAccount,
        enableAccount,
        isAccountDisabled
    } = useAccountStore();

    // Get current data
    const currentAccount = getCurrentAccount();
    const accounts = getActiveAccounts();
    const allAccounts = getAccounts();
    const disabledAccounts = getDisabledAccounts();

    // Smart account data fetching
    const ensureAccountData = useCallback(async (accountId: string): Promise<Account> => {
        // If we already have the data, return it
        if (hasAccountData(accountId)) {
            return getAccountById(accountId)!;
        }

        // Otherwise fetch it
        try {
            const account = await client.getAccount(accountId);
            setAccountData(accountId, account);
            return account;
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Failed to fetch account data';
            setError(message);
            throw error;
        }
    }, [client, hasAccountData, getAccountById, setAccountData, setError]);

    const refreshAccountData = useCallback(async (accountId: string): Promise<Account> => {
        try {
            const account = await client.getAccount(accountId);
            setAccountData(accountId, account);
            return account;
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Failed to refresh account data';
            setError(message);
            throw error;
        }
    }, [client, setAccountData, setError]);

    const fetchAccount = useCallback(async (accountId: string, force: boolean = false): Promise<Account> => {
        if (force) {
            return refreshAccountData(accountId);
        } else {
            return ensureAccountData(accountId);
        }
    }, [ensureAccountData, refreshAccountData]);

    const prefetchAccountsData = useCallback(async () => {
        const activeAccountIds = getActiveAccountIds();
        const missingDataIds = activeAccountIds.filter(id => needsAccountData(id));

        if (missingDataIds.length === 0) return;

        try {
            setLoading(true);
            await Promise.all(
                missingDataIds.map(id => ensureAccountData(id))
            );
        } catch (error) {
            // Individual account fetches will handle their own errors
            console.warn('Some account data could not be prefetched:', error);
        } finally {
            setLoading(false);
        }
    }, [getActiveAccountIds, needsAccountData, ensureAccountData, setLoading]);

    // Local Authentication Methods
    const localSignup = useCallback(async (data: LocalSignupRequest) => {
        try {
            setAuthenticating(true);
            clearError();

            const result = await client.localSignup(data);
            return result;
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Signup failed';
            setError(message);
            throw error;
        } finally {
            setAuthenticating(false);
        }
    }, [client, setAuthenticating, clearError, setError]);

    const localLogin = useCallback(async (data: LocalLoginRequest) => {
        try {
            setAuthenticating(true);
            clearError();

            const result = await client.localLogin(data);

            if (result.requiresTwoFactor) {
                setOAuthTempToken(result.tempToken!);
                return result;
            } else if (result.accountId) {
                // Add account ID and fetch data
                const account = await client.getAccount(result.accountId);
                addAccount(account);
                setCurrentAccount(result.accountId);
            }

            return result;
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Login failed';
            setError(message);
            throw error;
        } finally {
            setAuthenticating(false);
        }
    }, [client, setAuthenticating, clearError, setError, setOAuthTempToken, addAccount, setCurrentAccount]);

    const verifyTwoFactor = useCallback(async (data: TwoFactorVerifyRequest) => {
        try {
            setAuthenticating(true);
            clearError();

            const result = await client.verifyTwoFactor(data);

            if (result.accountId) {
                const account = await client.getAccount(result.accountId);
                addAccount(account);
                setCurrentAccount(result.accountId);
                clearOAuthState();
            }

            return result;
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : '2FA verification failed';
            setError(message);
            throw error;
        } finally {
            setAuthenticating(false);
        }
    }, [client, setAuthenticating, clearError, setError, addAccount, setCurrentAccount, clearOAuthState]);

    const requestPasswordReset = useCallback(async (email: string) => {
        try {
            setLoading(true);
            clearError();
            await client.requestPasswordReset({ email });
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Password reset request failed';
            setError(message);
            throw error;
        } finally {
            setLoading(false);
        }
    }, [client, setLoading, clearError, setError]);

    const resetPassword = useCallback(async (token: string, data: ResetPasswordRequest) => {
        try {
            setLoading(true);
            clearError();
            await client.resetPassword(token, data);
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Password reset failed';
            setError(message);
            throw error;
        } finally {
            setLoading(false);
        }
    }, [client, setLoading, clearError, setError]);

    // OAuth methods
    const startOAuthSignup = useCallback((provider: OAuthProviders) => {
        setOAuthInProgress(provider);
        client.redirectToOAuthSignup(provider);
    }, [client, setOAuthInProgress]);

    const startOAuthSignin = useCallback((provider: OAuthProviders) => {
        setOAuthInProgress(provider);
        client.redirectToOAuthSignin(provider);
    }, [client, setOAuthInProgress]);

    // Account Management Methods
    const updateAccount = useCallback(async (accountId: string, updates: Partial<Account>): Promise<Account> => {
        try {
            setLoading(true);
            const updatedAccount = await client.updateAccount(accountId, updates);
            updateAccountInStore(accountId, updatedAccount);
            return updatedAccount;
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Failed to update account';
            setError(message);
            throw error;
        } finally {
            setLoading(false);
        }
    }, [client, updateAccountInStore, setLoading, setError]);

    const changePassword = useCallback(async (accountId: string, data: PasswordChangeRequest) => {
        try {
            setLoading(true);
            await client.changePassword(accountId, data);
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Password change failed';
            setError(message);
            throw error;
        } finally {
            setLoading(false);
        }
    }, [client, setLoading, setError]);

    const setupTwoFactor = useCallback(async (accountId: string, data: TwoFactorSetupRequest) => {
        try {
            setLoading(true);
            const result = await client.setupTwoFactor(accountId, data);
            // Refresh account to get updated security settings
            await refreshAccountData(accountId);
            return result;
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : '2FA setup failed';
            setError(message);
            throw error;
        } finally {
            setLoading(false);
        }
    }, [client, refreshAccountData, setLoading, setError]);

    const switchAccount = useCallback(async (accountId: string) => {
        if (isAccountDisabled(accountId)) return;

        setCurrentAccount(accountId);

        // Ensure we have the account data
        if (autoFetchAccountData && needsAccountData(accountId)) {
            try {
                await ensureAccountData(accountId);
            } catch (error) {
                console.warn('Failed to fetch account data when switching:', error);
            }
        }
    }, [isAccountDisabled, setCurrentAccount, autoFetchAccountData, needsAccountData, ensureAccountData]);

    /**
     * Logout a single account
     * @param accountId - The account to logout (defaults to current account)
     * @param clearClientAccountState - Whether to remove from client or just disable (default: true)
     */
    const logout = useCallback(async (accountId?: string, clearClientAccountState: boolean = true) => {
        try {
            setLoading(true);
            const targetAccountId = accountId || currentAccount?.id;

            if (targetAccountId) {
                // Use the HTTP client's logout method which handles the redirect to backend
                await client.logout(targetAccountId, clearClientAccountState);

                // Note: The actual account removal/disabling will be handled by the callback
                // after the backend redirects to /auth/callback with the appropriate callback code
            } else {
                throw new Error('No account ID provided and no current account found');
            }
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Logout failed';
            setError(message);
            setLoading(false); // Reset loading state on error
        }
        // Note: Don't set loading to false on success since we're redirecting
    }, [client, currentAccount?.id, setLoading, setError]);

    /**
     * Logout all active accounts
     */
    const logoutAll = useCallback(async () => {
        try {
            setLoading(true);
            const accountIds = getActiveAccountIds();
            
            if (accountIds.length === 0) {
                throw new Error('No active accounts to logout');
            }

            // Use the HTTP client's logoutAll method which handles the redirect to backend
            await client.logoutAll(accountIds);
            
            // Note: The actual account clearing will be handled by the callback
            // after the backend redirects to /auth/callback with the appropriate callback code
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Logout all failed';
            setError(message);
            setLoading(false); // Reset loading state on error
        }
        // Note: Don't set loading to false on success since we're redirecting
    }, [client, getActiveAccountIds, setLoading, setError]);

    // Google Permissions
    const requestGooglePermission = useCallback((accountId: string, scopes: string[]) => {
        client.requestGooglePermission(accountId, scopes);
    }, [client]);

    const checkGoogleScopes = useCallback(async (accountId: string, scopes: string[]) => {
        try {
            setLoading(true);
            return await client.checkGoogleScopes(accountId, scopes);
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Failed to check scopes';
            setError(message);
            throw error;
        } finally {
            setLoading(false);
        }
    }, [client, setLoading, setError]);

    // Utilities
    const refreshCurrentAccount = useCallback(async () => {
        if (currentAccount) {
            await refreshAccountData(currentAccount.id);
        }
    }, [currentAccount?.id, refreshAccountData]);

    // Auto-prefetch account data on mount
    useEffect(() => {
        if (prefetchOnMount && hasActiveAccounts()) {
            prefetchAccountsData();
        }
    }, []); // Only run on mount

    // Auto-fetch current account data if missing
    useEffect(() => {
        if (autoFetchAccountData && currentAccount && needsAccountData(currentAccount.id)) {
            ensureAccountData(currentAccount.id);
        }
    }, [currentAccount?.id, autoFetchAccountData]);

    const contextValue: AuthContextValue = {
        // Client
        client,

        // State
        accounts,
        allAccounts,
        disabledAccounts,
        currentAccount,
        isLoading,
        isAuthenticating,
        error,
        isAuthenticated: isAuthenticated(),
        oauthState,

        // Local Auth
        localSignup,
        localLogin,
        verifyTwoFactor,
        requestPasswordReset,
        resetPassword,

        // OAuth Auth
        startOAuthSignup,
        startOAuthSignin,

        // Account Management
        fetchAccount,
        updateAccount,
        changePassword,
        setupTwoFactor,
        switchAccount,
        logout,
        logoutAll,

        // Account State Management
        disableAccount,
        enableAccount,
        removeAccount,
        isAccountDisabled,

        // Google Permissions
        requestGooglePermission,
        checkGoogleScopes,

        // Data Management
        ensureAccountData,
        refreshAccountData,
        prefetchAccountsData,

        // Store actions (exposed for hooks)
        addAccount,
        setCurrentAccount,
        setOAuthTempToken,
        clearOAuthState,
        setAuthenticating,
        setError,
        clearError,
        setLoading,

        // Utilities
        refreshCurrentAccount
    };

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextValue => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};