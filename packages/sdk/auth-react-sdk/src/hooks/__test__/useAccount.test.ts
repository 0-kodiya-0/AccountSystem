import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAccount } from '../useAccount';
import { useAppStore } from '../../store/useAppStore';
import { AuthSDKError, ApiErrorCode } from '../../types';
import {
  createMockAuthService,
  createMockAccountService,
  createMockAccount,
  createMockSessionData,
  resetAppStore,
  setMockSessionState,
  TEST_CONSTANTS,
} from '../../test/utils';

// Mock services
const mockAuthService = createMockAuthService();
const mockAccountService = createMockAccountService();

vi.mock('../../context/ServicesProvider', () => ({
  useAuthService: () => mockAuthService,
  useAccountService: () => mockAccountService,
}));

describe('useAccount', () => {
  const { CURRENT: accountId, DIFFERENT: differentAccountId } = TEST_CONSTANTS.ACCOUNT_IDS;
  const mockAccount = createMockAccount();
  const mockSessionData = createMockSessionData();

  beforeEach(() => {
    resetAppStore();
    setMockSessionState(mockSessionData);
  });

  describe('Hook Initialization', () => {
    it('should work with current account when no ID provided', async () => {
      // Set up mock state with current account
      setMockSessionState(createMockSessionData({ currentAccountId: accountId }));

      let result: any;
      await act(async () => {
        const hookResult = renderHook(() => useAccount({ autoLoad: false, autoLoadSession: false }));
        result = hookResult.result;
      });

      expect(result.current.id).toBe(accountId);
      expect(result.current.isCurrent).toBe(true);
    });

    it('should work with specific account ID', async () => {
      // Set up mock state
      setMockSessionState(createMockSessionData({ currentAccountId: accountId }));

      let result: any;
      await act(async () => {
        const hookResult = renderHook(() =>
          useAccount(differentAccountId, { autoLoad: false, autoLoadSession: false }),
        );
        result = hookResult.result;
      });

      expect(result.current.id).toBe(differentAccountId);
      expect(result.current.isCurrent).toBe(false);
    });

    it('should handle null current account gracefully', async () => {
      setMockSessionState(createMockSessionData({ currentAccountId: null }));

      let result: any;
      await act(async () => {
        const hookResult = renderHook(() => useAccount({ autoLoad: false, autoLoadSession: false }));
        result = hookResult.result;
      });

      expect(result.current.id).toBeNull();
      expect(result.current.exists).toBe(false);
    });
  });

  describe('Account Loading', () => {
    it('should load account when manually called', async () => {
      mockAccountService.getAccount.mockResolvedValue(mockAccount);

      const { result } = renderHook(() => useAccount(accountId, { autoLoad: false, autoLoadSession: false }));

      await act(async () => {
        const loadResult = await result.current.load();
        expect(loadResult).toEqual(mockAccount);
      });

      expect(mockAccountService.getAccount).toHaveBeenCalledWith(accountId);
      expect(result.current.data).toEqual(mockAccount);
      expect(result.current.status).toBe('success');
    });

    it('should handle loading errors', async () => {
      const error = new AuthSDKError('Account not found', ApiErrorCode.ACCOUNT_NOT_FOUND);
      mockAccountService.getAccount.mockRejectedValue(error);

      const { result } = renderHook(() => useAccount(accountId, { autoLoad: false, autoLoadSession: false }));

      await act(async () => {
        await result.current.load();
      });

      expect(result.current.error).toBe('Account not found');
      expect(result.current.status).toBe('error');
    });
  });

  describe('Account Operations', () => {
    it('should handle logout operation', async () => {
      mockAuthService.logout.mockResolvedValue({ message: 'Logged out successfully' });

      const { result } = renderHook(() => useAccount(accountId, { autoLoad: false, autoLoadSession: false }));

      await act(async () => {
        await result.current.logout();
      });

      expect(mockAuthService.logout).toHaveBeenCalledWith(accountId);
    });

    it('should handle password change operation', async () => {
      const passwordData = {
        oldPassword: 'oldpass',
        newPassword: 'newpass',
        confirmPassword: 'newpass',
      };

      mockAuthService.changePassword.mockResolvedValue({ message: 'Password changed' });

      const { result } = renderHook(() => useAccount(accountId, { autoLoad: false, autoLoadSession: false }));

      await act(async () => {
        const changeResult = await result.current.changePassword(passwordData);
        expect(changeResult).toEqual({ message: 'Password changed' });
      });

      expect(mockAuthService.changePassword).toHaveBeenCalledWith(accountId, passwordData);
    });

    it('should handle operations gracefully when no account ID available', async () => {
      setMockSessionState(
        createMockSessionData({
          accountIds: [],
          currentAccountId: null,
        }),
      );

      const { result } = renderHook(() => useAccount({ autoLoad: false, autoLoadSession: false }));

      await act(async () => {
        const loadResult = await result.current.load();
        expect(loadResult).toBeNull();

        await result.current.logout();

        const changePasswordResult = await result.current.changePassword({
          oldPassword: 'old',
          newPassword: 'new',
          confirmPassword: 'new',
        });
        expect(changePasswordResult).toBeNull();
      });

      expect(mockAccountService.getAccount).not.toHaveBeenCalled();
      expect(mockAuthService.logout).not.toHaveBeenCalled();
      expect(mockAuthService.changePassword).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle and parse different error types', async () => {
      const { result } = renderHook(() => useAccount(accountId, { autoLoad: false, autoLoadSession: false }));

      // Test AuthSDKError
      const authSDKError = new AuthSDKError('Invalid account ID', ApiErrorCode.ACCOUNT_NOT_FOUND, 404);
      mockAccountService.getAccount.mockRejectedValue(authSDKError);

      await act(async () => {
        await result.current.load();
      });

      expect(result.current.error).toBe('Invalid account ID');
      expect(result.current.status).toBe('error');

      // Test generic error
      const genericError = { message: 'Unknown error' };
      mockAccountService.getAccount.mockRejectedValue(genericError);

      await act(async () => {
        await result.current.load();
      });

      expect(result.current.error).toBe('Unknown error');
      expect(result.current.status).toBe('error');
    });
  });

  describe('State Management', () => {
    it('should provide correct existence and current status', () => {
      // Set up account data in store
      useAppStore.setState((state) => ({
        ...state,
        accounts: {
          [accountId]: {
            data: mockAccount,
            status: 'success',
            currentOperation: null,
            error: null,
            lastLoaded: Date.now(),
          },
        },
      }));

      const { result } = renderHook(() => useAccount(accountId, { autoLoad: false, autoLoadSession: false }));
      expect(result.current.exists).toBe(true);
      expect(result.current.data).toEqual(mockAccount);
      expect(result.current.isCurrent).toBe(true);
    });

    it('should handle missing account state gracefully', () => {
      const { result } = renderHook(() => useAccount(accountId, { autoLoad: false, autoLoadSession: false }));
      expect(result.current.data).toBeNull();
      expect(result.current.status).toBe('idle');
      expect(result.current.exists).toBe(false);
    });
  });
});
