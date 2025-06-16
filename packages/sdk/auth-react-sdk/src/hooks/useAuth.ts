import { useAppStore } from '../store/useAppStore';
import { useAuthService } from '../context/ServicesProvider';
import { LocalLoginRequest, OAuthProviders, CompleteProfileRequest } from '../types';
import { parseApiError } from '../utils';

export const useAuth = () => {
  const authService = useAuthService();

  const sessionState = useAppStore((state) => state.getSessionState());
  const switchingAccount = useAppStore((state) => state.session.switchingAccount);
  const loadingAccounts = useAppStore((state) => state.session.loadingAccounts);
  const tempToken = useAppStore((state) => state.tempToken);

  const setSessionLoading = useAppStore((state) => state.setSessionLoading);
  const setSessionData = useAppStore((state) => state.setSessionData);
  const setSessionError = useAppStore((state) => state.setSessionError);
  const setSwitchingAccount = useAppStore((state) => state.setSwitchingAccount);
  const setLoadingAccounts = useAppStore((state) => state.setLoadingAccounts);
  const setAccountsData = useAppStore((state) => state.setAccountsData);
  const clearSession = useAppStore((state) => state.clearSession);
  const setTempToken = useAppStore((state) => state.setTempToken);
  const clearTempToken = useAppStore((state) => state.clearTempToken);

  const isAuthenticated = !!(
    sessionState.data?.hasSession &&
    sessionState.data?.isValid &&
    sessionState.data?.accountIds.length > 0
  );
  const currentAccountId = sessionState.data?.currentAccountId || null;
  const accountIds = sessionState.data?.accountIds || [];
  const hasMultipleAccounts = accountIds.length > 1;

  const currentAccountState = useAppStore((state) =>
    currentAccountId
      ? state.getAccountState(currentAccountId)
      : { data: null, loading: false, error: null, lastLoaded: null },
  );

  const initializeSession = async () => {
    try {
      setSessionLoading(true);

      const sessionResponse = await authService.getAccountSession();
      setSessionData(sessionResponse.session);

      if (sessionResponse.session.accountIds.length > 0) {
        try {
          setLoadingAccounts(true);
          const accountsData = await authService.getSessionAccountsData(sessionResponse.session.accountIds);
          setAccountsData(accountsData);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load accounts';
          setLoadingAccounts(false, errorMessage);
          console.warn('Failed to load session accounts data:', error);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize session';
      setSessionError(errorMessage);
    }
  };

  const refreshSession = async () => {
    return initializeSession();
  };

  const setCurrentAccount = async (accountId: string | null) => {
    try {
      setSwitchingAccount(true);

      await authService.setCurrentAccountInSession(accountId);

      const sessionResponse = await authService.getAccountSession();
      setSessionData(sessionResponse.session);

      setSwitchingAccount(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to switch account';
      setSwitchingAccount(false, errorMessage);
    }
  };

  const login = async (data: LocalLoginRequest) => {
    const result = await authService.localLogin(data);

    if (result.requiresTwoFactor && result.tempToken) {
      setTempToken(result.tempToken);
    } else {
      await initializeSession();
    }

    return result;
  };

  const logout = async (accountId?: string) => {
    const targetAccountId = accountId || currentAccountId;
    if (!targetAccountId) {
      console.error('No account ID to logout');
      return;
    }

    await authService.logout(targetAccountId);
    await initializeSession();
  };

  const logoutAll = async () => {
    if (accountIds.length === 0) return;

    await authService.logoutAll(accountIds);
    clearSession();
  };

  const verify2FA = async (token: string, tempTokenToUse?: string) => {
    const tokenToUse = tempTokenToUse || tempToken;

    if (!tokenToUse) {
      console.error('No temporary token available for 2FA verification');
      return null;
    }

    const result = await authService.verifyTwoFactorLogin({
      token,
      tempToken: tokenToUse,
    });

    if (result.accountId) {
      // Clear temp token and refresh session on success
      clearTempToken();
      await initializeSession();
    }

    return result;
  };

  const requestEmailVerification = authService.requestEmailVerification;

  const verifyEmail = authService.verifyEmailForSignup;

  const completeProfile = async (token: string, data: CompleteProfileRequest) => {
    const result = await authService.completeProfile(token, data);
    await initializeSession();
    return result;
  };

  const getSignupStatus = authService.getSignupStatus;

  const cancelSignup = async (email: string) => {
    try {
      return await authService.cancelSignup({ email });
    } catch (error) {
      const apiError = parseApiError(error, 'Cancel signup failed');
      console.error('Cancel signup failed:', apiError);
      return null;
    }
  };

  const resetPassword = authService.resetPassword;

  const startOAuthSignup = (provider: OAuthProviders) => {
    authService.redirectToOAuthSignup(provider);
  };

  const startOAuthSignin = (provider: OAuthProviders) => {
    authService.redirectToOAuthSignin(provider);
  };

  const requestPermission = (provider: OAuthProviders, scopeNames: string[]) => {
    if (!currentAccountId) {
      console.error('No current account ID');
      return;
    }
    authService.requestPermission(provider, currentAccountId, scopeNames);
  };

  const reauthorizePermissions = (provider: OAuthProviders) => {
    if (!currentAccountId) {
      console.error('No current account ID');
      return;
    }
    authService.reauthorizePermissions(provider, currentAccountId);
  };

  return {
    session: {
      data: sessionState.data,
      loading: sessionState.loading,
      error: sessionState.error,
      lastLoaded: sessionState.lastLoaded,
    },

    isAuthenticated,
    currentAccountId,
    accountIds,
    hasMultipleAccounts,

    currentAccount: {
      data: currentAccountState.data,
      loading: currentAccountState.loading,
      error: currentAccountState.error,
    },

    switchingAccount: {
      loading: switchingAccount.loading,
      error: switchingAccount.error,
    },

    loadingAccounts: {
      loading: loadingAccounts.loading,
      error: loadingAccounts.error,
    },

    tempToken,

    initializeSession,
    refreshSession,
    setCurrentAccount,
    clearSession,

    login,
    logout,
    logoutAll,

    // 2FA Verification (integrated from use2FAVerification)
    verify2FA,
    clearTempToken,

    requestEmailVerification,
    completeProfile,
    getSignupStatus,
    cancelSignup,

    startOAuthSignup,
    startOAuthSignin,

    requestPermission,
    reauthorizePermissions,

    isSessionLoading: sessionState.loading,
    isSessionReady: !sessionState.loading && !!sessionState.data && !sessionState.error,
    hasSessionError: !!sessionState.error,

    isSwitchingAccount: switchingAccount.loading,
    isLoadingAccounts: loadingAccounts.loading,
  };
};
