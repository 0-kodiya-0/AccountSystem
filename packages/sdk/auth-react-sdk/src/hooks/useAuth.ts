import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  type LocalLoginRequest,
  type LocalSignupRequest,
  type TwoFactorVerifyRequest,
  type PasswordResetRequest,
  type ResetPasswordRequest,
  type PasswordChangeRequest,
  type TwoFactorSetupRequest,
  type OAuthProviders,
  LoadingState,
} from '../types';

export const useAuth = () => {
  const store = useAppStore();

  const isAuthenticated = store.session.hasSession && store.session.isValid && store.session.accountIds.length > 0;
  const currentAccount = store.session.currentAccountId
    ? store.accounts.data.get(store.session.currentAccountId)
    : null;

  const login = useCallback(
    async (data: LocalLoginRequest) => {
      return store.localLogin(data);
    },
    [store.localLogin],
  );

  const signup = useCallback(
    async (data: LocalSignupRequest) => {
      return store.localSignup(data);
    },
    [store.localSignup],
  );

  const verifyTwoFactor = useCallback(
    async (data: TwoFactorVerifyRequest) => {
      return store.verifyTwoFactor(data);
    },
    [store.verifyTwoFactor],
  );

  const requestPasswordReset = useCallback(
    async (email: string) => {
      return store.requestPasswordReset(email);
    },
    [store.requestPasswordReset],
  );

  const resetPassword = useCallback(
    async (token: string, data: ResetPasswordRequest) => {
      return store.resetPassword(token, data);
    },
    [store.resetPassword],
  );

  const changePassword = useCallback(
    async (accountId: string, data: PasswordChangeRequest) => {
      return store.changePassword(accountId, data);
    },
    [store.changePassword],
  );

  const setupTwoFactor = useCallback(
    async (accountId: string, data: TwoFactorSetupRequest) => {
      return store.setupTwoFactor(accountId, data);
    },
    [store.setupTwoFactor],
  );

  const verifyTwoFactorSetup = useCallback(
    async (accountId: string, token: string) => {
      return store.verifyTwoFactorSetup(accountId, token);
    },
    [store.verifyTwoFactorSetup],
  );

  const generateBackupCodes = useCallback(
    async (accountId: string, password: string) => {
      return store.generateBackupCodes(accountId, password);
    },
    [store.generateBackupCodes],
  );

  const startOAuthSignup = useCallback(
    (provider: OAuthProviders) => {
      store.startOAuthSignup(provider);
    },
    [store.startOAuthSignup],
  );

  const startOAuthSignin = useCallback(
    (provider: OAuthProviders) => {
      store.startOAuthSignin(provider);
    },
    [store.startOAuthSignin],
  );

  const switchAccount = useCallback(
    async (accountId: string) => {
      return store.setCurrentAccount(accountId);
    },
    [store.setCurrentAccount],
  );

  const requestPermission = useCallback(
    (scopeNames: string[]) => {
      if (!currentAccount?.id) throw new Error('No account ID');
      store.requestGooglePermission(currentAccount?.id, scopeNames);
    },
    [store.requestGooglePermission, currentAccount?.id],
  );

  const reauthorizePermissions = useCallback(() => {
    if (!currentAccount?.id) throw new Error('No account ID');
    store.reauthorizePermissions(currentAccount?.id);
  }, [store.reauthorizePermissions, currentAccount?.id]);

  const logout = useCallback(
    (accountId?: string) => {
      store.logout(accountId);
    },
    [store.logout],
  );

  const logoutAll = useCallback(() => {
    store.logoutAll();
  }, [store.logoutAll]);

  return {
    session: store.session,
    accounts: Array.from(store.accounts.data.values()),
    currentAccount,
    isAuthenticated,
    tempToken: store.tempToken,

    // Enhanced loading states
    loadingState: store.session.loadingState,
    isLoading: store.session.loadingState === LoadingState.LOADING,
    isReady: store.session.loadingState === LoadingState.READY,
    isIdle: store.session.loadingState === LoadingState.IDLE,
    isError: store.session.loadingState === LoadingState.ERROR,

    // Legacy compatibility
    error: store.session.error || store.ui.globalError,

    login,
    signup,
    verifyTwoFactor,
    requestPasswordReset,
    resetPassword,
    changePassword,
    setupTwoFactor,
    verifyTwoFactorSetup,
    generateBackupCodes,
    startOAuthSignup,
    startOAuthSignin,
    switchAccount,
    requestPermission,
    reauthorizePermissions,
    logout,
    logoutAll,

    setCurrentAccount: store.setCurrentAccount,
    refreshSession: store.refreshSession,
    clearSession: store.clearSession,
    clearError: store.clearError,
    setTempToken: store.setTempToken,
    clearTempToken: store.clearTempToken,
    resetSessionState: store.resetSessionState,
  };
};
