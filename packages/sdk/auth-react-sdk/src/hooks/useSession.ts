import { useEffect, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useAuthService, useAccountService } from '../context/ServicesProvider';
import {
  Account,
  PasswordChangeRequest,
  OAuthProviders,
  UnifiedTwoFactorSetupRequest,
  BackupCodesRequest,
  AccountSessionInfo,
  LoadingState,
  AccountUpdateRequest as AccountUpdate,
} from '../types';
import { getStatusHelpers, parseApiError } from '../utils';

interface AccountOperations {
  load: () => Promise<Account | null>;
  logout: () => Promise<void>;
  setup2FA: (data: UnifiedTwoFactorSetupRequest) => Promise<any>;
  verify2FA: (token: string) => Promise<any>;
  changePassword: (data: PasswordChangeRequest) => Promise<any>;
  generateBackupCodes: (data: BackupCodesRequest) => Promise<any>;
  requestPermission: (provider: OAuthProviders, scopeNames: string[], callbackUrl: string) => Promise<void>;
  getPermissionUrl: (provider: OAuthProviders, scopeNames: string[], callbackUrl: string) => Promise<string>;
  reauthorizePermissions: (provider: OAuthProviders, callbackUrl: string) => Promise<void>;
  getReauthorizeUrl: (provider: OAuthProviders, callbackUrl: string) => Promise<string>;
  revokeTokens: () => Promise<any>;
  getTokenInformation: () => Promise<any>;
  updateAccount: (updates: AccountUpdate) => Promise<Account | null>;
  switchToThisAccount: () => Promise<void>;
}

interface AccountObject {
  id: string;
  data: Account | null;
  status: LoadingState;
  currentOperation: string | null;
  error: string | null;
  operations: AccountOperations;

  // Convenience getters
  isLoading: boolean;
  isUpdating: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  isIdle: boolean;
  hasError: boolean;
  isSuccess: boolean;
}

interface SessionOperations {
  load: () => Promise<void>;
  logoutAll: () => Promise<void>;
  setCurrentAccount: (accountId: string | null) => Promise<void>;
}

interface SessionReturn {
  session: {
    data: AccountSessionInfo | null;
    status: LoadingState;
    currentOperation: string | null;
    error: string | null;

    // Convenience getters
    isLoading: boolean;
    isUpdating: boolean;
    isSaving: boolean;
    isDeleting: boolean;
    isIdle: boolean;
    hasError: boolean;
    isSuccess: boolean;
  };
  accounts: AccountObject[];
  currentAccount: AccountObject | null;
  operations: SessionOperations;
}

interface SingleAccountReturn {
  id: string;
  data: Account | null;
  status: LoadingState;
  currentOperation: string | null;
  error: string | null;
  operations: AccountOperations;

  // Convenience getters
  isLoading: boolean;
  isUpdating: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  isIdle: boolean;
  hasError: boolean;
  isSuccess: boolean;
}

