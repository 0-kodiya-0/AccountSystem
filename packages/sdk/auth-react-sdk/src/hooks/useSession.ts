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
} from '../types';
import { parseApiError } from '../utils';

interface AccountOperations {
  load: () => Promise<Account | null>;
  logout: () => Promise<void>;
  setup2FA: (data: UnifiedTwoFactorSetupRequest) => Promise<any>;
  verify2FA: (token: string) => Promise<any>;
  changePassword: (data: PasswordChangeRequest) => Promise<any>;
  generateBackupCodes: (data: BackupCodesRequest) => Promise<any>;
  requestPermission: (provider: OAuthProviders, scopeNames: string[], callbackUrl?: string) => void;
  getPermissionUrl: (provider: OAuthProviders, scopeNames: string[]) => Promise<string>;
  reauthorizePermissions: (provider: OAuthProviders, callbackUrl?: string) => void;
  getReauthorizeUrl: (provider: OAuthProviders) => Promise<string>;
  revokeTokens: () => Promise<any>;
  getTokenInformation: () => Promise<any>;
  updateSecurity: (updates: any) => Promise<Account>;
  updateAccount: (updates: Partial<Account>) => Promise<Account>;
  switchToThisAccount: () => Promise<void>;
}

interface AccountObject {
  id: string;
  data: Account | null;
  loading: boolean;
  error: string | null;
  currentOperation: string | null;
  operations: AccountOperations;
}

interface SessionOperations {
  load: () => Promise<void>;
  logoutAll: () => Promise<void>;
  setCurrentAccount: (accountId: string | null) => Promise<void>;
}

interface SessionReturn {
  session: {
    data: AccountSessionInfo | null;
    loading: boolean;
    error: string | null;
  };
  accounts: AccountObject[];
  currentAccount: AccountObject | null;
  operations: SessionOperations;
}

interface SingleAccountReturn {
  id: string;
  data: Account | null;
  loading: boolean;
  error: string | null;
  currentOperation: string | null;
  operations: AccountOperations;
}

