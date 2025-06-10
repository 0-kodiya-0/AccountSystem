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
    GetAccountSessionResponse,
    LoadingInfo
} from '../types';
import { useLoading } from '../hooks/useLoading';

interface AuthContextValue {
    // Client instance
    client: HttpClient;

    // Store selectors
    accounts: Account[];
    currentAccount: Account | null;
    isAuthenticated: boolean;
    hasValidSession: boolean;
    tempToken: string | null;

    // Three-state loading info (NEW)
    loadingInfo: LoadingInfo;
    isReady: boolean;
    isPending: boolean;
    hasError: boolean;

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
    setTempToken: (tempToken: string) => void;
    clearTempToken: () => void;

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
        tempToken,
        hasValidSession,
        isAuthenticated,
        getAccountById,
        hasFullAccountData,
        needsAccountData,
        getAccountIds,
        getMissingAccountIds,

        // Actions
        setSession,
        clearSession: clearSessionStore,
        setAccountData,
        setSessionAccountData,
        updateAccountData,
        setTempToken,
        clearTempToken,
    } = useAccountStore();

    // Loading management using reusable hook (NEW)
    const {
        loadingInfo,
        isPending,
        isReady,
        hasError,
        updateLoadingReason,
        setPending,
        setReady,
        setError
    } = useLoading();

    // Get current data
    const currentAccount = getCurrentAccount();
    const accounts = getAccounts();

    // Load session from backend
    const loadSession = useCallback(async (): Promise<GetAccountSessionResponse> => {
        try {
            setPending('Loading authentication session');

            const sessionResponse = await client.getAccountSession();

            // Update session in store
            setSession(sessionResponse.session);

            // If session includes account data, populate the store with session account data
            // This is minimal data - full account data will be fetched separately when needed
            if (sessionResponse.accounts) {
                updateLoadingReason('Processing account data');
                sessionResponse.accounts.forEach(partialAccount => {
                    setSessionAccountData(partialAccount.id!, partialAccount);
                });
            }

            setReady('Authentication session loaded successfully');
            return sessionResponse;
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Failed to load session';
            setError(message);

            // Clear session on error
            clearSessionStore();
            throw error;
        }
    }, [client, setSession, setSessionAccountData, setError, clearSessionStore, updateLoadingReason]);

    // Smart account data fetching - now differentiates between session data and full account data
    const ensureAccountData = useCallback(async (accountId: string): Promise<Account> => {
        // If we already have full account data, return it
        const existingAccount = getAccountById(accountId);
        if (existingAccount && hasFullAccountData(accountId)) {
            return existingAccount;
        }

        // Otherwise fetch full account data
        try {
            updateLoadingReason(`Loading account data for ${accountId}`);
            const account = await client.getAccount(accountId);
            setAccountData(accountId, account);
            return account;
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Failed to fetch account data';
            setError(message);
            throw error;
        }
    }, [client, getAccountById, hasFullAccountData, setAccountData, setError, updateLoadingReason]);

    // Refresh session and account data
    const refreshSession = useCallback(async (): Promise<void> => {
        setPending('Refreshing authentication session');

        try {
            await loadSession();

            // Prefetch any missing account data
            if (prefetchAccountData) {
                updateLoadingReason('Prefetching account data');
                await prefetchAccountsData();
            }

            setReady('Session refresh completed');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to refresh session';
            setError(message);
            throw error;
        }
    }, [loadSession, prefetchAccountData, updateLoadingReason]);

    // Clear session
    const clearSession = useCallback(() => {
        clearSessionStore();
        setReady('Session cleared');
    }, [clearSessionStore]);

    const refreshAccountData = useCallback(async (accountId: string): Promise<Account> => {
        try {
            updateLoadingReason(`Refreshing account data for ${accountId}`);
            const account = await client.getAccount(accountId);
            setAccountData(accountId, account);
            return account;
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Failed to refresh account data';
            setError(message);
            throw error;
        }
    }, [client, setAccountData, setError, updateLoadingReason]);

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
            updateLoadingReason(`Prefetching data for ${missingAccountIds.length} accounts`);

            await Promise.all(
                missingAccountIds.map(id => ensureAccountData(id))
            );
        } catch (error) {
            console.warn('Some account data could not be prefetched:', error);
        }
    }, [getMissingAccountIds, ensureAccountData, updateLoadingReason]);

    // Local Authentication Methods
    const localSignup = useCallback(async (data: LocalSignupRequest) => {
        try {
            setPending('Creating new account');
            const result = await client.localSignup(data);

            // Refresh session after signup to get updated state
            updateLoadingReason('Finalizing account setup');
            await refreshSession();

            return result;
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Signup failed';
            setError(message);
            throw error;
        }
    }, [client, setError, refreshSession, updateLoadingReason]);

    const localLogin = useCallback(async (data: LocalLoginRequest) => {
        try {
            setPending('Authenticating user');

            const result = await client.localLogin(data);

            if (result.requiresTwoFactor) {
                setTempToken(result.tempToken!);
                setReady('Two-factor authentication required');
                return result;
            } else {
                // Refresh session after successful login
                updateLoadingReason('Finalizing authentication');
                await refreshSession();
            }

            return result;
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Login failed';
            setError(message);
            throw error;
        }
    }, [client, setError, setTempToken, refreshSession, updateLoadingReason]);

    const verifyTwoFactor = useCallback(async (data: TwoFactorVerifyRequest) => {
        try {
            setPending('Verifying two-factor authentication');

            const result = await client.verifyTwoFactor(data);

            if (result.accountId) {
                clearTempToken();
                // Refresh session after successful 2FA
                updateLoadingReason('Finalizing two-factor authentication');
                await refreshSession();
            }

            return result;
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : '2FA verification failed';
            setError(message);
            throw error;
        }
    }, [client, setError, clearTempToken, refreshSession, updateLoadingReason]);

    const requestPasswordReset = useCallback(async (email: string) => {
        try {
            setPending('Sending password reset email');

            await client.requestPasswordReset({ email });
            setReady('Password reset email sent');
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Password reset request failed';
            setError(message);
            throw error;
        }
    }, [client, setError]);

    const resetPassword = useCallback(async (token: string, data: ResetPasswordRequest) => {
        try {
            setPending('Resetting password');

            await client.resetPassword(token, data);
            setReady('Password reset successfully');
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Password reset failed';
            setError(message);
            throw error;
        }
    }, [client, setError]);

    // OAuth methods
    const startOAuthSignup = useCallback((provider: OAuthProviders) => {
        setPending(`Redirecting to ${provider} for signup`);
        client.redirectToOAuthSignup(provider);
    }, [client]);

    const startOAuthSignin = useCallback((provider: OAuthProviders) => {
        setPending(`Redirecting to ${provider} for signin`);
        client.redirectToOAuthSignin(provider);
    }, [client]);

    // Account Management Methods
    const updateAccount = useCallback(async (accountId: string, updates: Partial<Account>): Promise<Account> => {
        try {
            updateLoadingReason(`Updating account ${accountId}`);

            const updatedAccount = await client.updateAccount(accountId, updates);
            updateAccountData(accountId, updatedAccount);
            return updatedAccount;
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Failed to update account';
            setError(message);
            throw error;
        }
    }, [client, updateAccountData, setError, updateLoadingReason]);

    const changePassword = useCallback(async (accountId: string, data: PasswordChangeRequest) => {
        try {
            updateLoadingReason('Changing password');
            await client.changePassword(accountId, data);
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Password change failed';
            setError(message);
            throw error;
        }
    }, [client, setError, updateLoadingReason]);

    const setupTwoFactor = useCallback(async (accountId: string, data: TwoFactorSetupRequest) => {
        try {
            updateLoadingReason('Setting up two-factor authentication');

            const result = await client.setupTwoFactor(accountId, data);
            // Refresh account to get updated security settings
            await refreshAccountData(accountId);
            return result;
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : '2FA setup failed';
            setError(message);
            throw error;
        }
    }, [client, refreshAccountData, setError, updateLoadingReason]);

    const switchAccount = useCallback(async (accountId: string) => {
        try {
            setPending(`Switching to account ${accountId}`);

            // Update current account in backend session
            await client.setCurrentAccountInSession(accountId);

            // Refresh session to get updated state
            updateLoadingReason('Updating session');
            await refreshSession();

            // Ensure we have the account data
            if (needsAccountData(accountId)) {
                updateLoadingReason('Loading account data');
                await ensureAccountData(accountId);
            }

            setReady('Account switched successfully');
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Failed to switch account';
            setError(message);
            throw error;
        }
    }, [client, refreshSession, needsAccountData, ensureAccountData, setError, updateLoadingReason]);

    const logout = useCallback(async (accountId?: string) => {
        try {
            setPending('Logging out');

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
        }
    }, [client, currentAccount?.id, setError]);

    const logoutAll = useCallback(async () => {
        try {
            setPending('Logging out all accounts');

            const accountIds = getAccountIds();

            if (accountIds.length === 0) {
                throw new Error('No active accounts to logout');
            }

            await client.logoutAll(accountIds);
            // The backend will handle session updates via callback
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Logout all failed';
            setError(message);
        }
    }, [client, getAccountIds, setError]);

    // Google Permissions
    const requestGooglePermission = useCallback((accountId: string, scopes: string[]) => {
        setPending('Requesting Google permissions');
        client.requestGooglePermission(accountId, scopes);
    }, [client]);

    const checkGoogleScopes = useCallback(async (accountId: string, scopes: string[]) => {
        try {
            updateLoadingReason('Checking Google permissions');
            return await client.checkGoogleScopes(accountId, scopes);
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Failed to check scopes';
            setError(message);
            throw error;
        }
    }, [client, setError, updateLoadingReason]);

    // Utilities
    const refreshCurrentAccount = useCallback(async () => {
        if (currentAccount) {
            await refreshAccountData(currentAccount.id);
        }
    }, [currentAccount?.id, refreshAccountData]);

    // Auto-load session on mount with proper state management
    useEffect(() => {
        if (autoLoadSession) {
            loadSession().catch(error => {
                console.warn('Auto-load session failed:', error);
                setError('Failed to initialize authentication');
            });
        } else {
            // If not auto-loading, set to ready immediately
            setReady('Authentication system ready');
        }
    }, []); // Only run on mount

    const contextValue: AuthContextValue = {
        // Client
        client,

        // State
        accounts,
        currentAccount,
        isAuthenticated: isAuthenticated(),
        hasValidSession: hasValidSession(),
        tempToken,

        // Three-state loading info (NEW)
        loadingInfo,
        isReady,
        isPending,
        hasError,

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
        setTempToken,
        clearTempToken,

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