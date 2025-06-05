import React, { createContext, useContext, useEffect, useCallback, ReactNode } from 'react';
import { AuthClient } from '../client/auth-client';
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
    AuthSDKError
} from '../types';

interface AuthContextValue {
    // Client instance
    client: AuthClient;
    
    // Store selectors
    accounts: Account[];
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
    startOAuthSignup: (provider: OAuthProviders, redirectUrl?: string) => void;
    startOAuthSignin: (provider: OAuthProviders, redirectUrl?: string) => void;
    handleOAuthCallback: (params: URLSearchParams) => Promise<void>;
    
    // Account Management
    fetchAccount: (accountId: string) => Promise<Account>;
    updateAccount: (accountId: string, updates: Partial<Account>) => Promise<Account>;
    changePassword: (accountId: string, data: PasswordChangeRequest) => Promise<void>;
    setupTwoFactor: (accountId: string, data: TwoFactorSetupRequest) => Promise<any>;
    switchAccount: (accountId: string) => void;
    logout: (accountId?: string) => Promise<void>;
    logoutAll: () => Promise<void>;
    
    // Google Permissions
    requestGooglePermission: (accountId: string, scopes: string[], redirectUrl?: string) => void;
    checkGoogleScopes: (accountId: string, scopes: string[]) => Promise<any>;
    
    // Utilities
    clearError: () => void;
    refreshCurrentAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
    children: ReactNode;
    client: AuthClient;
    autoRefreshAccount?: boolean;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ 
    children, 
    client, 
    autoRefreshAccount = true 
}) => {
    const {
        // State
        accounts,
        isLoading,
        isAuthenticating,
        error,
        oauthState,
        
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
        getAccountById
    } = useAccountStore();

    const currentAccount = getCurrentAccount();

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
        if (account) {
            setCurrentAccount(accountId);
        }
    }, [getAccountById]);

    const logout = useCallback(async (accountId?: string) => {
        try {
            setLoading(true);
            const targetAccountId = accountId || currentAccount?.id;
            
            if (targetAccountId) {
                await client.logout(targetAccountId);
                removeAccount(targetAccountId);
            }
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Logout failed';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [client, currentAccount?.id]);

    const logoutAll = useCallback(async () => {
        try {
            setLoading(true);
            const accountIds = accounts.map(a => a.id);
            await client.logoutAll(accountIds);
            clearAccounts();
        } catch (error) {
            const message = error instanceof AuthSDKError ? error.message : 'Logout all failed';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [client, accounts]);

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