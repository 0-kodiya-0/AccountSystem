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
    hasActiveAccounts: () => boolean;
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
    startOAuthSignup: (provider: OAuthProviders, redirectUrl?: string) => void;
    startOAuthSignin: (provider: OAuthProviders, redirectUrl?: string) => void;
    handleOAuthCallback: (params: URLSearchParams) => Promise<void>;

    // Account Management
    fetchAccount: (accountId: string) => Promise<Account>;
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
    requestGooglePermission: (accountId: string, scopes: string[], redirectUrl?: string) => void;
    checkGoogleScopes: (accountId: string, scopes: string[]) => Promise<TokenCheckResponse>;

    // Utilities
    clearError: () => void;
    refreshCurrentAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
    children: ReactNode;
    client: HttpClient;
    autoRefreshAccount?: boolean;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
    children,
    client,
    autoRefreshAccount = true
}) => {
    const {
        // State
        accounts: activeAccounts,
        isLoading,
        isAuthenticating,
        error,
        oauthState,
        hasActiveAccounts,

        getDisabledAccounts,
        accounts: allAccountsFromStore,

        // Actions
        addAccount,
        updateAccount: updateAccountInStore,
        removeAccount,
        clearAccounts,
        setCurrentAccount,
        getCurrentAccount,
        setLoading,
        setAuthenticating,
        setError,
        clearError,
        setOAuthInProgress,
        setOAuthTempToken,
        clearOAuthState,
        isAuthenticated,
        getAccountById,
        
        // Account state management
        disableAccount,
        enableAccount,
        isAccountDisabled
    } = useAccountStore();

    const currentAccount = getCurrentAccount();
    const allAccounts = allAccountsFromStore;
    const disabledAccounts = getDisabledAccounts();

    // Local Authentication Methods
    const localSignup = useCallback(async (data: LocalSignupRequest) => {
        try {
            setAuthenticating(true);
            clearError();

            const result = await client.localSignup(data);

            // Note: Account is created but not automatically logged in
            // User needs to verify email first
            return result;
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Signup failed';
            setError(message);
            throw error;
        } finally {
            setAuthenticating(false);
        }
    }, [client]);

    const localLogin = useCallback(async (data: LocalLoginRequest) => {
        try {
            setAuthenticating(true);
            clearError();

            const result = await client.localLogin(data);

            if (result.requiresTwoFactor) {
                // Set temp token for 2FA flow
                setOAuthTempToken(result.tempToken!);
                return result;
            } else if (result.accountId) {
                // Fetch account details and add to store
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
    }, [client]);

    const verifyTwoFactor = useCallback(async (data: TwoFactorVerifyRequest) => {
        try {
            setAuthenticating(true);
            clearError();

            const result = await client.verifyTwoFactor(data);

            if (result.accountId) {
                // Fetch account details and add to store
                const account = await client.getAccount(result.accountId);
                addAccount(account);
                setCurrentAccount(result.accountId);
                clearOAuthState(); // Clear temp token
            }

            return result;
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : '2FA verification failed';
            setError(message);
            throw error;
        } finally {
            setAuthenticating(false);
        }
    }, [client]);

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
    }, [client]);

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
    }, [client]);

    // OAuth Authentication Methods
    const startOAuthSignup = useCallback((provider: OAuthProviders, redirectUrl?: string) => {
        setOAuthInProgress(provider, redirectUrl);
        client.redirectToOAuthSignup(provider, redirectUrl);
    }, [client]);

    const startOAuthSignin = useCallback((provider: OAuthProviders, redirectUrl?: string) => {
        setOAuthInProgress(provider, redirectUrl);
        client.redirectToOAuthSignin(provider, redirectUrl);
    }, [client]);

    const handleOAuthCallback = useCallback(async (params: URLSearchParams) => {
        try {
            setAuthenticating(true);
            clearError();

            const state = params.get('state');
            const code = params.get('code');
            const error = params.get('error');

            if (error) {
                throw new Error(`OAuth error: ${error}`);
            }

            if (!state || !code) {
                throw new Error('Invalid OAuth callback parameters');
            }

            // The backend should handle the OAuth callback and set cookies
            // We need to determine which account was authenticated

            // Check for success parameters in URL
            const accountId = params.get('accountId');
            if (accountId) {
                const account = await client.getAccount(accountId);
                addAccount(account);
                setCurrentAccount(accountId);

                // Clean up URL
                const url = new URL(window.location.href);
                url.search = '';
                window.history.replaceState({}, '', url.toString());
            }

            clearOAuthState();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'OAuth callback failed';
            setError(message);
            clearOAuthState();
        } finally {
            setAuthenticating(false);
        }
    }, [client]);

    // Account Management Methods
    const fetchAccount = useCallback(async (accountId: string): Promise<Account> => {
        try {
            setLoading(true);
            const account = await client.getAccount(accountId);
            updateAccountInStore(accountId, account);
            return account;
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Failed to fetch account';
            setError(message);
            throw error;
        } finally {
            setLoading(false);
        }
    }, [client]);

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
    }, [client]);

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
    }, [client]);

    const setupTwoFactor = useCallback(async (accountId: string, data: TwoFactorSetupRequest) => {
        try {
            setLoading(true);
            const result = await client.setupTwoFactor(accountId, data);
            // Refresh account to get updated security settings
            await fetchAccount(accountId);
            return result;
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : '2FA setup failed';
            setError(message);
            throw error;
        } finally {
            setLoading(false);
        }
    }, [client]);

    const switchAccount = useCallback((accountId: string) => {
        const account = getAccountById(accountId);
        if (account && !isAccountDisabled(accountId)) {
            setCurrentAccount(accountId);
        }
    }, [getAccountById, isAccountDisabled]);

    const logout = useCallback(async (accountId?: string, clearClientAccountState: boolean = true) => {
        try {
            setLoading(true);
            const targetAccountId = accountId || currentAccount?.id;

            if (targetAccountId) {
                // Always call backend logout
                await client.logout(targetAccountId);

                if (clearClientAccountState) {
                    // Remove account completely from client state
                    removeAccount(targetAccountId);
                } else {
                    // Just disable the account, keep it in state for manual removal
                    disableAccount(targetAccountId);
                }
            }
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Logout failed';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [client, currentAccount?.id, removeAccount, disableAccount]);

    const logoutAll = useCallback(async () => {
        try {
            setLoading(true);
            const accountIds = allAccounts.map(a => a.id);
            await client.logoutAll(accountIds);
            clearAccounts();
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Logout all failed';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [client, allAccounts, clearAccounts]);

    // Google Permissions
    const requestGooglePermission = useCallback((accountId: string, scopes: string[], redirectUrl?: string) => {
        client.requestGooglePermission(accountId, scopes, redirectUrl);
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
    }, [client]);

    // Utilities
    const refreshCurrentAccount = useCallback(async () => {
        if (currentAccount) {
            await fetchAccount(currentAccount.id);
        }
    }, [currentAccount?.id, fetchAccount]);

    // Handle URL parameters for clearClientAccountState
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const clearClientAccountState = params.get('clearClientAccountState');
        const accountId = params.get('accountId');

        if (clearClientAccountState === 'false' && accountId) {
            // Disable the account instead of removing it
            disableAccount(accountId);
            
            // Clean up URL parameters
            const url = new URL(window.location.href);
            url.searchParams.delete('clearClientAccountState');
            url.searchParams.delete('accountId');
            window.history.replaceState({}, '', url.toString());
        }
    }, []);

    // Auto-refresh current account on mount
    useEffect(() => {
        if (autoRefreshAccount && currentAccount && !isLoading) {
            refreshCurrentAccount();
        }
    }, [currentAccount?.id]);

    // Handle OAuth callback on mount
    useEffect(() => {
        const handleOAuthCallbackOnMount = async () => {
            const params = new URLSearchParams(window.location.search);
            if (params.has('state') || params.has('code')) {
                await handleOAuthCallback(params);
            }
        };

        handleOAuthCallbackOnMount();
    }, []);

    const contextValue: AuthContextValue = {
        // Client
        client,

        // State
        accounts: activeAccounts,
        allAccounts,
        disabledAccounts,
        currentAccount,
        isLoading,
        isAuthenticating,
        error,
        isAuthenticated: isAuthenticated(),
        hasActiveAccounts,
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
        handleOAuthCallback,

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

        // Utilities
        clearError,
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