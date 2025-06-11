import { useAuthStore } from '../../store/authStore';
import { Account, AccountSessionInfo, LoadingInfo } from '../../types';

// Interface for the auth core hook return type
interface UseAuthCoreReturn {
  // State Selectors
  session: AccountSessionInfo | null;
  accounts: Account[];
  currentAccount: Account | null;
  currentAccountId: string | null;
  accountIds: string[];
  isAuthenticated: boolean;
  hasValidSession: boolean;
  tempToken: string | null;

  // Store Actions
  setSession: (session: AccountSessionInfo) => void;
  clearSession: () => void;
  setAccountData: (accountId: string, account: Account) => void;
  setSessionAccountData: (
    accountId: string,
    partialAccount: Partial<Account>,
  ) => void;
  updateAccountData: (accountId: string, updates: Partial<Account>) => void;
  setTempToken: (tempToken: string) => void;
  clearTempToken: () => void;

  // Store Utilities
  getAccountById: (accountId: string) => Account | null;
  hasAccountData: (accountId: string) => boolean;
  hasFullAccountData: (accountId: string) => boolean;
  needsAccountData: (accountId: string) => boolean;

  // Loading and Error State
  setLoadingState: (key: string, loadingInfo: LoadingInfo) => void;
  clearLoadingState: (key: string) => void;
  setError: (key: string, error: string) => void;
  clearError: (key: string) => void;
  getLoadingState: (key: string) => LoadingInfo | null;
  getError: (key: string) => string | null;
}

/**
 * Core hook that provides direct access to the auth store
 * This is the lowest level hook that other hooks should use
 */
export const useAuthCore = (): UseAuthCoreReturn => {
  const store = useAuthStore();

  return {
    // State Selectors - these are computed values from the store
    session: store.session,
    accounts: store.getAccounts(),
    currentAccount: store.getCurrentAccount(),
    currentAccountId: store.getCurrentAccountId(),
    accountIds: store.getAccountIds(),
    isAuthenticated: store.isAuthenticated(),
    hasValidSession: store.hasValidSession(),
    tempToken: store.tempToken,

    // Store Actions - these are direct store methods
    setSession: store.setSession,
    clearSession: store.clearSession,
    setAccountData: store.setAccountData,
    setSessionAccountData: store.setSessionAccountData,
    updateAccountData: store.updateAccountData,
    setTempToken: store.setTempToken,
    clearTempToken: store.clearTempToken,

    // Store Utilities - these are computed methods
    getAccountById: store.getAccountById,
    hasAccountData: store.hasAccountData,
    hasFullAccountData: store.hasFullAccountData,
    needsAccountData: store.needsAccountData,

    // Loading and Error State - these are state management methods
    setLoadingState: store.setLoadingState,
    clearLoadingState: store.clearLoadingState,
    setError: store.setError,
    clearError: store.clearError,
    getLoadingState: store.getLoadingState,
    getError: store.getError,
  };
};
