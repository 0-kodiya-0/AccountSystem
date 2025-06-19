import { useSession } from './useSession';
import { useAppStore } from '../store/useAppStore';
import { useAuthService, useAccountService } from '../context/ServicesProvider';
import {
  Account,
  PasswordChangeRequest,
  OAuthProviders,
  UnifiedTwoFactorSetupRequest,
  BackupCodesRequest,
  LoadingState,
  AccountUpdateRequest,
  AccountType,
} from '../types';
import { getStatusHelpers, parseApiError } from '../utils';
import { useEffect, useMemo } from 'react';

const DEFAULT_ACCOUNT_STATE = {
  data: null,
  status: 'idle' as LoadingState,
  currentOperation: null,
  error: null,
};

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
  updateAccount: (updates: AccountUpdateRequest) => Promise<Account | null>;
  switchToThisAccount: () => Promise<void>;
}

interface AccountOptions {
  autoLoad?: boolean; // Whether to automatically load account data on mount (default: true)
  autoLoadSession?: boolean; // Whether to auto-load session (default: true)
}

interface AccountReturn {
  // Account identification
  id: string | null;

  // Account data
  data: Account | null;
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

  // State checks
  exists: boolean;
  isCurrent: boolean;

  // Operations
  operations: AccountOperations;
}

// Overloaded function signatures
export function useAccount(options?: AccountOptions): AccountReturn; // Current account
export function useAccount(accountId: string, options?: AccountOptions): AccountReturn; // Specific account
export function useAccount(
  accountIdOrOptions?: string | AccountOptions,
  options?: AccountOptions,
): AccountReturn | null {
  // Handle overloaded parameters
  let accountId: string | undefined;
  let finalOptions: AccountOptions;

  if (typeof accountIdOrOptions === 'string') {
    accountId = accountIdOrOptions;
    finalOptions = options || {};
  } else {
    accountId = undefined;
    finalOptions = accountIdOrOptions || {};
  }

  const { autoLoad = true, autoLoadSession = true } = finalOptions;

  // Always call hooks in the same order
  const { currentAccountId, operations: sessionOperations } = useSession({ autoLoad: autoLoadSession });
  const authService = useAuthService();
  const accountService = useAccountService();

  // Determine target account ID
  const targetAccountId = accountId || currentAccountId;

  // Always call store hooks, even if targetAccountId is null
  const accountState = useAppStore((state) => state.getAccountState(targetAccountId));

  const setAccountStatus = useAppStore((state) => state.setAccountStatus);
  const setAccountData = useAppStore((state) => state.setAccountData);
  const setAccountError = useAppStore((state) => state.setAccountError);
  const updateAccountData = useAppStore((state) => state.updateAccountData);

  // Create account operations (these will be no-ops if no targetAccountId)
  const accountOperations = useMemo<AccountOperations>(
    () => ({
      load: async () => {
        if (!targetAccountId) return null;

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
        if (!targetAccountId) return;

        try {
          setAccountStatus(targetAccountId, 'updating', 'logout');
          await authService.logout(targetAccountId);

          // Refresh session after logout
          await sessionOperations.load();
        } catch (error) {
          const apiError = parseApiError(error, 'Failed to logout');
          setAccountError(targetAccountId, apiError.message);
        }
      },

      setup2FA: async (data: UnifiedTwoFactorSetupRequest) => {
        if (!targetAccountId || !accountState.data?.accountType) return null;

        try {
          setAccountStatus(targetAccountId, 'updating', 'setup2FA');
          const result = await authService.setupTwoFactor(targetAccountId, accountState.data?.accountType, data);
          setAccountStatus(targetAccountId, 'success');
          return result;
        } catch (error) {
          const apiError = parseApiError(error, 'Failed to setup 2FA');
          setAccountError(targetAccountId, apiError.message);
          return null;
        }
      },

      verify2FA: async (token: string) => {
        if (!targetAccountId) return null;

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
        if (!targetAccountId) return null;

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
        if (!targetAccountId) return null;

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
        if (!targetAccountId) return;

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
        if (!targetAccountId) return '';

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
        if (!targetAccountId) return;

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
        if (!targetAccountId) return '';

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
        if (!targetAccountId) return null;

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
        if (!targetAccountId) return null;

        try {
          setAccountStatus(targetAccountId, 'loading', 'getTokenInformation');
          const result = await authService.getAccessTokenInfo(targetAccountId);
          setAccountStatus(targetAccountId, 'success');
          return result;
        } catch (error) {
          const apiError = parseApiError(error, 'Failed to get token information');
          setAccountError(targetAccountId, apiError.message);
          return null;
        }
      },

      updateAccount: async (updates: AccountUpdateRequest) => {
        if (!targetAccountId) return null;

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
        if (!targetAccountId) return;

        try {
          setAccountStatus(targetAccountId, 'switching', 'switchToThisAccount');
          await sessionOperations.setCurrentAccount(targetAccountId);
        } catch (error) {
          const apiError = parseApiError(error, 'Failed to switch to this account');
          setAccountError(targetAccountId, apiError.message);
        }
      },
    }),
    [targetAccountId, accountState.data],
  );

  // Derived state
  const exists = !!accountState.data;
  const isCurrent = currentAccountId === targetAccountId;

  // Auto-load account data on mount (if enabled and targetAccountId exists)
  useEffect(() => {
    if (autoLoad && targetAccountId && useAppStore.getState().shouldLoadAccount(targetAccountId)) {
      accountOperations.load();
    }
  }, [autoLoad, targetAccountId]);

  return {
    // Account identification
    id: targetAccountId,

    // Account data
    data: accountState.data,
    status: accountState.status,
    currentOperation: accountState.currentOperation,
    error: accountState.error,

    // Convenience getters
    ...getStatusHelpers(accountState.status),

    // State checks
    exists,
    isCurrent,

    // Operations
    operations: accountOperations,
  };
}
