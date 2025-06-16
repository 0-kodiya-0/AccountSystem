import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useAccountService, useAuthService } from '../context/ServicesProvider';
import { Account, PasswordChangeRequest, AccountType } from '../types';
import { parseApiError } from '../utils';

export interface UseAccountOptions {
  accountId?: string;
  autoLoad?: boolean; // Default true - auto-load account data
  maxAge?: number; // How long cached data is valid (default 5 minutes)
}

export const useAccount = (options: UseAccountOptions = {}) => {
  const { accountId, autoLoad = true, maxAge = 5 * 60 * 1000 } = options;

  // Get services from context
  const accountService = useAccountService();
  const authService = useAuthService();

  // Get current account ID from session if not provided
  const currentAccountId = useAppStore((state) => state.getSessionState().data?.currentAccountId || null);
  const targetAccountId = accountId || currentAccountId;

  // Get account state using three-state pattern
  const accountState = useAppStore((state) =>
    targetAccountId
      ? state.getAccountState(targetAccountId)
      : { data: null, loading: false, error: null, lastLoaded: null },
  );

  const shouldLoad = useAppStore((state) =>
    targetAccountId ? state.shouldLoadAccount(targetAccountId, maxAge) : false,
  );

  // Get store actions
  const setAccountLoading = useAppStore((state) => state.setAccountLoading);
  const setAccountData = useAppStore((state) => state.setAccountData);
  const setAccountError = useAppStore((state) => state.setAccountError);
  const updateAccountData = useAppStore((state) => state.updateAccountData);
  const removeAccount = useAppStore((state) => state.removeAccount);
  const setSwitchingAccount = useAppStore((state) => state.setSwitchingAccount);

  const loadAccount = async (accountIdToLoad: string, force = false): Promise<Account | null> => {
    // Skip if already loading or data is fresh (unless forced)
    if (!force && (accountState.loading || !useAppStore.getState().shouldLoadAccount(accountIdToLoad, maxAge))) {
      if (accountState.data) return accountState.data;
    }

    try {
      setAccountLoading(accountIdToLoad, true);

      const accountData = await accountService.getAccount(accountIdToLoad);
      setAccountData(accountIdToLoad, accountData);

      return accountData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load account';
      setAccountError(accountIdToLoad, errorMessage);
      return null;
    }
  };

  const reloadAccount = () => {
    if (!targetAccountId) {
      console.error('No account ID available for reload');
      return null;
    }
    return loadAccount(targetAccountId, true);
  };

  const getAccountEmail = () => {
    if (!targetAccountId) {
      console.error('No account ID available for email retrieval');
      return null;
    }

    return accountService.getAccountEmail(targetAccountId);
  };

  const requestPasswordReset = authService.requestPasswordReset;

  const changePassword = (data: PasswordChangeRequest) => {
    if (!targetAccountId) {
      console.error('No account ID available for password change');
      return null;
    }

    return authService.changePassword(targetAccountId, data);
  };

  const setup2FA = (passwordOrEnable: string | boolean, enable?: boolean) => {
    if (!targetAccountId || !accountState.data) {
      console.error('No account available for 2FA setup');
      return null;
    }

    // Determine enable flag and password based on account type
    let enableTwoFactor: boolean;
    let password: string | undefined;

    if (accountState.data.accountType === AccountType.Local) {
      if (typeof passwordOrEnable !== 'string') {
        console.error('Password is required for Local auth accounts');
        return null;
      }
      password = passwordOrEnable;
      enableTwoFactor = enable ?? true;
    } else if (accountState.data.accountType === AccountType.OAuth) {
      if (typeof passwordOrEnable !== 'boolean') {
        console.error('Enable flag is required for OAuth accounts');
        return null;
      }
      enableTwoFactor = passwordOrEnable;
      password = undefined;
    } else {
      console.error(`Unsupported account type: ${accountState.data.accountType}`);
      return null;
    }

    return authService.setupTwoFactor(targetAccountId, {
      enableTwoFactor,
      password,
    });
  };

  const verify2FASetup = async (token: string) => {
    if (!targetAccountId || !accountState.data) {
      console.error('No account available for 2FA verification');
      return null;
    }

    try {
      const result = await authService.verifyTwoFactorSetup(targetAccountId, token);

      // Update local account security state
      updateAccountData(targetAccountId, {
        security: { ...accountState.data.security, twoFactorEnabled: true },
      });

      return result;
    } catch (error) {
      const apiError = parseApiError(error, 'Failed to verify 2FA setup');
      console.error('Failed to verify 2FA setup:', apiError);
      return null;
    }
  };

  const generateBackupCodes = async (password?: string) => {
    if (!targetAccountId || !accountState.data) {
      console.error('No account available for backup codes');
      return null;
    }

    try {
      const result = await authService.generateBackupCodes(targetAccountId, {
        password: accountState.data.accountType === AccountType.Local ? password : undefined,
      });

      return result;
    } catch (error) {
      const apiError = parseApiError(error, 'Failed to generate backup codes');
      console.error('Failed to generate backup codes:', apiError);
      return null;
    }
  };

  const get2FAStatus = () => {
    if (!targetAccountId) {
      console.error('No account ID available for 2FA status');
      return null;
    }

    return authService.getTwoFactorStatus(targetAccountId);
  };

  const switchToThisAccount = async () => {
    if (!targetAccountId) {
      console.error('No account ID available for account switch');
      return;
    }

    try {
      setSwitchingAccount(true);

      await authService.setCurrentAccountInSession(targetAccountId);

      // Refresh session to get updated current account
      const sessionResponse = await authService.getAccountSession();
      const setSessionData = useAppStore.getState().setSessionData;
      setSessionData(sessionResponse.session);

      setSwitchingAccount(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to switch account';
      setSwitchingAccount(false, errorMessage);
      console.error('Failed to switch to account:', error);
    }
  };

  const deleteAccount = () => {
    if (!targetAccountId) {
      console.error('No account ID available for account deletion');
      return;
    }
    removeAccount(targetAccountId);
  };

  const updateLocalAccount = (updates: Partial<Account>) => {
    if (!targetAccountId) {
      console.error('No account ID available for local update');
      return;
    }
    updateAccountData(targetAccountId, updates);
  };

  const clearAccountError = () => {
    if (!targetAccountId) return;
    setAccountError(targetAccountId, null);
  };

  const retryLoadAccount = async () => {
    if (!targetAccountId) return;
    clearAccountError();
    await loadAccount(targetAccountId, true);
  };

  useEffect(() => {
    if (!autoLoad || !targetAccountId) return;

    // Only load if we should load (respects cache age and loading state)
    if (shouldLoad) {
      loadAccount(targetAccountId).catch((error) => {
        console.warn('Failed to auto-load account:', error);
      });
    }
  }, [autoLoad, targetAccountId, shouldLoad]);

  const account = accountState.data;
  const isLoaded = !!account;
  const isLocal = account?.accountType === 'local';
  const isOAuth = account?.accountType === 'oauth';
  const has2FA = account?.security?.twoFactorEnabled || false;
  const displayName = account?.userDetails?.name || 'Unknown User';
  const email = account?.userDetails?.email;
  const imageUrl = account?.userDetails?.imageUrl;

  return {
    account: {
      data: accountState.data,
      loading: accountState.loading,
      error: accountState.error,
      lastLoaded: accountState.lastLoaded,
    },

    accountId: targetAccountId,
    isLoaded,
    isLocal,
    isOAuth,
    has2FA,
    displayName,
    email,
    imageUrl,

    loadAccount: () => (targetAccountId ? loadAccount(targetAccountId) : Promise.resolve(null)),
    reloadAccount,
    getAccountEmail,

    requestPasswordReset,
    changePassword,

    // 2FA Operations (integrated from use2FASetup)
    setup2FA,
    verify2FASetup,
    generateBackupCodes,
    get2FAStatus,

    switchToThisAccount,
    deleteAccount,

    retryLoadAccount,
    clearError: clearAccountError,

    updateLocalAccount,

    isLoading: accountState.loading,
    hasError: !!accountState.error,
    error: accountState.error,
    isAccountReady: !accountState.loading && !!accountState.data && !accountState.error,
    shouldRefresh: shouldLoad,
  };
};
