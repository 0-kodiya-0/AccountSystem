import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSession } from '../useSession';
import {
  createMockAuthService,
  createMockSessionData,
  createMockSessionAccounts,
  resetAppStore,
  setMockSessionState,
  TEST_CONSTANTS,
} from '../../test/utils';

// Mock the AuthService
const mockAuthService = createMockAuthService();

vi.mock('../../context/ServicesProvider', () => ({
  useAuthService: () => mockAuthService,
}));

describe('useSession', () => {
  const mockSessionData = createMockSessionData();
  const mockSessionAccounts = createMockSessionAccounts();

  beforeEach(() => {
    resetAppStore();
    vi.clearAllMocks();

    // Reset all mock implementations
    mockAuthService.getAccountSession.mockReset();
    mockAuthService.getSessionAccountsData.mockReset();
    mockAuthService.logoutAll.mockReset();
    mockAuthService.setCurrentAccountInSession.mockReset();
  });

  describe('Hook Initialization', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useSession({ autoLoad: false, autoLoadSessionAccounts: false }));

      expect(result.current.data).toBeNull();
      expect(result.current.status).toBe('idle');
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.hasAccount).toBe(false);
      expect(result.current.currentAccountId).toBeNull();
      expect(result.current.accountIds).toEqual([]);
      expect(result.current.accounts).toEqual([]);
    });
  });

  describe('Session Loading', () => {
    it('should auto-load session when autoLoad is true', async () => {
      mockAuthService.getAccountSession.mockResolvedValue({
        session: mockSessionData,
      });

      let result: any;
      await act(async () => {
        const hook = renderHook(() => useSession({ autoLoad: true }));
        result = hook.result;
      });

      expect(mockAuthService.getAccountSession).toHaveBeenCalled();
      expect(result.current.data).toEqual(mockSessionData);
      expect(result.current.status).toBe('success');
    });

    it('should auto-load session accounts when autoLoadSessionAccounts is true', async () => {
      setMockSessionState(mockSessionData);
      mockAuthService.getSessionAccountsData.mockResolvedValue(mockSessionAccounts);

      let result: any;
      await act(async () => {
        const hook = renderHook(() => useSession({ autoLoad: false, autoLoadSessionAccounts: true }));
        result = hook.result;
      });

      expect(mockAuthService.getSessionAccountsData).toHaveBeenCalledWith(mockSessionData.accountIds);
      expect(result.current.sessionAccounts.data).toEqual(mockSessionAccounts);
      expect(result.current.sessionAccounts.status).toBe('success');
    });

    it('should load session when manually called', async () => {
      mockAuthService.getAccountSession.mockResolvedValue({
        session: mockSessionData,
      });

      const { result } = renderHook(() => useSession({ autoLoad: false, autoLoadSessionAccounts: false }));

      await act(async () => {
        await result.current.load();
      });

      expect(mockAuthService.getAccountSession).toHaveBeenCalled();
      expect(result.current.data).toEqual(mockSessionData);
      expect(result.current.status).toBe('success');
    });

    it('should handle session loading errors', async () => {
      const error = new Error('Session load failed');
      mockAuthService.getAccountSession.mockRejectedValue(error);

      const { result } = renderHook(() => useSession({ autoLoad: false, autoLoadSessionAccounts: false }));

      await act(async () => {
        await result.current.load();
      });

      expect(result.current.error).toBe('Failed to load session: Session load failed');
      expect(result.current.status).toBe('error');
    });
  });

  describe('Session Accounts Loading', () => {
    it('should load session accounts when manually called', async () => {
      setMockSessionState(mockSessionData);
      mockAuthService.getSessionAccountsData.mockResolvedValue(mockSessionAccounts);

      const { result } = renderHook(() => useSession({ autoLoad: false, autoLoadSessionAccounts: false }));

      await act(async () => {
        await result.current.loadSessionAccounts();
      });

      expect(mockAuthService.getSessionAccountsData).toHaveBeenCalledWith(mockSessionData.accountIds);
      expect(result.current.sessionAccounts.data).toEqual(mockSessionAccounts);
      expect(result.current.sessionAccounts.status).toBe('success');
    });

    it('should handle session accounts loading errors', async () => {
      setMockSessionState(mockSessionData);

      const error = new Error('Session accounts load failed');
      mockAuthService.getSessionAccountsData.mockRejectedValue(error);

      const { result } = renderHook(() => useSession({ autoLoad: false, autoLoadSessionAccounts: false }));

      await act(async () => {
        await result.current.loadSessionAccounts();
      });

      expect(result.current.sessionAccounts.error).toBe(
        'Failed to load session accounts: Session accounts load failed',
      );
      expect(result.current.sessionAccounts.status).toBe('error');
    });
  });

  describe('Session Operations', () => {
    it('should logout all accounts', async () => {
      setMockSessionState(mockSessionData);
      mockAuthService.logoutAll.mockResolvedValue({ message: 'Logged out successfully' });

      const { result } = renderHook(() => useSession({ autoLoad: false, autoLoadSessionAccounts: false }));

      await act(async () => {
        await result.current.logoutAll();
      });

      expect(mockAuthService.logoutAll).toHaveBeenCalledWith(mockSessionData.accountIds);
      expect(result.current.data).toBeNull();
      expect(result.current.status).toBe('idle');
    });

    it('should set current account', async () => {
      const newCurrentAccountId = TEST_CONSTANTS.ACCOUNT_IDS.DIFFERENT;

      setMockSessionState(mockSessionData);

      mockAuthService.setCurrentAccountInSession.mockResolvedValue({
        message: 'Current account updated',
        currentAccountId: newCurrentAccountId,
      });

      mockAuthService.getAccountSession.mockResolvedValue({
        session: { ...mockSessionData, currentAccountId: newCurrentAccountId },
      });

      const { result } = renderHook(() => useSession({ autoLoad: false, autoLoadSessionAccounts: false }));

      await act(async () => {
        await result.current.setCurrentAccount(newCurrentAccountId);
      });

      expect(mockAuthService.setCurrentAccountInSession).toHaveBeenCalledWith(newCurrentAccountId);
      expect(mockAuthService.getAccountSession).toHaveBeenCalled();
      expect(result.current.data?.currentAccountId).toBe(newCurrentAccountId);
    });

    it('should handle operation errors', async () => {
      setMockSessionState(mockSessionData);

      const error = new Error('Operation failed');
      mockAuthService.logoutAll.mockRejectedValue(error);

      const { result } = renderHook(() => useSession({ autoLoad: false, autoLoadSessionAccounts: false }));

      await act(async () => {
        await result.current.logoutAll();
      });

      expect(result.current.error).toBe('Failed to logout all: Operation failed');
      expect(result.current.status).toBe('error');
    });
  });

  describe('Combined Operations', () => {
    it('should load session then load session accounts', async () => {
      mockAuthService.getAccountSession.mockResolvedValue({
        session: mockSessionData,
      });
      mockAuthService.getSessionAccountsData.mockResolvedValue(mockSessionAccounts);

      const { result } = renderHook(() => useSession({ autoLoad: false, autoLoadSessionAccounts: false }));

      // First load session
      await act(async () => {
        await result.current.load();
      });

      expect(result.current.data).toEqual(mockSessionData);
      expect(result.current.status).toBe('success');

      // Then load session accounts
      await act(async () => {
        await result.current.loadSessionAccounts();
      });

      expect(result.current.sessionAccounts.data).toEqual(mockSessionAccounts);
      expect(result.current.sessionAccounts.status).toBe('success');
    });
  });

  describe('Derived State', () => {
    it('should calculate authentication status correctly', async () => {
      mockAuthService.getAccountSession.mockResolvedValue({
        session: mockSessionData,
      });
      mockAuthService.getSessionAccountsData.mockResolvedValue(mockSessionAccounts);

      const { result } = renderHook(() =>
        useSession({
          autoLoad: false,
          autoLoadSessionAccounts: false,
        }),
      );

      // Load session first
      await act(async () => {
        await result.current.load();
      });

      // For non-autoLoadSessionAccounts, should be authenticated with just session
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.hasAccount).toBe(true);
      expect(result.current.currentAccountId).toBe(TEST_CONSTANTS.ACCOUNT_IDS.CURRENT);
      expect(result.current.accountIds).toEqual([
        TEST_CONSTANTS.ACCOUNT_IDS.CURRENT,
        TEST_CONSTANTS.ACCOUNT_IDS.DIFFERENT,
      ]);
    });

    it('should return sorted accounts array after loading session accounts', async () => {
      mockAuthService.getAccountSession.mockResolvedValue({
        session: mockSessionData,
      });
      // Set accounts in reversed order
      const reversedAccounts = [mockSessionAccounts[1], mockSessionAccounts[0]];
      mockAuthService.getSessionAccountsData.mockResolvedValue(reversedAccounts);

      const { result } = renderHook(() =>
        useSession({
          autoLoad: false,
          autoLoadSessionAccounts: false,
        }),
      );

      // Load session
      await act(async () => {
        await result.current.load();
      });

      // Load session accounts
      await act(async () => {
        await result.current.loadSessionAccounts();
      });

      // Should be sorted by accountIds order
      expect(result.current.accounts).toHaveLength(2);
      expect(result.current.accounts[0].id).toBe(TEST_CONSTANTS.ACCOUNT_IDS.CURRENT);
      expect(result.current.accounts[1].id).toBe(TEST_CONSTANTS.ACCOUNT_IDS.DIFFERENT);
    });

    it('should handle missing current account', async () => {
      const sessionWithoutCurrentAccount = createMockSessionData({ currentAccountId: null });
      mockAuthService.getAccountSession.mockResolvedValue({
        session: sessionWithoutCurrentAccount,
      });

      const { result } = renderHook(() =>
        useSession({
          autoLoad: false,
          autoLoadSessionAccounts: false,
        }),
      );

      await act(async () => {
        await result.current.load();
      });

      expect(result.current.hasAccount).toBe(false);
      expect(result.current.currentAccountId).toBeNull();
    });
  });

  describe('Status Helpers', () => {
    it('should provide correct loading status', async () => {
      // Mock a slow response to capture loading state
      let resolvePromise: (value: any) => void;
      const slowPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockAuthService.getAccountSession.mockReturnValue(slowPromise);

      const { result } = renderHook(() =>
        useSession({
          autoLoad: false,
          autoLoadSessionAccounts: false,
        }),
      );

      // Start the async operation
      act(() => {
        result.current.load();
      });

      // Should be loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.hasError).toBe(false);
      expect(result.current.isSuccess).toBe(false);

      // Resolve the promise
      await act(async () => {
        resolvePromise!({ session: mockSessionData });
      });

      // Should be success
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSuccess).toBe(true);
    });
  });
});
