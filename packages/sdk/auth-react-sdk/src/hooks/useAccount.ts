import { useSession } from './useSession';
import { useAppStore } from '../store/useAppStore';
import { useAuthService, useAccountService } from '../context/ServicesProvider';
import { Account, PasswordChangeRequest, LoadingState, AccountUpdateRequest } from '../types';
import { getStatusHelpers, parseApiError } from '../utils';
import { useEffect, useCallback } from 'react';

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
  load: () => Promise<Account | null>;
  logout: () => Promise<void>;
  changePassword: (data: PasswordChangeRequest) => Promise<any>;
  revokeTokens: () => Promise<any>;
  getTokenInformation: () => Promise<any>;
  updateAccount: (updates: AccountUpdateRequest) => Promise<Account | null>;
  switchToThisAccount: () => Promise<void>;
}

const INITIAL_ACCOUNT_STATE = {
  data: null,
  status: 'idle' as LoadingState,
  currentOperation: null,
  error: null,
};

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
  const { currentAccountId, setCurrentAccount } = useSession({ autoLoad: autoLoadSession });
  const authService = useAuthService();
  const accountService = useAccountService();

  // Determine target account ID
  const targetAccountId = accountId || currentAccountId;

  // Always call store hooks, even if targetAccountId is null
  const accountState = useAppStore((state) => {
    if (!targetAccountId) return INITIAL_ACCOUNT_STATE;

    return state.getAccountState(targetAccountId) || INITIAL_ACCOUNT_STATE;
  });

  const setAccountStatus = useAppStore((state) => state.setAccountStatus);
  const setAccountData = useAppStore((state) => state.setAccountData);
  const setAccountError = useAppStore((state) => state.setAccountError);

  // Account operations
  const load = useCallback(async () => {
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
  }, [targetAccountId, accountService, setAccountStatus, setAccountData, setAccountError]);

  const logout = useCallback(async () => {
    if (!targetAccountId) return;

    try {
      setAccountStatus(targetAccountId, 'updating', 'logout');
      await authService.logout(targetAccountId);
      setAccountStatus(targetAccountId, 'success');

      // Refresh session after logout
      await load();
    } catch (error) {
      const apiError = parseApiError(error, 'Failed to logout');
      setAccountError(targetAccountId, apiError.message);
    }
  }, [targetAccountId, authService, setAccountStatus, setAccountError]);

  const changePassword = useCallback(
    async (data: PasswordChangeRequest) => {
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
    [targetAccountId, authService, setAccountStatus, setAccountError],
  );

  const revokeTokens = useCallback(async () => {
    if (!targetAccountId) return null;

    try {
      setAccountStatus(targetAccountId, 'updating', 'revokeTokens');
      const result = await authService.revokeTokens(targetAccountId);
      setAccountStatus(targetAccountId, 'success');

      await setCurrentAccount(targetAccountId);
      return result;
    } catch (error) {
      const apiError = parseApiError(error, 'Failed to revoke tokens');
      setAccountError(targetAccountId, apiError.message);
      return null;
    }
  }, [targetAccountId, authService, setAccountStatus, setAccountError]);

  const getTokenInformation = useCallback(async () => {
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
  }, [targetAccountId, authService, setAccountStatus, setAccountError]);

  const updateAccount = useCallback(
    async (updates: AccountUpdateRequest) => {
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
    [targetAccountId, accountService, setAccountStatus, setAccountData, setAccountError],
  );

  const switchToThisAccount = useCallback(async () => {
    if (!targetAccountId) return;

    try {
      setAccountStatus(targetAccountId, 'switching', 'switchToThisAccount');
      await setCurrentAccount(targetAccountId);
    } catch (error) {
      const apiError = parseApiError(error, 'Failed to switch to this account');
      setAccountError(targetAccountId, apiError.message);
    }
  }, [targetAccountId, setAccountStatus, setAccountError]);

  // Auto-load account data on mount (if enabled and targetAccountId exists)
  useEffect(() => {
    if (autoLoad && targetAccountId && useAppStore.getState().shouldLoadAccount(targetAccountId)) {
      load();
    }
  }, [autoLoad, targetAccountId]);

  // Derived state
  const exists = !!accountState.data;
  const isCurrent = currentAccountId === targetAccountId;

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
    load,
    logout,
    changePassword,
    revokeTokens,
    getTokenInformation,
    updateAccount,
    switchToThisAccount,
  };
}
