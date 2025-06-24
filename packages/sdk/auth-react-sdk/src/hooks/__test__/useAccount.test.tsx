import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAccount } from '../useAccount';
import { useSession } from '../useSession';
import { useAppStore } from '../../store/useAppStore';
import { useAuthService, useAccountService } from '../../context/ServicesProvider';
import { createMockAccount } from '../../test/utils';

// Mock the dependencies
vi.mock('../useSession');
vi.mock('../../store/useAppStore');
vi.mock('../../context/ServicesProvider');

describe('useAccount', () => {
  let mockAuthService: any;
  let mockAccountService: any;
  let mockUseSession: any;
  let mockStore: any;

  beforeEach(() => {
    // Setup mock services
    mockAuthService = {
      logout: vi.fn(),
      changePassword: vi.fn(),
      revokeTokens: vi.fn(),
      getAccessTokenInfo: vi.fn(),
    };

    mockAccountService = {
      getAccount: vi.fn(),
      updateAccount: vi.fn(),
    };

    // Setup mock session
    mockUseSession = vi.fn();

    // Setup mock store
    mockStore = {
      getAccountState: vi.fn(),
      setAccountStatus: vi.fn(),
      setAccountData: vi.fn(),
      setAccountError: vi.fn(),
      updateAccountData: vi.fn(),
      shouldLoadAccount: vi.fn(),
    };

    (useAuthService as any).mockReturnValue(mockAuthService);
    (useAccountService as any).mockReturnValue(mockAccountService);
    (useSession as any).mockImplementation(mockUseSession);
    (useAppStore as any).mockImplementation((selector: any) => {
      if (typeof selector === 'function') {
        return selector(mockStore);
      }
      return mockStore;
    });
  });

  describe('current account (no accountId parameter)', () => {
    it('should use current account from session', () => {
      const currentAccountId = '507f1f77bcf86cd799439011';
      const mockAccountState = {
        data: createMockAccount({ id: currentAccountId }),
        status: 'success',
        currentOperation: null,
        error: null,
        lastLoaded: Date.now(),
      };

      mockUseSession.mockReturnValue({
        currentAccountId,
        setCurrentAccount: vi.fn(),
        load: vi.fn(),
      });

      mockStore.getAccountState.mockReturnValue(mockAccountState);
      mockStore.shouldLoadAccount.mockReturnValue(false);

      const { result } = renderHook(() => useAccount());

      expect(result.current.id).toBe(currentAccountId);
      expect(result.current.data).toEqual(mockAccountState.data);
      expect(result.current.exists).toBe(true);
      expect(result.current.isCurrent).toBe(true);
    });

    it('should return null when no current account', () => {
      mockUseSession.mockReturnValue({
        currentAccountId: null,
        setCurrentAccount: vi.fn(),
        load: vi.fn(),
      });

      mockStore.getAccountState.mockReturnValue(null);

      const { result } = renderHook(() => useAccount());

      expect(result.current.id).toBeNull();
      expect(result.current.data).toBeNull();
      expect(result.current.exists).toBe(false);
      expect(result.current.isCurrent).toBe(false);
    });
  });

  describe('specific account (with accountId parameter)', () => {
    it('should use specified account ID', () => {
      const specificAccountId = '507f1f77bcf86cd799439012';
      const currentAccountId = '507f1f77bcf86cd799439011';
      const mockAccountState = {
        data: createMockAccount({ id: specificAccountId }),
        status: 'success',
        currentOperation: null,
        error: null,
        lastLoaded: Date.now(),
      };

      mockUseSession.mockReturnValue({
        currentAccountId,
        setCurrentAccount: vi.fn(),
        load: vi.fn(),
      });

      mockStore.getAccountState.mockReturnValue(mockAccountState);
      mockStore.shouldLoadAccount.mockReturnValue(false);

      const { result } = renderHook(() => useAccount(specificAccountId));

      expect(result.current.id).toBe(specificAccountId);
      expect(result.current.data).toEqual(mockAccountState.data);
      expect(result.current.exists).toBe(true);
      expect(result.current.isCurrent).toBe(false); // Different from current account
    });

    it('should detect when specific account is current account', () => {
      const accountId = '507f1f77bcf86cd799439011';
      const mockAccountState = {
        data: createMockAccount({ id: accountId }),
        status: 'success',
        currentOperation: null,
        error: null,
        lastLoaded: Date.now(),
      };

      mockUseSession.mockReturnValue({
        currentAccountId: accountId,
        setCurrentAccount: vi.fn(),
        load: vi.fn(),
      });

      mockStore.getAccountState.mockReturnValue(mockAccountState);
      mockStore.shouldLoadAccount.mockReturnValue(false);

      const { result } = renderHook(() => useAccount(accountId));

      expect(result.current.isCurrent).toBe(true);
    });
  });

  describe('account loading', () => {
    it('should auto-load account when autoLoad is true', () => {
      const accountId = '507f1f77bcf86cd799439011';

      mockUseSession.mockReturnValue({
        currentAccountId: accountId,
        setCurrentAccount: vi.fn(),
        load: vi.fn(),
      });

      mockStore.getAccountState.mockReturnValue({
        data: null,
        status: 'idle',
        currentOperation: null,
        error: null,
        lastLoaded: null,
      });

      mockStore.shouldLoadAccount.mockReturnValue(true);

      renderHook(() => useAccount(accountId, { autoLoad: true }));

      expect(mockStore.shouldLoadAccount).toHaveBeenCalledWith(accountId);
    });

    it('should not auto-load when autoLoad is false', () => {
      const accountId = '507f1f77bcf86cd799439011';

      mockUseSession.mockReturnValue({
        currentAccountId: accountId,
        setCurrentAccount: vi.fn(),
        load: vi.fn(),
      });

      mockStore.getAccountState.mockReturnValue({
        data: null,
        status: 'idle',
        currentOperation: null,
        error: null,
        lastLoaded: null,
      });

      mockStore.shouldLoadAccount.mockReturnValue(false);

      renderHook(() => useAccount(accountId, { autoLoad: false }));

      expect(mockStore.shouldLoadAccount).not.toHaveBeenCalled();
    });

    it('should load account successfully', async () => {
      const accountId = '507f1f77bcf86cd799439011';
      const mockAccount = createMockAccount({ id: accountId });

      mockUseSession.mockReturnValue({
        currentAccountId: accountId,
        setCurrentAccount: vi.fn(),
        load: vi.fn(),
      });

      mockStore.getAccountState.mockReturnValue({
        data: null,
        status: 'idle',
        currentOperation: null,
        error: null,
        lastLoaded: null,
      });

      mockAccountService.getAccount.mockResolvedValue(mockAccount);

      const { result } = renderHook(() => useAccount(accountId));

      await act(async () => {
        const loadedAccount = await result.current.load();
        expect(loadedAccount).toEqual(mockAccount);
      });

      expect(mockStore.setAccountStatus).toHaveBeenCalledWith(accountId, 'loading', 'load');
      expect(mockAccountService.getAccount).toHaveBeenCalledWith(accountId);
      expect(mockStore.setAccountData).toHaveBeenCalledWith(accountId, mockAccount);
    });

    it('should handle load error', async () => {
      const accountId = '507f1f77bcf86cd799439011';
      const error = new Error('Network error');

      mockUseSession.mockReturnValue({
        currentAccountId: accountId,
        setCurrentAccount: vi.fn(),
        load: vi.fn(),
      });

      mockStore.getAccountState.mockReturnValue({
        data: null,
        status: 'idle',
        currentOperation: null,
        error: null,
        lastLoaded: null,
      });

      mockAccountService.getAccount.mockRejectedValue(error);

      const { result } = renderHook(() => useAccount(accountId));

      await act(async () => {
        const loadedAccount = await result.current.load();
        expect(loadedAccount).toBeNull();
      });

      expect(mockStore.setAccountError).toHaveBeenCalledWith(accountId, 'Failed to load account: Network error');
    });

    it('should return null when no account ID available', async () => {
      mockUseSession.mockReturnValue({
        currentAccountId: null,
        setCurrentAccount: vi.fn(),
        load: vi.fn(),
      });

      const { result } = renderHook(() => useAccount());

      await act(async () => {
        const loadedAccount = await result.current.load();
        expect(loadedAccount).toBeNull();
      });

      expect(mockAccountService.getAccount).not.toHaveBeenCalled();
    });
  });

  describe('account operations', () => {
    const accountId = '507f1f77bcf86cd799439011';

    beforeEach(() => {
      mockUseSession.mockReturnValue({
        currentAccountId: accountId,
        setCurrentAccount: vi.fn(),
        load: vi.fn(),
      });

      mockStore.getAccountState.mockReturnValue({
        data: createMockAccount({ id: accountId }),
        status: 'success',
        currentOperation: null,
        error: null,
        lastLoaded: Date.now(),
      });
    });

    it('should logout successfully', async () => {
      const mockLoadSession = vi.fn();
      mockUseSession.mockReturnValue({
        currentAccountId: accountId,
        setCurrentAccount: vi.fn(),
        load: mockLoadSession,
      });

      mockAuthService.logout.mockResolvedValue({ message: 'Logged out successfully' });

      const { result } = renderHook(() => useAccount(accountId));

      await act(async () => {
        await result.current.logout();
      });

      expect(mockStore.setAccountStatus).toHaveBeenCalledWith(accountId, 'updating', 'logout');
      expect(mockAuthService.logout).toHaveBeenCalledWith(accountId);
      expect(mockStore.setAccountStatus).toHaveBeenCalledWith(accountId, 'success');
      expect(mockLoadSession).toHaveBeenCalled();
    });

    it('should change password successfully', async () => {
      const passwordData = {
        oldPassword: 'oldPassword123',
        newPassword: 'newPassword123',
        confirmPassword: 'newPassword123',
      };

      mockAuthService.changePassword.mockResolvedValue({ message: 'Password changed successfully' });

      const { result } = renderHook(() => useAccount(accountId));

      await act(async () => {
        const response = await result.current.changePassword(passwordData);
        expect(response).toEqual({ message: 'Password changed successfully' });
      });

      expect(mockStore.setAccountStatus).toHaveBeenCalledWith(accountId, 'updating', 'changePassword');
      expect(mockAuthService.changePassword).toHaveBeenCalledWith(accountId, passwordData);
      expect(mockStore.setAccountStatus).toHaveBeenCalledWith(accountId, 'success');
    });

    it('should revoke tokens successfully', async () => {
      const mockLoadSession = vi.fn();
      mockUseSession.mockReturnValue({
        currentAccountId: accountId,
        setCurrentAccount: vi.fn(),
        load: mockLoadSession,
      });

      mockAuthService.revokeTokens.mockResolvedValue({ message: 'Tokens revoked successfully' });

      const { result } = renderHook(() => useAccount(accountId));

      await act(async () => {
        const response = await result.current.revokeTokens();
        expect(response).toEqual({ message: 'Tokens revoked successfully' });
      });

      expect(mockStore.setAccountStatus).toHaveBeenCalledWith(accountId, 'updating', 'revokeTokens');
      expect(mockAuthService.revokeTokens).toHaveBeenCalledWith(accountId);
      expect(mockLoadSession).toHaveBeenCalled();
    });

    it('should get token information successfully', async () => {
      const mockTokenInfo = {
        isExpired: false,
        isValid: true,
        type: 'local_jwt',
        expiresAt: 1609459200000,
        timeRemaining: 3600,
      };

      mockAuthService.getAccessTokenInfo.mockResolvedValue(mockTokenInfo);

      const { result } = renderHook(() => useAccount(accountId));

      await act(async () => {
        const tokenInfo = await result.current.getTokenInformation();
        expect(tokenInfo).toEqual(mockTokenInfo);
      });

      expect(mockStore.setAccountStatus).toHaveBeenCalledWith(accountId, 'loading', 'getTokenInformation');
      expect(mockAuthService.getAccessTokenInfo).toHaveBeenCalledWith(accountId);
      expect(mockStore.setAccountStatus).toHaveBeenCalledWith(accountId, 'success');
    });

    it('should update account successfully', async () => {
      const updates = {
        firstName: 'Jane',
        lastName: 'Smith',
        name: 'Jane Smith',
      };
      const updatedAccount = createMockAccount({
        id: accountId,
        userDetails: { ...createMockAccount().userDetails, ...updates },
      });

      mockAccountService.updateAccount.mockResolvedValue(updatedAccount);

      const { result } = renderHook(() => useAccount(accountId));

      await act(async () => {
        const response = await result.current.updateAccount(updates);
        expect(response).toEqual(updatedAccount);
      });

      expect(mockStore.setAccountStatus).toHaveBeenCalledWith(accountId, 'saving', 'updateAccount');
      expect(mockAccountService.updateAccount).toHaveBeenCalledWith(accountId, updates);
      expect(mockStore.setAccountData).toHaveBeenCalledWith(accountId, updatedAccount);
    });

    it('should switch to this account successfully', async () => {
      const mockSetCurrentAccount = vi.fn();
      mockUseSession.mockReturnValue({
        currentAccountId: '507f1f77bcf86cd799439099', // Different account
        setCurrentAccount: mockSetCurrentAccount,
        load: vi.fn(),
      });

      mockSetCurrentAccount.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAccount(accountId));

      await act(async () => {
        await result.current.switchToThisAccount();
      });

      expect(mockStore.setAccountStatus).toHaveBeenCalledWith(accountId, 'switching', 'switchToThisAccount');
      expect(mockSetCurrentAccount).toHaveBeenCalledWith(accountId);
    });

    it('should handle operation errors', async () => {
      const error = new Error('Operation failed');
      mockAuthService.logout.mockRejectedValue(error);

      const { result } = renderHook(() => useAccount(accountId));

      await act(async () => {
        await result.current.logout();
      });

      expect(mockStore.setAccountError).toHaveBeenCalledWith(accountId, 'Failed to logout: Operation failed');
    });

    it('should return null for operations when no account ID', async () => {
      mockUseSession.mockReturnValue({
        currentAccountId: null,
        setCurrentAccount: vi.fn(),
        load: vi.fn(),
      });

      const { result } = renderHook(() => useAccount());

      await act(async () => {
        const response = await result.current.changePassword({
          oldPassword: 'old',
          newPassword: 'new',
          confirmPassword: 'new',
        });
        expect(response).toBeNull();
      });

      expect(mockAuthService.changePassword).not.toHaveBeenCalled();
    });
  });

  describe('status helpers', () => {
    it('should return correct status helpers', () => {
      const accountId = '507f1f77bcf86cd799439011';

      mockUseSession.mockReturnValue({
        currentAccountId: accountId,
        setCurrentAccount: vi.fn(),
        load: vi.fn(),
      });

      mockStore.getAccountState.mockReturnValue({
        data: createMockAccount({ id: accountId }),
        status: 'loading',
        currentOperation: 'load',
        error: null,
        lastLoaded: null,
      });

      const { result } = renderHook(() => useAccount(accountId));

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isUpdating).toBe(false);
      expect(result.current.isSaving).toBe(false);
      expect(result.current.isDeleting).toBe(false);
      expect(result.current.isIdle).toBe(false);
      expect(result.current.hasError).toBe(false);
      expect(result.current.isSuccess).toBe(false);
    });

    it('should return correct status for error state', () => {
      const accountId = '507f1f77bcf86cd799439011';

      mockUseSession.mockReturnValue({
        currentAccountId: accountId,
        setCurrentAccount: vi.fn(),
        load: vi.fn(),
      });

      mockStore.getAccountState.mockReturnValue({
        data: null,
        status: 'error',
        currentOperation: null,
        error: 'Failed to load account',
        lastLoaded: null,
      });

      const { result } = renderHook(() => useAccount(accountId));

      expect(result.current.hasError).toBe(true);
      expect(result.current.error).toBe('Failed to load account');
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('options handling', () => {
    it('should pass autoLoadSession option to useSession', () => {
      const accountId = '507f1f77bcf86cd799439011';

      mockStore.getAccountState.mockReturnValue({
        data: null,
        status: 'idle',
        currentOperation: null,
        error: null,
        lastLoaded: null,
      });

      renderHook(() => useAccount(accountId, { autoLoadSession: false }));

      expect(mockUseSession).toHaveBeenCalledWith({ autoLoad: false });
    });

    it('should default autoLoadSession to true', () => {
      const accountId = '507f1f77bcf86cd799439011';

      mockStore.getAccountState.mockReturnValue({
        data: null,
        status: 'idle',
        currentOperation: null,
        error: null,
        lastLoaded: null,
      });

      renderHook(() => useAccount(accountId));

      expect(mockUseSession).toHaveBeenCalledWith({ autoLoad: true });
    });
  });
});
