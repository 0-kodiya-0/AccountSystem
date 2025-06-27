import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAccount } from '../useAccount';
import { useAppStore } from '../../store/useAppStore';
import { Account, AccountType, AccountStatus, AuthSDKError, ApiErrorCode } from '../../types';

// Mock dependencies
const mockAuthService = {
  logout: vi.fn(),
  changePassword: vi.fn(),
  revokeTokens: vi.fn(),
  getAccessTokenInfo: vi.fn(),
};

const mockAccountService = {
  getAccount: vi.fn(),
  updateAccount: vi.fn(),
};

const mockUseSession = {
  currentAccountId: null as string | null,
  setCurrentAccount: vi.fn(),
  load: vi.fn(),
};

// Mock the hooks and services
vi.mock('../hooks/useSession', () => ({
  useSession: () => mockUseSession,
}));

vi.mock('../../context/ServicesProvider', () => ({
  useAuthService: () => mockAuthService,
  useAccountService: () => mockAccountService,
}));

// Mock the store
const mockShouldLoadAccount = vi.fn();
const mockStoreActions = {
  setAccountStatus: vi.fn(),
  setAccountData: vi.fn(),
  setAccountError: vi.fn(),
  getAccountState: vi.fn(),
  shouldLoadAccount: mockShouldLoadAccount,
};

vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn(),
}));

const mockUseAppStore = vi.mocked(useAppStore);