// Overloaded function signatures
export function useSession(): SessionReturn;
export function useSession(accountId: string): SingleAccountReturn;
export function useSession(accountId?: string) {
  const authService = useAuthService();
  const accountService = useAccountService();

  // Store state
  const sessionState = useAppStore((state) => state.getSessionState());
  const setSessionLoading = useAppStore((state) => state.setSessionLoading);
  const setSessionData = useAppStore((state) => state.setSessionData);
  const setSessionError = useAppStore((state) => state.setSessionError);
  const clearSession = useAppStore((state) => state.clearSession);

  const setAccountLoading = useAppStore((state) => state.setAccountLoading);
  const setAccountData = useAppStore((state) => state.setAccountData);
  const setAccountError = useAppStore((state) => state.setAccountError);
  const setAccountsData = useAppStore((state) => state.setAccountsData);
  const updateAccountData = useAppStore((state) => state.updateAccountData);

  // Create account operations factory
  const createAccountOperations = (targetAccountId: string): AccountOperations => ({
    load: async () => {
      try {
        setAccountLoading(targetAccountId, true, 'load');
        const account = await accountService.getAccount(targetAccountId);
        setAccountData(targetAccountId, account);
        return account;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load account';
        setAccountError(targetAccountId, errorMessage);
        return null;
      }
    },

    logout: async () => {
      try {
        setAccountLoading(targetAccountId, true, 'logout');
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
        const errorMessage = error instanceof Error ? error.message : 'Failed to logout';
        setAccountError(targetAccountId, errorMessage);
      }
    },

    setup2FA: async (data: UnifiedTwoFactorSetupRequest) => {
      try {
        setAccountLoading(targetAccountId, true, 'setup2FA');
        const result = await authService.setupTwoFactor(targetAccountId, data);
        setAccountLoading(targetAccountId, false);
        return result;
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to setup 2FA');
        setAccountError(targetAccountId, apiError.message);
        return null;
      }
    },

    verify2FA: async (token: string) => {
      try {
        setAccountLoading(targetAccountId, true, 'verify2FA');
        const result = await authService.verifyTwoFactorSetup(targetAccountId, token);

        // Update account security state
        updateAccountData(targetAccountId, {
          security: { twoFactorEnabled: true } as any,
        });

        setAccountLoading(targetAccountId, false);
        return result;
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to verify 2FA');
        setAccountError(targetAccountId, apiError.message);
        return null;
      }
    },

    changePassword: async (data: PasswordChangeRequest) => {
      try {
        setAccountLoading(targetAccountId, true, 'changePassword');
        const result = await authService.changePassword(targetAccountId, data);
        setAccountLoading(targetAccountId, false);
        return result;
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to change password');
        setAccountError(targetAccountId, apiError.message);
        return null;
      }
    },

    generateBackupCodes: async (data: BackupCodesRequest) => {
      try {
        setAccountLoading(targetAccountId, true, 'generateBackupCodes');
        const result = await authService.generateBackupCodes(targetAccountId, data);
        setAccountLoading(targetAccountId, false);
        return result;
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to generate backup codes');
        setAccountError(targetAccountId, apiError.message);
        return null;
      }
    },

    requestPermission: (provider: OAuthProviders, scopeNames: string[], callbackUrl?: string) => {
      if (callbackUrl) {
        authService
          .generatePermissionUrl(provider, targetAccountId, scopeNames)
          .then((response) => {
            const url = new URL(response.authorizationUrl);
            url.searchParams.set('redirect_uri', callbackUrl);
            window.location.href = url.toString();
          })
          .catch((error) => {
            console.error('Failed to generate permission URL with callback:', error);
          });
      } else {
        authService.requestPermission(provider, targetAccountId, scopeNames);
      }
    },

    getPermissionUrl: async (provider: OAuthProviders, scopeNames: string[]) => {
      const response = await authService.generatePermissionUrl(provider, targetAccountId, scopeNames);
      return response.authorizationUrl;
    },

    reauthorizePermissions: (provider: OAuthProviders, callbackUrl?: string) => {
      if (callbackUrl) {
        authService
          .generateReauthorizeUrl(provider, targetAccountId)
          .then((response) => {
            if (response.authorizationUrl) {
              const url = new URL(response.authorizationUrl);
              url.searchParams.set('redirect_uri', callbackUrl);
              window.location.href = url.toString();
            }
          })
          .catch((error) => {
            console.error('Failed to generate reauthorize URL with callback:', error);
          });
      } else {
        authService.reauthorizePermissions(provider, targetAccountId);
      }
    },

    getReauthorizeUrl: async (provider: OAuthProviders) => {
      const response = await authService.generateReauthorizeUrl(provider, targetAccountId);
      return response.authorizationUrl || '';
    },

    revokeTokens: async () => {
      try {
        setAccountLoading(targetAccountId, true, 'revokeTokens');
        const result = await authService.revokeTokens(targetAccountId);
        setAccountLoading(targetAccountId, false);
        return result;
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to revoke tokens');
        setAccountError(targetAccountId, apiError.message);
        return null;
      }
    },

    getTokenInformation: async () => {
      try {
        setAccountLoading(targetAccountId, true, 'getTokenInformation');
        const result = await authService.getTokenStatus(targetAccountId);
        setAccountLoading(targetAccountId, false);
        return result;
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to get token information');
        setAccountError(targetAccountId, apiError.message);
        return null;
      }
    },

    updateSecurity: async (updates: any) => {
      try {
        setAccountLoading(targetAccountId, true, 'updateSecurity');
        const result = await accountService.updateAccountSecurity(targetAccountId, updates);
        setAccountData(targetAccountId, result);
        return result;
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to update security');
        setAccountError(targetAccountId, apiError.message);
        throw error;
      }
    },

    updateAccount: async (updates: Partial<Account>) => {
      try {
        setAccountLoading(targetAccountId, true, 'updateAccount');
        const result = await accountService.updateAccount(targetAccountId, updates);
        setAccountData(targetAccountId, result);
        return result;
      } catch (error) {
        const apiError = parseApiError(error, 'Failed to update account');
        setAccountError(targetAccountId, apiError.message);
        throw error;
      }
    },

    switchToThisAccount: async () => {
      try {
        setSessionLoading(true);

        await authService.setCurrentAccountInSession(targetAccountId);

        // Refresh session to get updated current account
        const sessionResponse = await authService.getAccountSession();
        setSessionData(sessionResponse.session);

        setSessionLoading(false);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to switch to this account';
        setSessionError(errorMessage);
      }
    },
  });

  // Session operations
  const sessionOperations: SessionOperations = {
    load: async () => {
      try {
        setSessionLoading(true);

        const sessionResponse = await authService.getAccountSession();
        setSessionData(sessionResponse.session);

        if (sessionResponse.session.accountIds.length > 0) {
          const accountsData = await authService.getSessionAccountsData(sessionResponse.session.accountIds);
          setAccountsData(accountsData as Account[]);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load session';
        setSessionError(errorMessage);
      }
    },

    logoutAll: async () => {
      try {
        setSessionLoading(true);

        if (sessionState.data?.accountIds.length) {
          await authService.logoutAll(sessionState.data.accountIds);
        }

        clearSession();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to logout all';
        setSessionError(errorMessage);
      }
    },

    setCurrentAccount: async (accountId: string | null) => {
      try {
        setSessionLoading(true);

        await authService.setCurrentAccountInSession(accountId);

        // Refresh session to get updated current account
        const sessionResponse = await authService.getAccountSession();
        setSessionData(sessionResponse.session);

        setSessionLoading(false);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to set current account';
        setSessionError(errorMessage);
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
      loading: accountState.loading,
      error: accountState.error,
      currentOperation: accountState.currentOperation,
      operations: createAccountOperations(accountId),
    };
  }

  // Otherwise return full session
  const allAccounts = useAppStore((state) => state.accounts);
  const accounts: AccountObject[] = useMemo(() => {
    return (sessionState.data?.accountIds || []).map((id) => {
      const accountState = allAccounts[id] || { data: null, loading: false, error: null, currentOperation: null };
      return {
        id,
        data: accountState.data,
        loading: accountState.loading,
        error: accountState.error,
        currentOperation: accountState.currentOperation,
        operations: createAccountOperations(id),
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
      loading: sessionState.loading,
      error: sessionState.error,
    },
    accounts,
    currentAccount,
    operations: sessionOperations,
  };
}