// Overloaded function signatures
export function useSession(): SessionReturn;
export function useSession(accountId: string): SingleAccountReturn;
export function useSession(accountId?: string) {
  const authService = useAuthService();
  const accountService = useAccountService();

  // Store state
  const sessionState = useAppStore((state) => state.getSessionState());
  const setSessionStatus = useAppStore((state) => state.setSessionStatus);
  const setSessionData = useAppStore((state) => state.setSessionData);
  const setSessionError = useAppStore((state) => state.setSessionError);
  const clearSession = useAppStore((state) => state.clearSession);

  const setAccountStatus = useAppStore((state) => state.setAccountStatus);
  const setAccountData = useAppStore((state) => state.setAccountData);
  const setAccountError = useAppStore((state) => state.setAccountError);
  const setAccountsData = useAppStore((state) => state.setAccountsData);
  const updateAccountData = useAppStore((state) => state.updateAccountData);

  // Create account operations factory
  const createAccountOperations = (targetAccountId: string): AccountOperations => ({
    load: async () => {
      try {
        setAccountStatus(targetAccountId, 'loading', 'load');
        const account = await accountService.getAccount(targetAccountId);
        setAccountData(targetAccountId, account);
        return account;
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to load account');
        setAccountError(targetAccountId, apiError.message);
        return null;
      }
    },

    logout: async () => {
      try {
        setAccountStatus(targetAccountId, 'updating', 'logout');
        await authService.logout(targetAccountId);

        // Refresh session after logout
        const sessionResponse = await authService.getAccountSession();
        setSessionData(sessionResponse.session);

        // Load remaining accounts if any
        if (sessionResponse.session.accountIds.length > 0) {
          const accountsData = await authService.getSessionAccountsData(sessionResponse.session.accountIds);
          setAccountsData(accountsData as Account[]);
        }
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to logout');
        setAccountError(targetAccountId, apiError.message);
      }
    },

    setup2FA: async (data: UnifiedTwoFactorSetupRequest) => {
      try {
        setAccountStatus(targetAccountId, 'updating', 'setup2FA');
        const result = await authService.setupTwoFactor(targetAccountId, data);
        setAccountStatus(targetAccountId, 'success');
        return result;
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to setup 2FA');
        setAccountError(targetAccountId, apiError.message);
        return null;
      }
    },

    verify2FA: async (token: string) => {
      try {
        setAccountStatus(targetAccountId, 'updating', 'verify2FA');
        const result = await authService.verifyTwoFactorSetup(targetAccountId, token);

        // Update account security state
        updateAccountData(targetAccountId, {
          security: { twoFactorEnabled: true } as any,
        });

        setAccountStatus(targetAccountId, 'success');
        return result;
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to verify 2FA');
        setAccountError(targetAccountId, apiError.message);
        return null;
      }
    },

    changePassword: async (data: PasswordChangeRequest) => {
      try {
        setAccountStatus(targetAccountId, 'updating', 'changePassword');
        const result = await authService.changePassword(targetAccountId, data);
        setAccountStatus(targetAccountId, 'success');
        return result;
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to change password');
        setAccountError(targetAccountId, apiError.message);
        return null;
      }
    },

    generateBackupCodes: async (data: BackupCodesRequest) => {
      try {
        setAccountStatus(targetAccountId, 'updating', 'generateBackupCodes');
        const result = await authService.generateBackupCodes(targetAccountId, data);
        setAccountStatus(targetAccountId, 'success');
        return result;
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to generate backup codes');
        setAccountError(targetAccountId, apiError.message);
        return null;
      }
    },

    requestPermission: async (provider: OAuthProviders, scopeNames: string[], callbackUrl: string) => {
      try {
        if (!callbackUrl) {
          throw new Error('Callback URL is required for permission request');
        }

        setAccountStatus(targetAccountId, 'updating', 'requestPermission');

        const response = await authService.generatePermissionUrl(provider, {
          accountId: targetAccountId,
          scopeNames,
          callbackUrl,
        });

        window.location.href = response.authorizationUrl;
        setAccountStatus(targetAccountId, 'success');
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to request permission');
        setAccountError(targetAccountId, apiError.message);
      }
    },

    getPermissionUrl: async (provider: OAuthProviders, scopeNames: string[], callbackUrl: string) => {
      try {
        if (!callbackUrl) {
          throw new Error('Callback URL is required for permission URL generation');
        }

        const response = await authService.generatePermissionUrl(provider, {
          accountId: targetAccountId,
          scopeNames,
          callbackUrl,
        });
        return response.authorizationUrl;
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to get permission URL');
        setAccountError(targetAccountId, apiError.message);
        return '';
      }
    },

    reauthorizePermissions: async (provider: OAuthProviders, callbackUrl: string) => {
      try {
        if (!callbackUrl) {
          throw new Error('Callback URL is required for reauthorization');
        }

        setAccountStatus(targetAccountId, 'updating', 'reauthorizePermissions');

        const response = await authService.generateReauthorizeUrl(provider, {
          accountId: targetAccountId,
          callbackUrl,
        });

        if (response.authorizationUrl) {
          window.location.href = response.authorizationUrl;
        }
        setAccountStatus(targetAccountId, 'success');
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to reauthorize permissions');
        setAccountError(targetAccountId, apiError.message);
      }
    },

    getReauthorizeUrl: async (provider: OAuthProviders, callbackUrl: string) => {
      try {
        if (!callbackUrl) {
          throw new Error('Callback URL is required for reauthorization URL generation');
        }

        const response = await authService.generateReauthorizeUrl(provider, {
          accountId: targetAccountId,
          callbackUrl,
        });
        return response.authorizationUrl || '';
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to get reauthorize URL');
        setAccountError(targetAccountId, apiError.message);
        return '';
      }
    },

    revokeTokens: async () => {
      try {
        setAccountStatus(targetAccountId, 'updating', 'revokeTokens');
        const result = await authService.revokeTokens(targetAccountId);
        setAccountStatus(targetAccountId, 'success');
        return result;
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to revoke tokens');
        setAccountError(targetAccountId, apiError.message);
        return null;
      }
    },

    getTokenInformation: async () => {
      try {
        setAccountStatus(targetAccountId, 'loading', 'getTokenInformation');
        const result = await authService.getTokenStatus(targetAccountId);
        setAccountStatus(targetAccountId, 'success');
        return result;
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to get token information');
        setAccountError(targetAccountId, apiError.message);
        return null;
      }
    },

    updateAccount: async (updates: AccountUpdate) => {
      try {
        setAccountStatus(targetAccountId, 'saving', 'updateAccount');
        const result = await accountService.updateAccount(targetAccountId, updates);
        setAccountData(targetAccountId, result);
        return result;
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to update account');
        setAccountError(targetAccountId, apiError.message);
        return null;
      }
    },

    switchToThisAccount: async () => {
      try {
        setSessionStatus('updating', 'switchAccount');

        await authService.setCurrentAccountInSession(targetAccountId);

        // Refresh session to get updated current account
        const sessionResponse = await authService.getAccountSession();
        setSessionData(sessionResponse.session);
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to switch to this account');
        setSessionError(apiError.message);
      }
    },
  });

  // Session operations
  const sessionOperations: SessionOperations = {
    load: async () => {
      try {
        setSessionStatus('loading', 'loadSession');

        const sessionResponse = await authService.getAccountSession();
        setSessionData(sessionResponse.session);

        if (sessionResponse.session.accountIds.length > 0) {
          const accountsData = await authService.getSessionAccountsData(sessionResponse.session.accountIds);
          setAccountsData(accountsData as Account[]);
        }
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to load session');
        setSessionError(apiError.message);
      }
    },

    logoutAll: async () => {
      try {
        setSessionStatus('updating', 'logoutAll');

        if (sessionState.data?.accountIds.length) {
          await authService.logoutAll(sessionState.data.accountIds);
        }

        clearSession();
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to logout all');
        setSessionError(apiError.message);
      }
    },

    setCurrentAccount: async (accountId: string | null) => {
      try {
        setSessionStatus('updating', 'setCurrentAccount');

        await authService.setCurrentAccountInSession(accountId);

        // Refresh session to get updated current account
        const sessionResponse = await authService.getAccountSession();
        setSessionData(sessionResponse.session);
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to set current account');
        setSessionError(apiError.message);
      }
    },
  };

  // Auto-load session on mount
  useEffect(() => {
    if (useAppStore.getState().shouldLoadSession()) {
      sessionOperations.load();
    }
  }, []);

  // If specific accountId is requested, return single account
  if (accountId) {
    const accountState = useAppStore((state) => state.getAccountState(accountId));

    return {
      id: accountId,
      data: accountState.data,
      status: accountState.status,
      currentOperation: accountState.currentOperation,
      error: accountState.error,
      operations: createAccountOperations(accountId),
      ...getStatusHelpers(accountState.status),
    };
  }

  // Otherwise return full session
  const allAccounts = useAppStore((state) => state.accounts);
  const accounts: AccountObject[] = useMemo(() => {
    return (sessionState.data?.accountIds || []).map((id) => {
      const accountState = allAccounts[id] || {
        data: null,
        status: 'idle' as LoadingState,
        currentOperation: null,
        error: null,
        lastLoaded: null,
      };
      return {
        id,
        data: accountState.data,
        status: accountState.status,
        currentOperation: accountState.currentOperation,
        error: accountState.error,
        operations: createAccountOperations(id),
        ...getStatusHelpers(accountState.status),
      };
    });
  }, [sessionState.data?.accountIds, allAccounts]);

  const currentAccount = useMemo(() => {
    if (!sessionState.data?.currentAccountId) return null;
    return accounts.find((acc) => acc.id === sessionState.data!.currentAccountId) || null;
  }, [accounts, sessionState.data?.currentAccountId]);

  return {
    session: {
      data: sessionState.data,
      status: sessionState.status,
      currentOperation: sessionState.currentOperation,
      error: sessionState.error,
      ...getStatusHelpers(sessionState.status),
    },
    accounts,
    currentAccount,
    operations: sessionOperations,
  };
}