describe('useAccount', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const currentAccountId = '507f1f77bcf86cd799439011';
  const differentAccountId = '507f1f77bcf86cd799439012';

  const mockAccount: Account = {
    id: accountId,
    created: '2024-01-01T00:00:00.000Z',
    updated: '2024-01-01T00:00:00.000Z',
    accountType: AccountType.Local,
    status: AccountStatus.Active,
    userDetails: {
      firstName: 'John',
      lastName: 'Doe',
      name: 'John Doe',
      email: 'john@example.com',
      emailVerified: true,
    },
    security: {
      twoFactorEnabled: false,
      sessionTimeout: 3600,
      autoLock: false,
    },
  };

  const defaultAccountState = {
    data: null,
    status: 'idle' as const,
    currentOperation: null,
    error: null,
    lastLoaded: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    mockUseSession.currentAccountId = currentAccountId;
    mockShouldLoadAccount.mockReturnValue(false);

    mockUseAppStore.mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector({
          ...mockStoreActions,
          getAccountState: (id: string) => (id === accountId ? defaultAccountState : undefined),
        } as any);
      }
      return mockStoreActions;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Hook Overloads', () => {
    test('should work with current account (no ID)', () => {
      const { result } = renderHook(() => useAccount());

      expect(result.current.id).toBe(currentAccountId);
      expect(result.current.isCurrent).toBe(true);
    });

    test('should work with specific account ID', () => {
      const { result } = renderHook(() => useAccount(differentAccountId));

      expect(result.current.id).toBe(differentAccountId);
      expect(result.current.isCurrent).toBe(false);
    });

    test('should handle options correctly', () => {
      // Test with options as first parameter (current account)
      const { result: result1 } = renderHook(() => useAccount({ autoLoad: false, autoLoadSession: false }));

      expect(result1.current.id).toBe(currentAccountId);

      // Test with accountId and options
      const { result: result2 } = renderHook(() =>
        useAccount(differentAccountId, { autoLoad: false, autoLoadSession: false }),
      );

      expect(result2.current.id).toBe(differentAccountId);
    });

    test('should handle null current account ID', () => {
      mockUseSession.currentAccountId = null;

      const { result } = renderHook(() => useAccount());

      expect(result.current.id).toBeNull();
      expect(result.current.data).toBeNull();
      expect(result.current.exists).toBe(false);
    });
  });

  describe('Account Loading', () => {
    test('should load account automatically when autoLoad is true', async () => {
      mockShouldLoadAccount.mockReturnValue(true);
      mockAccountService.getAccount.mockResolvedValue(mockAccount);

      const setAccountStatus = vi.fn();
      const setAccountData = vi.fn();

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector({
            ...mockStoreActions,
            setAccountStatus,
            setAccountData,
            getAccountState: () => defaultAccountState,
            shouldLoadAccount: mockShouldLoadAccount,
          } as any);
        }
        return mockStoreActions;
      });

      renderHook(() => useAccount(accountId, { autoLoad: true }));

      // Wait for useEffect to run
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockAccountService.getAccount).toHaveBeenCalledWith(accountId);
      expect(setAccountStatus).toHaveBeenCalledWith(accountId, 'loading', 'load');
      expect(setAccountData).toHaveBeenCalledWith(accountId, mockAccount);
    });

    test('should not load account when autoLoad is false', () => {
      mockShouldLoadAccount.mockReturnValue(true);

      renderHook(() => useAccount(accountId, { autoLoad: false }));

      expect(mockAccountService.getAccount).not.toHaveBeenCalled();
    });

    test('should not load account when shouldLoadAccount returns false', () => {
      mockShouldLoadAccount.mockReturnValue(false);

      renderHook(() => useAccount(accountId, { autoLoad: true }));

      expect(mockAccountService.getAccount).not.toHaveBeenCalled();
    });

    test('should handle loading errors', async () => {
      mockShouldLoadAccount.mockReturnValue(true);
      const error = new AuthSDKError('Account not found', ApiErrorCode.ACCOUNT_NOT_FOUND);
      mockAccountService.getAccount.mockRejectedValue(error);

      const setAccountStatus = vi.fn();
      const setAccountError = vi.fn();

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector({
            ...mockStoreActions,
            setAccountStatus,
            setAccountError,
            getAccountState: () => defaultAccountState,
            shouldLoadAccount: mockShouldLoadAccount,
          } as any);
        }
        return mockStoreActions;
      });

      renderHook(() => useAccount(accountId, { autoLoad: true }));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(setAccountError).toHaveBeenCalledWith(accountId, 'Account not found');
    });

    test('should update store on successful load', async () => {
      mockShouldLoadAccount.mockReturnValue(true);
      mockAccountService.getAccount.mockResolvedValue(mockAccount);

      const setAccountData = vi.fn();

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector({
            ...mockStoreActions,
            setAccountData,
            setAccountStatus: vi.fn(),
            getAccountState: () => defaultAccountState,
            shouldLoadAccount: mockShouldLoadAccount,
          } as any);
        }
        return mockStoreActions;
      });

      renderHook(() => useAccount(accountId, { autoLoad: true }));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(setAccountData).toHaveBeenCalledWith(accountId, mockAccount);
    });

    test('should not load when no account ID available', () => {
      mockUseSession.currentAccountId = null;
      mockShouldLoadAccount.mockReturnValue(true);

      renderHook(() => useAccount({ autoLoad: true }));

      expect(mockAccountService.getAccount).not.toHaveBeenCalled();
    });
  });

  describe('Derived State', () => {
    test('should determine if account exists', () => {
      // Test with account data
      const storeWithAccount = {
        ...mockStoreActions,
        getAccountState: () => ({
          ...defaultAccountState,
          data: mockAccount,
        }),
      };

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(storeWithAccount as any);
        }
        return storeWithAccount;
      });

      const { result } = renderHook(() => useAccount(accountId));

      expect(result.current.exists).toBe(true);
      expect(result.current.data).toEqual(mockAccount);

      // Test without account data
      const storeWithoutAccount = {
        ...mockStoreActions,
        getAccountState: () => defaultAccountState,
      };

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(storeWithoutAccount as any);
        }
        return storeWithoutAccount;
      });

      const { result: result2 } = renderHook(() => useAccount(accountId));

      expect(result2.current.exists).toBe(false);
      expect(result2.current.data).toBeNull();
    });

    test('should determine if account is current', () => {
      mockUseSession.currentAccountId = currentAccountId;

      // Test with current account
      const { result: result1 } = renderHook(() => useAccount(currentAccountId));
      expect(result1.current.isCurrent).toBe(true);

      // Test with different account
      const { result: result2 } = renderHook(() => useAccount(differentAccountId));
      expect(result2.current.isCurrent).toBe(false);

      // Test with no current account
      mockUseSession.currentAccountId = null;
      const { result: result3 } = renderHook(() => useAccount(currentAccountId));
      expect(result3.current.isCurrent).toBe(false);
    });

    test('should provide status helpers', () => {
      // Test loading state
      const storeWithLoading = {
        ...mockStoreActions,
        getAccountState: () => ({
          ...defaultAccountState,
          status: 'loading' as const,
        }),
      };

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(storeWithLoading as any);
        }
        return storeWithLoading;
      });

      const { result: result1 } = renderHook(() => useAccount(accountId));

      expect(result1.current.isLoading).toBe(true);
      expect(result1.current.isUpdating).toBe(false);
      expect(result1.current.isSaving).toBe(false);
      expect(result1.current.isDeleting).toBe(false);
      expect(result1.current.isIdle).toBe(false);
      expect(result1.current.hasError).toBe(false);
      expect(result1.current.isSuccess).toBe(false);

      // Test error state
      const storeWithError = {
        ...mockStoreActions,
        getAccountState: () => ({
          ...defaultAccountState,
          status: 'error' as const,
          error: 'Something went wrong',
        }),
      };

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(storeWithError as any);
        }
        return storeWithError;
      });

      const { result: result2 } = renderHook(() => useAccount(accountId));

      expect(result2.current.hasError).toBe(true);
      expect(result2.current.error).toBe('Something went wrong');
      expect(result2.current.isLoading).toBe(false);

      // Test success state
      const storeWithSuccess = {
        ...mockStoreActions,
        getAccountState: () => ({
          ...defaultAccountState,
          status: 'success' as const,
          data: mockAccount,
        }),
      };

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(storeWithSuccess as any);
        }
        return storeWithSuccess;
      });

      const { result: result3 } = renderHook(() => useAccount(accountId));

      expect(result3.current.isSuccess).toBe(true);
      expect(result3.current.hasError).toBe(false);
      expect(result3.current.isLoading).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle operation errors gracefully', async () => {
      const error = new Error('Network error');
      mockAccountService.getAccount.mockRejectedValue(error);

      const setAccountError = vi.fn();

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector({
            ...mockStoreActions,
            setAccountError,
            setAccountStatus: vi.fn(),
            getAccountState: () => defaultAccountState,
          } as any);
        }
        return mockStoreActions;
      });

      const { result } = renderHook(() => useAccount(accountId));

      await act(async () => {
        const loadResult = await result.current.load();
        expect(loadResult).toBeNull();
      });

      expect(setAccountError).toHaveBeenCalledWith(accountId, 'Failed to load account: Network error');
    });

    test('should parse API errors correctly', async () => {
      const authSDKError = new AuthSDKError('Invalid account ID', ApiErrorCode.ACCOUNT_NOT_FOUND, 404);
      mockAccountService.getAccount.mockRejectedValue(authSDKError);

      const setAccountError = vi.fn();

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector({
            ...mockStoreActions,
            setAccountError,
            setAccountStatus: vi.fn(),
            getAccountState: () => defaultAccountState,
          } as any);
        }
        return mockStoreActions;
      });

      const { result } = renderHook(() => useAccount(accountId));

      await act(async () => {
        await result.current.load();
      });

      expect(setAccountError).toHaveBeenCalledWith(accountId, 'Invalid account ID');
    });

    test('should handle generic errors', async () => {
      const genericError = { message: 'Unknown error' };
      mockAccountService.getAccount.mockRejectedValue(genericError);

      const setAccountError = vi.fn();

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector({
            ...mockStoreActions,
            setAccountError,
            setAccountStatus: vi.fn(),
            getAccountState: () => defaultAccountState,
          } as any);
        }
        return mockStoreActions;
      });

      const { result } = renderHook(() => useAccount(accountId));

      await act(async () => {
        await result.current.load();
      });

      expect(setAccountError).toHaveBeenCalledWith(accountId, 'Failed to load account: Unknown error');
    });

    test('should handle operations when no account ID available', async () => {
      mockUseSession.currentAccountId = null;

      const { result } = renderHook(() => useAccount());

      // All operations should return null/void gracefully
      await act(async () => {
        const loadResult = await result.current.load();
        expect(loadResult).toBeNull();

        await result.current.logout();
        // Should not throw

        const changePasswordResult = await result.current.changePassword({
          oldPassword: 'old',
          newPassword: 'new',
          confirmPassword: 'new',
        });
        expect(changePasswordResult).toBeNull();
      });

      // No API calls should be made
      expect(mockAccountService.getAccount).not.toHaveBeenCalled();
      expect(mockAuthService.logout).not.toHaveBeenCalled();
      expect(mockAuthService.changePassword).not.toHaveBeenCalled();
    });

    test('should handle store access with missing account state', () => {
      // Mock store to return undefined for account state
      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector({
            ...mockStoreActions,
            getAccountState: () => undefined,
          } as any);
        }
        return mockStoreActions;
      });

      const { result } = renderHook(() => useAccount(accountId));

      // Should use INITIAL_ACCOUNT_STATE when store returns undefined
      expect(result.current.data).toBeNull();
      expect(result.current.status).toBe('idle');
      expect(result.current.error).toBeNull();
      expect(result.current.exists).toBe(false);
    });
  });

  describe('Manual Load Operation', () => {
    test('should perform manual load with proper state management', async () => {
      mockAccountService.getAccount.mockResolvedValue(mockAccount);

      const setAccountStatus = vi.fn();
      const setAccountData = vi.fn();

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector({
            ...mockStoreActions,
            setAccountStatus,
            setAccountData,
            getAccountState: () => defaultAccountState,
          } as any);
        }
        return mockStoreActions;
      });

      const { result } = renderHook(() => useAccount(accountId, { autoLoad: false }));

      await act(async () => {
        const loadResult = await result.current.load();
        expect(loadResult).toEqual(mockAccount);
      });

      expect(setAccountStatus).toHaveBeenCalledWith(accountId, 'loading', 'load');
      expect(mockAccountService.getAccount).toHaveBeenCalledWith(accountId);
      expect(setAccountData).toHaveBeenCalledWith(accountId, mockAccount);
    });
  });
});
