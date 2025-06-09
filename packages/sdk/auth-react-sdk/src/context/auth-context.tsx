import React, { createContext, useContext, useEffect, useCallback, ReactNode, JSX } from 'react';
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
    TwoFactorSetupResponse,
    GetAccountSessionResponse
} from '../types';

interface AuthContextValue {
    // Client instance
    client: HttpClient;

    // Store selectors
    accounts: Account[];
    currentAccount: Account | null;
    isLoading: boolean;
    isAuthenticating: boolean;
    error: string | null;
    isAuthenticated: boolean;
    hasValidSession: boolean;
    oauthState: {
        isInProgress: boolean;
        provider: OAuthProviders | null;
        redirectUrl: string | null;
        tempToken: string | null;
    };

    // Session Management
    loadSession: () => Promise<GetAccountSessionResponse>;
    refreshSession: () => Promise<void>;
    clearSession: () => void;

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
    switchAccount: (accountId: string) => Promise<void>;
    logout: (accountId?: string) => Promise<void>;
    logoutAll: () => Promise<void>;

    // Google Permissions
    requestGooglePermission: (accountId: string, scopes: string[]) => void;
    checkGoogleScopes: (accountId: string, scopes: string[]) => Promise<TokenCheckResponse>;

    // Data Management
    ensureAccountData: (accountId: string) => Promise<Account>;
    refreshAccountData: (accountId: string) => Promise<Account>;
    prefetchAccountsData: () => Promise<void>;

    // Store actions (exposed for hooks)
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
    autoLoadSession?: boolean;
    prefetchAccountData?: boolean;
}

