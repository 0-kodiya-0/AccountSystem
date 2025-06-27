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

// Mock the services
vi.mock('../../context/ServicesProvider', () => ({
  useAuthService: () => mockAuthService,
  useAccountService: () => mockAccountService,
}));

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

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset store to clean state using direct access
    useAppStore.setState({
      session: {
        data: {
          hasSession: true,
          accountIds: [currentAccountId, differentAccountId],
          currentAccountId: currentAccountId,
          isValid: true,
        },
        status: 'success',
        currentOperation: null,
        error: null,
        lastLoaded: Date.now(),
      },
      accounts: {},
      sessionAccounts: {
        data: [],
        status: 'idle',
        currentOperation: null,
        error: null,
        lastLoaded: null,
      },
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
      // Set current account to null in store
      useAppStore.setState({
        session: {
          data: {
            hasSession: true,
            accountIds: [accountId, differentAccountId],
            currentAccountId: null,
            isValid: true,
          },
          status: 'success',
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        },
        accounts: {},
        sessionAccounts: {
          data: [],
          status: 'idle',
          currentOperation: null,
          error: null,
          lastLoaded: null,
        },
      });

      const { result } = renderHook(() => useAccount());

      expect(result.current.id).toBeNull();
      expect(result.current.data).toBeNull();
      expect(result.current.exists).toBe(false);
    });
  });

  describe('Account Loading', () => {
    test('should load account automatically when autoLoad is true', async () => {
      // Mock shouldLoadAccount to return true
      const originalShouldLoadAccount = useAppStore.getState().shouldLoadAccount;
      useAppStore.getState().shouldLoadAccount = vi.fn().mockReturnValue(true);

      mockAccountService.getAccount.mockResolvedValue(mockAccount);

      const { unmount } = renderHook(() => useAccount(accountId, { autoLoad: true }));

      // Wait for useEffect to run
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(mockAccountService.getAccount).toHaveBeenCalledWith(accountId);

      // Check that store was updated
      const currentState = useAppStore.getState();
      expect(currentState.accounts[accountId]?.data).toEqual(mockAccount);
      expect(currentState.accounts[accountId]?.status).toBe('success');

      // Restore original function
      useAppStore.getState().shouldLoadAccount = originalShouldLoadAccount;
      unmount();
    });

    test('should not load account when autoLoad is false', () => {
      const originalShouldLoadAccount = useAppStore.getState().shouldLoadAccount;
      useAppStore.getState().shouldLoadAccount = vi.fn().mockReturnValue(true);

      const { unmount } = renderHook(() => useAccount(accountId, { autoLoad: false }));

      expect(mockAccountService.getAccount).not.toHaveBeenCalled();

      // Restore original function
      useAppStore.getState().shouldLoadAccount = originalShouldLoadAccount;
      unmount();
    });

    test('should not load account when shouldLoadAccount returns false', () => {
      const originalShouldLoadAccount = useAppStore.getState().shouldLoadAccount;
      useAppStore.getState().shouldLoadAccount = vi.fn().mockReturnValue(false);

      const { unmount } = renderHook(() => useAccount(accountId, { autoLoad: true }));

      expect(mockAccountService.getAccount).not.toHaveBeenCalled();

      // Restore original function
      useAppStore.getState().shouldLoadAccount = originalShouldLoadAccount;
      unmount();
    });

    test('should handle loading errors', async () => {
      const originalShouldLoadAccount = useAppStore.getState().shouldLoadAccount;
      useAppStore.getState().shouldLoadAccount = vi.fn().mockReturnValue(true);

      const error = new AuthSDKError('Account not found', ApiErrorCode.ACCOUNT_NOT_FOUND);
      mockAccountService.getAccount.mockRejectedValue(error);

      const { unmount } = renderHook(() => useAccount(accountId, { autoLoad: true }));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Check that error was set in store
      const currentState = useAppStore.getState();
      expect(currentState.accounts[accountId]?.error).toBe('Account not found');
      expect(currentState.accounts[accountId]?.status).toBe('error');

      // Restore original function
      useAppStore.getState().shouldLoadAccount = originalShouldLoadAccount;
      unmount();
    });

    test('should update store on successful load', async () => {
      const originalShouldLoadAccount = useAppStore.getState().shouldLoadAccount;
      useAppStore.getState().shouldLoadAccount = vi.fn().mockReturnValue(true);

      mockAccountService.getAccount.mockResolvedValue(mockAccount);

      const { unmount } = renderHook(() => useAccount(accountId, { autoLoad: true }));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Check that account was set in store
      const currentState = useAppStore.getState();
      expect(currentState.accounts[accountId]?.data).toEqual(mockAccount);

      // Restore original function
      useAppStore.getState().shouldLoadAccount = originalShouldLoadAccount;
      unmount();
    });

    test('should not load when no account ID available', () => {
      // Set current account to null
      useAppStore.setState({
        session: {
          data: {
            hasSession: true,
            accountIds: [],
            currentAccountId: null,
            isValid: true,
          },
          status: 'success',
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        },
        accounts: {},
        sessionAccounts: {
          data: [],
          status: 'idle',
          currentOperation: null,
          error: null,
          lastLoaded: null,
        },
      });

      const originalShouldLoadAccount = useAppStore.getState().shouldLoadAccount;
      useAppStore.getState().shouldLoadAccount = vi.fn().mockReturnValue(true);

      const { unmount } = renderHook(() => useAccount({ autoLoad: true }));

      expect(mockAccountService.getAccount).not.toHaveBeenCalled();

      // Restore original function
      useAppStore.getState().shouldLoadAccount = originalShouldLoadAccount;
      unmount();
    });
  });

  describe('Derived State', () => {
    test('should determine if account exists', () => {
      // Test with account data
      useAppStore.setState({
        session: {
          data: {
            hasSession: true,
            accountIds: [accountId],
            currentAccountId: accountId,
            isValid: true,
          },
          status: 'success',
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        },
        accounts: {
          [accountId]: {
            data: mockAccount,
            status: 'success',
            currentOperation: null,
            error: null,
            lastLoaded: Date.now(),
          },
        },
        sessionAccounts: {
          data: [],
          status: 'idle',
          currentOperation: null,
          error: null,
          lastLoaded: null,
        },
      });

      const { result, unmount } = renderHook(() => useAccount(accountId));

      expect(result.current.exists).toBe(true);
      expect(result.current.data).toEqual(mockAccount);
      unmount();

      // Test without account data - reset to clean state
      useAppStore.setState({
        session: {
          data: {
            hasSession: true,
            accountIds: [accountId],
            currentAccountId: accountId,
            isValid: true,
          },
          status: 'success',
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        },
        accounts: {},
        sessionAccounts: {
          data: [],
          status: 'idle',
          currentOperation: null,
          error: null,
          lastLoaded: null,
        },
      });

      const { result: result2, unmount: unmount2 } = renderHook(() => useAccount(accountId));

      expect(result2.current.exists).toBe(false);
      expect(result2.current.data).toBeNull();
      unmount2();
    });

    test('should determine if account is current', () => {
      // Test with current account
      const { result: result1, unmount: unmount1 } = renderHook(() => useAccount(currentAccountId));
      expect(result1.current.isCurrent).toBe(true);
      unmount1();

      // Test with different account
      const { result: result2, unmount: unmount2 } = renderHook(() => useAccount(differentAccountId));
      expect(result2.current.isCurrent).toBe(false);
      unmount2();

      // Test with no current account
      useAppStore.setState({
        session: {
          data: {
            hasSession: true,
            accountIds: [currentAccountId, differentAccountId],
            currentAccountId: null,
            isValid: true,
          },
          status: 'success',
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        },
        accounts: {},
        sessionAccounts: {
          data: [],
          status: 'idle',
          currentOperation: null,
          error: null,
          lastLoaded: null,
        },
      });

      const { result: result3, unmount: unmount3 } = renderHook(() => useAccount(currentAccountId));
      expect(result3.current.isCurrent).toBe(false);
      unmount3();
    });

    test('should provide status helpers', () => {
      // Test loading state
      useAppStore.setState({
        session: {
          data: {
            hasSession: true,
            accountIds: [accountId],
            currentAccountId: accountId,
            isValid: true,
          },
          status: 'success',
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        },
        accounts: {
          [accountId]: {
            data: null,
            status: 'loading',
            currentOperation: 'load',
            error: null,
            lastLoaded: null,
          },
        },
        sessionAccounts: {
          data: [],
          status: 'idle',
          currentOperation: null,
          error: null,
          lastLoaded: null,
        },
      });

      const { result: result1, unmount: unmount1 } = renderHook(() => useAccount(accountId));

      expect(result1.current.isLoading).toBe(true);
      expect(result1.current.isUpdating).toBe(false);
      expect(result1.current.isSaving).toBe(false);
      expect(result1.current.isDeleting).toBe(false);
      expect(result1.current.isIdle).toBe(false);
      expect(result1.current.hasError).toBe(false);
      expect(result1.current.isSuccess).toBe(false);
      unmount1();

      // Test error state
      useAppStore.setState({
        session: {
          data: {
            hasSession: true,
            accountIds: [accountId],
            currentAccountId: accountId,
            isValid: true,
          },
          status: 'success',
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        },
        accounts: {
          [accountId]: {
            data: null,
            status: 'error',
            currentOperation: null,
            error: 'Something went wrong',
            lastLoaded: null,
          },
        },
        sessionAccounts: {
          data: [],
          status: 'idle',
          currentOperation: null,
          error: null,
          lastLoaded: null,
        },
      });

      const { result: result2, unmount: unmount2 } = renderHook(() => useAccount(accountId));

      expect(result2.current.hasError).toBe(true);
      expect(result2.current.error).toBe('Something went wrong');
      expect(result2.current.isLoading).toBe(false);
      unmount2();

      // Test success state
      useAppStore.setState({
        session: {
          data: {
            hasSession: true,
            accountIds: [accountId],
            currentAccountId: accountId,
            isValid: true,
          },
          status: 'success',
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        },
        accounts: {
          [accountId]: {
            data: mockAccount,
            status: 'success',
            currentOperation: null,
            error: null,
            lastLoaded: Date.now(),
          },
        },
        sessionAccounts: {
          data: [],
          status: 'idle',
          currentOperation: null,
          error: null,
          lastLoaded: null,
        },
      });

      const { result: result3, unmount: unmount3 } = renderHook(() => useAccount(accountId));

      expect(result3.current.isSuccess).toBe(true);
      expect(result3.current.hasError).toBe(false);
      expect(result3.current.isLoading).toBe(false);
      unmount3();
    });
  });

  describe('Error Handling', () => {
    test('should handle operation errors gracefully', async () => {
      const error = new Error('Network error');
      mockAccountService.getAccount.mockRejectedValue(error);

      const { result, unmount } = renderHook(() => useAccount(accountId));

      await act(async () => {
        const loadResult = await result.current.load();
        expect(loadResult).toBeNull();
      });

      // Check that error was set in store
      const currentState = useAppStore.getState();
      expect(currentState.accounts[accountId]?.error).toBe('Failed to load account: Network error');

      unmount();
    });

    test('should parse API errors correctly', async () => {
      const authSDKError = new AuthSDKError('Invalid account ID', ApiErrorCode.ACCOUNT_NOT_FOUND, 404);
      mockAccountService.getAccount.mockRejectedValue(authSDKError);

      const { result, unmount } = renderHook(() => useAccount(accountId));

      await act(async () => {
        await result.current.load();
      });

      // Check that error was set in store
      const currentState = useAppStore.getState();
      expect(currentState.accounts[accountId]?.error).toBe('Invalid account ID');

      unmount();
    });

    test('should handle generic errors', async () => {
      const genericError = { message: 'Unknown error' };
      mockAccountService.getAccount.mockRejectedValue(genericError);

      const { result, unmount } = renderHook(() => useAccount(accountId));

      await act(async () => {
        await result.current.load();
      });

      // Check that error was set in store
      const currentState = useAppStore.getState();
      expect(currentState.accounts[accountId]?.error).toBe('Failed to load account: Unknown error');

      unmount();
    });

    test('should handle operations when no account ID available', async () => {
      // Set current account to null
      useAppStore.setState({
        session: {
          data: {
            hasSession: true,
            accountIds: [],
            currentAccountId: null,
            isValid: true,
          },
          status: 'success',
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        },
        accounts: {},
        sessionAccounts: {
          data: [],
          status: 'idle',
          currentOperation: null,
          error: null,
          lastLoaded: null,
        },
      });

      const { result, unmount } = renderHook(() => useAccount());

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

      unmount();
    });

    test('should handle store access with missing account state', () => {
      // Clean state with no accounts
      useAppStore.setState({
        session: {
          data: {
            hasSession: true,
            accountIds: [accountId],
            currentAccountId: accountId,
            isValid: true,
          },
          status: 'success',
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        },
        accounts: {}, // No account data
        sessionAccounts: {
          data: [],
          status: 'idle',
          currentOperation: null,
          error: null,
          lastLoaded: null,
        },
      });

      const { result, unmount } = renderHook(() => useAccount(accountId));

      // Should use INITIAL_ACCOUNT_STATE when store returns undefined
      expect(result.current.data).toBeNull();
      expect(result.current.status).toBe('idle');
      expect(result.current.error).toBeNull();
      expect(result.current.exists).toBe(false);

      unmount();
    });
  });

  describe('Manual Load Operation', () => {
    test('should perform manual load with proper state management', async () => {
      mockAccountService.getAccount.mockResolvedValue(mockAccount);

      const { result, unmount } = renderHook(() => useAccount(accountId, { autoLoad: false }));

      await act(async () => {
        const loadResult = await result.current.load();
        expect(loadResult).toEqual(mockAccount);
      });

      expect(mockAccountService.getAccount).toHaveBeenCalledWith(accountId);

      // Check that store was updated
      const currentState = useAppStore.getState();
      expect(currentState.accounts[accountId]?.data).toEqual(mockAccount);
      expect(currentState.accounts[accountId]?.status).toBe('success');

      unmount();
    });
  });

  describe('Account Operations', () => {
    test('should handle logout operation', async () => {
      mockAuthService.logout.mockResolvedValue({ message: 'Logged out successfully' });

      const { result, unmount } = renderHook(() => useAccount(accountId));

      await act(async () => {
        await result.current.logout();
      });

      expect(mockAuthService.logout).toHaveBeenCalledWith(accountId);

      // Check that status was updated
      const currentState = useAppStore.getState();
      expect(currentState.accounts[accountId]?.status).toBe('success');

      unmount();
    });

    test('should handle change password operation', async () => {
      const passwordData = {
        oldPassword: 'oldpass',
        newPassword: 'newpass',
        confirmPassword: 'newpass',
      };

      mockAuthService.changePassword.mockResolvedValue({ message: 'Password changed' });

      const { result, unmount } = renderHook(() => useAccount(accountId));

      await act(async () => {
        const changeResult = await result.current.changePassword(passwordData);
        expect(changeResult).toEqual({ message: 'Password changed' });
      });

      expect(mockAuthService.changePassword).toHaveBeenCalledWith(accountId, passwordData);

      unmount();
    });

    test('should handle update account operation', async () => {
      const updates = {
        firstName: 'Jane',
        lastName: 'Smith',
      };

      const updatedAccount = {
        ...mockAccount,
        userDetails: { ...mockAccount.userDetails, firstName: 'Jane', lastName: 'Smith' },
      };
      mockAccountService.updateAccount.mockResolvedValue(updatedAccount);

      const { result, unmount } = renderHook(() => useAccount(accountId));

      await act(async () => {
        const updateResult = await result.current.updateAccount(updates);
        expect(updateResult).toEqual(updatedAccount);
      });

      expect(mockAccountService.updateAccount).toHaveBeenCalledWith(accountId, updates);

      // Check that store was updated with new account data
      const currentState = useAppStore.getState();
      expect(currentState.accounts[accountId]?.data).toEqual(updatedAccount);

      unmount();
    });

    test('should handle token operations', async () => {
      const tokenInfo = { isValid: true, expiresAt: Date.now() + 3600000 };
      mockAuthService.getAccessTokenInfo.mockResolvedValue(tokenInfo);
      mockAuthService.revokeTokens.mockResolvedValue({ message: 'Tokens revoked' });

      const { result, unmount } = renderHook(() => useAccount(accountId));

      // Test get token information
      await act(async () => {
        const tokenResult = await result.current.getTokenInformation();
        expect(tokenResult).toEqual(tokenInfo);
      });

      expect(mockAuthService.getAccessTokenInfo).toHaveBeenCalledWith(accountId);

      // Test revoke tokens
      await act(async () => {
        const revokeResult = await result.current.revokeTokens();
        expect(revokeResult).toEqual({ message: 'Tokens revoked' });
      });

      expect(mockAuthService.revokeTokens).toHaveBeenCalledWith(accountId);

      unmount();
    });
  });
});
