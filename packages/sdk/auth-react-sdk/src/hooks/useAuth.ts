import { useCallback, useEffect } from 'react';
import { useAuthCore } from './core/useAuthCore';
import { useServices } from './core/useServices';
import { useLoading } from './useLoading';
import {
  LocalSignupRequest,
  LocalLoginRequest,
  LocalLoginResponse,
  TwoFactorVerifyRequest,
  ResetPasswordRequest,
  OAuthProviders,
  AuthSDKError,
  GetAccountSessionResponse,
  LoadingState,
} from '../types';

export const useAuth = () => {
  const store = useAuthCore();
  const { authService } = useServices();

  const {
    loadingInfo,
    isPending,
    isReady,
    hasError,
    setPending,
    setReady,
    setError,
    updateLoadingReason,
  } = useLoading({
    initialState: LoadingState.PENDING,
    initialReason: 'Initializing authentication',
  });

  // Session Management - useCallback to prevent unnecessary re-renders
  const loadSession =
    useCallback(async (): Promise<GetAccountSessionResponse> => {
      try {
        setPending('Loading authentication session');
        store.clearError('session');

        const sessionResponse = await authService.getAccountSession();

        updateLoadingReason('Processing session data');
        store.setSession(sessionResponse.session);

        if (sessionResponse.accounts) {
          updateLoadingReason('Loading account data');
          sessionResponse.accounts.forEach((account) => {
            store.setSessionAccountData(account.id, account);
          });
        }

        setReady('Authentication session loaded successfully');
        return sessionResponse;
      } catch (error) {
        const message =
          error instanceof AuthSDKError
            ? error.message
            : 'Failed to load session';
        setError(message);
        store.setError('session', message);
        store.clearSession();
        throw error;
      }
    }, [
      authService,
      store.clearError,
      store.setSession,
      store.setSessionAccountData,
      store.setError,
      store.clearSession,
      setPending,
      setReady,
      setError,
      updateLoadingReason,
    ]);

  const refreshSession = useCallback(async (): Promise<void> => {
    await loadSession();
  }, [loadSession]); // Only depends on loadSession

  const clearSession = useCallback(() => {
    store.clearSession();
    setReady('Session cleared');
  }, [store.clearSession, setReady]); // Stable functions

  // Authentication Actions
  const localSignup = useCallback(
    async (data: LocalSignupRequest) => {
      try {
        setPending('Creating new account');
        store.clearError('signup');

        const result = await authService.localSignup(data);

        updateLoadingReason('Finalizing account setup');
        await refreshSession();

        setReady('Account created successfully');
        return result;
      } catch (error) {
        const message =
          error instanceof AuthSDKError ? error.message : 'Signup failed';
        setError(message);
        store.setError('signup', message);
        throw error;
      }
    },
    [
      authService,
      store.clearError,
      store.setError,
      setPending,
      setReady,
      setError,
      updateLoadingReason,
      refreshSession,
    ],
  );

  const localLogin = useCallback(
    async (data: LocalLoginRequest): Promise<LocalLoginResponse> => {
      try {
        setPending('Authenticating user');
        store.clearError('login');

        const result = await authService.localLogin(data);

        if (result.requiresTwoFactor) {
          store.setTempToken(result.tempToken!);
          setReady('Two-factor authentication required');
          return result;
        } else {
          updateLoadingReason('Finalizing authentication');
          await refreshSession();
          setReady('Authentication successful');
        }

        return result;
      } catch (error) {
        const message =
          error instanceof AuthSDKError ? error.message : 'Login failed';
        setError(message);
        store.setError('login', message);
        throw error;
      }
    },
    [
      authService,
      store.clearError,
      store.setError,
      store.setTempToken,
      setPending,
      setReady,
      setError,
      updateLoadingReason,
      refreshSession,
    ],
  );

  const verifyTwoFactor = useCallback(
    async (data: TwoFactorVerifyRequest): Promise<LocalLoginResponse> => {
      try {
        setPending('Verifying two-factor authentication');
        store.clearError('2fa');

        const result = await authService.verifyTwoFactor(data);

        if (result.accountId) {
          store.clearTempToken();
          updateLoadingReason('Finalizing two-factor authentication');
          await refreshSession();
          setReady('Two-factor verification successful');
        }

        return result;
      } catch (error) {
        const message =
          error instanceof AuthSDKError
            ? error.message
            : '2FA verification failed';
        setError(message);
        store.setError('2fa', message);
        throw error;
      }
    },
    [
      authService,
      store.clearError,
      store.setError,
      store.clearTempToken,
      setPending,
      setReady,
      setError,
      updateLoadingReason,
      refreshSession,
    ],
  );

  const requestPasswordReset = useCallback(
    async (email: string) => {
      try {
        setPending('Sending password reset email');
        store.clearError('password-reset');

        await authService.requestPasswordReset({ email });
        setReady('Password reset email sent');
      } catch (error) {
        const message =
          error instanceof AuthSDKError
            ? error.message
            : 'Password reset request failed';
        setError(message);
        store.setError('password-reset', message);
        throw error;
      }
    },
    [
      authService,
      store.clearError,
      store.setError,
      setPending,
      setReady,
      setError,
    ],
  );

  const resetPassword = useCallback(
    async (token: string, data: ResetPasswordRequest) => {
      try {
        setPending('Resetting password');
        store.clearError('password-reset');

        await authService.resetPassword(token, data);
        setReady('Password reset successfully');
      } catch (error) {
        const message =
          error instanceof AuthSDKError
            ? error.message
            : 'Password reset failed';
        setError(message);
        store.setError('password-reset', message);
        throw error;
      }
    },
    [
      authService,
      store.clearError,
      store.setError,
      setPending,
      setReady,
      setError,
    ],
  );

  const switchAccount = useCallback(
    async (accountId: string) => {
      try {
        setPending(`Switching to account ${accountId}`);
        store.clearError('switch-account');

        await authService.setCurrentAccountInSession(accountId);

        updateLoadingReason('Updating session');
        await refreshSession();

        setReady('Account switched successfully');
      } catch (error) {
        const message =
          error instanceof AuthSDKError
            ? error.message
            : 'Failed to switch account';
        setError(message);
        store.setError('switch-account', message);
        throw error;
      }
    },
    [
      authService,
      store.clearError,
      store.setError,
      setPending,
      setReady,
      setError,
      updateLoadingReason,
      refreshSession,
    ],
  );

  const logout = useCallback(
    async (accountId?: string) => {
      try {
        setPending('Logging out');
        store.clearError('logout');

        const targetAccountId = accountId || store.currentAccountId;

        if (targetAccountId) {
          authService.logout(targetAccountId);
          // The backend will handle session updates via callback
        } else {
          throw new Error(
            'No account ID provided and no current account found',
          );
        }
      } catch (error) {
        const message =
          error instanceof AuthSDKError ? error.message : 'Logout failed';
        setError(message);
        store.setError('logout', message);
      }
    },
    [
      authService,
      store.clearError,
      store.setError,
      store.currentAccountId, // This is a computed value that can change
      setPending,
      setError,
    ],
  );

  const logoutAll = useCallback(async () => {
    try {
      setPending('Logging out all accounts');
      store.clearError('logout-all');

      const accountIds = store.accountIds;

      if (accountIds.length === 0) {
        throw new Error('No active accounts to logout');
      }

      authService.logoutAll(accountIds);
      // The backend will handle session updates via callback
    } catch (error) {
      const message =
        error instanceof AuthSDKError ? error.message : 'Logout all failed';
      setError(message);
      store.setError('logout-all', message);
    }
  }, [
    authService,
    store.clearError,
    store.setError,
    store.accountIds, // This is a computed value that can change
    setPending,
    setError,
  ]);

  // OAuth methods - These don't need useCallback as they just trigger redirects
  const startOAuthSignup = useCallback(
    (provider: OAuthProviders) => {
      setPending(`Redirecting to ${provider} for signup`);
      authService.redirectToOAuthSignup(provider);
    },
    [authService, setPending],
  );

  const startOAuthSignin = useCallback(
    (provider: OAuthProviders) => {
      setPending(`Redirecting to ${provider} for signin`);
      authService.redirectToOAuthSignin(provider);
    },
    [authService, setPending],
  );

  // Auto-load session on mount - OPTIMIZED: Only runs once on mount
  useEffect(() => {
    loadSession().catch((error) => {
      console.warn('Auto-load session failed:', error);
    });
  }, []); // Empty deps - loadSession is stable and we only want this to run once on mount

  return {
    // State
    session: store.session,
    accounts: store.accounts,
    currentAccount: store.currentAccount,
    currentAccountId: store.currentAccountId,
    accountIds: store.accountIds,
    isAuthenticated: store.isAuthenticated,
    hasValidSession: store.hasValidSession,
    tempToken: store.tempToken,

    // Loading States
    loadingInfo,
    isPending,
    isReady,
    hasError,

    // Session Management
    loadSession,
    refreshSession,
    clearSession,

    // Local Authentication
    localSignup,
    localLogin,
    verifyTwoFactor,
    requestPasswordReset,
    resetPassword,

    // OAuth Authentication
    startOAuthSignup,
    startOAuthSignin,

    // Account Management
    switchAccount,
    logout,
    logoutAll,

    // Store utilities (for other hooks)
    getAccountById: store.getAccountById,
    hasAccountData: store.hasAccountData,
    hasFullAccountData: store.hasFullAccountData,
    needsAccountData: store.needsAccountData,
  };
};