export const AuthProvider = ({
    children,
    client,
    autoLoadSession = true,
    prefetchAccountData = true
}: AuthProviderProps): JSX.Element | null => {
    const {
        getCurrentAccount,
        getAccounts,
        isLoading,
        isAuthenticating,
        error,
        oauthState,
        hasValidSession,
        isAuthenticated,
        getAccountById,
        hasAccountData,
        needsAccountData,
        getAccountIds,
        getMissingAccountIds,

        // Actions
        setSession,
        clearSession: clearSessionStore,
        setAccountData,
        updateAccountData,
        setLoading,
        setAuthenticating,
        setError,
        clearError,
        setOAuthInProgress,
        setOAuthTempToken,
        clearOAuthState,
    } = useAccountStore();

    // Get current data
    const currentAccount = getCurrentAccount();
    const accounts = getAccounts();

    // Load session from backend
    const loadSession = useCallback(async (): Promise<GetAccountSessionResponse> => {
        try {
            setLoading(true);
            clearError();

            const sessionResponse = await client.getAccountSession();

            // Update session in store
            setSession(sessionResponse.session);

            // If session includes account data, populate the store
            if (sessionResponse.accounts) {
                sessionResponse.accounts.forEach(account => {
                    setAccountData(account.id, account);
                });
            }

            return sessionResponse;
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Failed to load session';
            setError(message);

            // Clear session on error
            clearSessionStore();
            throw error;
        } finally {
            setLoading(false);
        }
    }, [client, setSession, setAccountData, setLoading, setError, clearError, clearSessionStore]);

    // Refresh session and account data
    const refreshSession = useCallback(async (): Promise<void> => {
        await loadSession();

        // Prefetch any missing account data
        if (prefetchAccountData) {
            await prefetchAccountsData();
        }
    }, [loadSession, prefetchAccountData]);

    // Clear session
    const clearSession = useCallback(() => {
        clearSessionStore();
    }, [clearSessionStore]);

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
        const missingAccountIds = getMissingAccountIds();

        if (missingAccountIds.length === 0) return;

        try {
            setLoading(true);
            await Promise.all(
                missingAccountIds.map(id => ensureAccountData(id))
            );
        } catch (error) {
            console.warn('Some account data could not be prefetched:', error);
        } finally {
            setLoading(false);
        }
    }, [getMissingAccountIds, ensureAccountData, setLoading]);

    // Local Authentication Methods
    const localSignup = useCallback(async (data: LocalSignupRequest) => {
        try {
            setAuthenticating(true);
            clearError();

            const result = await client.localSignup(data);

            // Refresh session after signup to get updated state
            await refreshSession();

            return result;
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Signup failed';
            setError(message);
            throw error;
        } finally {
            setAuthenticating(false);
        }
    }, [client, setAuthenticating, clearError, setError, refreshSession]);

    const localLogin = useCallback(async (data: LocalLoginRequest) => {
        try {
            setAuthenticating(true);
            clearError();

            const result = await client.localLogin(data);

            if (result.requiresTwoFactor) {
                setOAuthTempToken(result.tempToken!);
                return result;
            } else {
                // Refresh session after successful login
                await refreshSession();
            }

            return result;
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Login failed';
            setError(message);
            throw error;
        } finally {
            setAuthenticating(false);
        }
    }, [client, setAuthenticating, clearError, setError, setOAuthTempToken, refreshSession]);

    const verifyTwoFactor = useCallback(async (data: TwoFactorVerifyRequest) => {
        try {
            setAuthenticating(true);
            clearError();

            const result = await client.verifyTwoFactor(data);

            if (result.accountId) {
                clearOAuthState();
                // Refresh session after successful 2FA
                await refreshSession();
            }

            return result;
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : '2FA verification failed';
            setError(message);
            throw error;
        } finally {
            setAuthenticating(false);
        }
    }, [client, setAuthenticating, clearError, setError, clearOAuthState, refreshSession]);

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
            updateAccountData(accountId, updatedAccount);
            return updatedAccount;
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Failed to update account';
            setError(message);
            throw error;
        } finally {
            setLoading(false);
        }
    }, [client, updateAccountData, setLoading, setError]);

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
        try {
            setLoading(true);

            // Update current account in backend session
            await client.setCurrentAccountInSession(accountId);

            // Refresh session to get updated state
            await refreshSession();

            // Ensure we have the account data
            if (needsAccountData(accountId)) {
                await ensureAccountData(accountId);
            }
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Failed to switch account';
            setError(message);
            throw error;
        } finally {
            setLoading(false);
        }
    }, [client, refreshSession, needsAccountData, ensureAccountData, setLoading, setError]);

    const logout = useCallback(async (accountId?: string) => {
        try {
            setLoading(true);
            const targetAccountId = accountId || currentAccount?.id;

            if (targetAccountId) {
                await client.logout(targetAccountId);
                // The backend will handle session updates via callback
            } else {
                throw new Error('No account ID provided and no current account found');
            }
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Logout failed';
            setError(message);
            setLoading(false);
        }
    }, [client, currentAccount?.id, setLoading, setError]);

    const logoutAll = useCallback(async () => {
        try {
            setLoading(true);
            const accountIds = getAccountIds();

            if (accountIds.length === 0) {
                throw new Error('No active accounts to logout');
            }

            await client.logoutAll(accountIds);
            // The backend will handle session updates via callback
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Logout all failed';
            setError(message);
            setLoading(false);
        }
    }, [client, getAccountIds, setLoading, setError]);

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

    // Auto-load session on mount
    useEffect(() => {
        if (autoLoadSession) {
            loadSession().catch(console.warn);
        }
    }, []); // Only run on mount

    const contextValue: AuthContextValue = {
        // Client
        client,

        // State
        accounts,
        currentAccount,
        isLoading,
        isAuthenticating,
        error,
        isAuthenticated: isAuthenticated(),
        hasValidSession: hasValidSession(),
        oauthState,

        // Session Management
        loadSession,
        refreshSession,
        clearSession,

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

        // Google Permissions
        requestGooglePermission,
        checkGoogleScopes,

        // Data Management
        ensureAccountData,
        refreshAccountData,
        prefetchAccountsData,

        // Store actions (exposed for hooks)
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