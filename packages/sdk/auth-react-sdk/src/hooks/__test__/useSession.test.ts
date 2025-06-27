import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSession } from '../useSession';
import { useAppStore } from '../../store/useAppStore';
import { AccountSessionInfo, SessionAccount, AccountType, AccountStatus } from '../../types';

// Mock the AuthService
const mockAuthService = {
  getAccountSession: vi.fn(),
  getSessionAccountsData: vi.fn(),
  logoutAll: vi.fn(),
  setCurrentAccountInSession: vi.fn(),
};

// Mock the useAuthService hook
vi.mock('../../context/ServicesProvider', () => ({
  useAuthService: () => mockAuthService,
}));

// Mock the store's shouldLoad methods
const mockShouldLoadSession = vi.fn();
const mockShouldLoadSessionAccounts = vi.fn();

vi.mock('../../store/useAppStore', async () => {
  const actual = await vi.importActual('../../store/useAppStore');
  return {
    ...actual,
    useAppStore: vi.fn(),
  };
});

const mockUseAppStore = vi.mocked(useAppStore);

describe('useSession', () => {
  const mockSessionData: AccountSessionInfo = {
    hasSession: true,
    accountIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    currentAccountId: '507f1f77bcf86cd799439011',
    isValid: true,
  };

  const mockSessionAccounts: SessionAccount[] = [
    {
      id: '507f1f77bcf86cd799439011',
      accountType: AccountType.Local,
      status: AccountStatus.Active,
      userDetails: {
        name: 'John Doe',
        email: 'john@example.com',
      },
    },
    {
      id: '507f1f77bcf86cd799439012',
      accountType: AccountType.OAuth,
      status: AccountStatus.Active,
      userDetails: {
        name: 'Jane Smith',
        email: 'jane@example.com',
      },
    },
  ];

  // Default store state
  const defaultStoreState = {
    getSessionState: () => ({
      data: null,
      status: 'idle' as const,
      currentOperation: null,
      error: null,
      lastLoaded: null,
    }),
    getSessionAccountsState: () => ({
      data: [] as SessionAccount[],
      status: 'idle' as const,
      currentOperation: null,
      error: null,
      lastLoaded: null,
    }),
    setSessionStatus: vi.fn(),
    setSessionData: vi.fn(),
    setSessionError: vi.fn(),
    clearSession: vi.fn(),
    setSessionAccountsStatus: vi.fn(),
    setSessionAccountsData: vi.fn(),
    setSessionAccountsError: vi.fn(),
    shouldLoadSession: mockShouldLoadSession,
    shouldLoadSessionAccounts: mockShouldLoadSessionAccounts,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock implementations
    mockUseAppStore.mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector(defaultStoreState as any);
      }
      return defaultStoreState;
    });

    mockShouldLoadSession.mockReturnValue(false);
    mockShouldLoadSessionAccounts.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Hook Initialization', () => {
    test('should initialize with default options', () => {
      const { result } = renderHook(() => useSession());

      expect(result.current.data).toBeNull();
      expect(result.current.status).toBe('idle');
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.hasAccount).toBe(false);
      expect(result.current.currentAccountId).toBeNull();
      expect(result.current.accountIds).toEqual([]);
      expect(result.current.accounts).toEqual([]);
    });

    test('should respect autoLoad option', () => {
      // Test with autoLoad: false
      mockShouldLoadSession.mockReturnValue(true);

      renderHook(() => useSession({ autoLoad: false }));

      // Should not attempt to load
      expect(mockAuthService.getAccountSession).not.toHaveBeenCalled();

      // Reset and test with autoLoad: true
      vi.clearAllMocks();
      mockShouldLoadSession.mockReturnValue(true);

      renderHook(() => useSession({ autoLoad: true }));

      // Should attempt to load
      expect(mockAuthService.getAccountSession).toHaveBeenCalled();
    });

    test('should respect autoLoadSessionAccounts option', () => {
      // Mock store to return session with accounts
      const storeWithSession = {
        ...defaultStoreState,
        getSessionState: () => ({
          data: mockSessionData,
          status: 'success' as const,
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        }),
      };

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(storeWithSession as any);
        }
        return storeWithSession;
      });

      mockShouldLoadSessionAccounts.mockReturnValue(true);

      // Test with autoLoadSessionAccounts: false
      renderHook(() => useSession({ autoLoadSessionAccounts: false }));
      expect(mockAuthService.getSessionAccountsData).not.toHaveBeenCalled();

      // Reset and test with autoLoadSessionAccounts: true
      vi.clearAllMocks();
      renderHook(() => useSession({ autoLoadSessionAccounts: true }));
      expect(mockAuthService.getSessionAccountsData).toHaveBeenCalledWith(mockSessionData.accountIds);
    });
  });

  describe('Session Loading', () => {
    test('should load session automatically when autoLoad is true', async () => {
      mockShouldLoadSession.mockReturnValue(true);
      mockAuthService.getAccountSession.mockResolvedValue({
        session: mockSessionData,
      });

      const setSessionStatus = vi.fn();
      const setSessionData = vi.fn();
      const storeWithMocks = {
        ...defaultStoreState,
        setSessionStatus,
        setSessionData,
      };

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(storeWithMocks as any);
        }
        return storeWithMocks;
      });

      const { result } = renderHook(() => useSession({ autoLoad: true }));

      // Wait for async operations
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockAuthService.getAccountSession).toHaveBeenCalled();
      expect(setSessionStatus).toHaveBeenCalledWith('loading', 'loadSession');
      expect(setSessionData).toHaveBeenCalledWith(mockSessionData);
    });

    test('should not load session when autoLoad is false', () => {
      mockShouldLoadSession.mockReturnValue(true);

      renderHook(() => useSession({ autoLoad: false }));

      expect(mockAuthService.getAccountSession).not.toHaveBeenCalled();
    });

    test('should handle session loading errors', async () => {
      mockShouldLoadSession.mockReturnValue(true);
      const error = new Error('Session load failed');
      mockAuthService.getAccountSession.mockRejectedValue(error);

      const setSessionStatus = vi.fn();
      const setSessionError = vi.fn();
      const storeWithMocks = {
        ...defaultStoreState,
        setSessionStatus,
        setSessionError,
      };

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(storeWithMocks as any);
        }
        return storeWithMocks;
      });

      renderHook(() => useSession({ autoLoad: true }));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(setSessionError).toHaveBeenCalledWith('Failed to load session: Session load failed');
    });

    test('should update store on successful load', async () => {
      mockShouldLoadSession.mockReturnValue(true);
      mockAuthService.getAccountSession.mockResolvedValue({
        session: mockSessionData,
      });

      const setSessionData = vi.fn();
      const storeWithMocks = {
        ...defaultStoreState,
        setSessionData,
        setSessionStatus: vi.fn(),
      };

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(storeWithMocks as any);
        }
        return storeWithMocks;
      });

      renderHook(() => useSession({ autoLoad: true }));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(setSessionData).toHaveBeenCalledWith(mockSessionData);
    });
  });

  describe('Session Accounts Loading', () => {
    test('should load session accounts when enabled', async () => {
      const storeWithSession = {
        ...defaultStoreState,
        getSessionState: () => ({
          data: mockSessionData,
          status: 'success' as const,
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        }),
        setSessionAccountsStatus: vi.fn(),
        setSessionAccountsData: vi.fn(),
      };

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(storeWithSession as any);
        }
        return storeWithSession;
      });

      mockShouldLoadSessionAccounts.mockReturnValue(true);
      mockAuthService.getSessionAccountsData.mockResolvedValue(mockSessionAccounts);

      renderHook(() => useSession({ autoLoadSessionAccounts: true }));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockAuthService.getSessionAccountsData).toHaveBeenCalledWith(mockSessionData.accountIds);
      expect(storeWithSession.setSessionAccountsData).toHaveBeenCalledWith(mockSessionAccounts);
    });

    test('should not load session accounts when disabled', () => {
      const storeWithSession = {
        ...defaultStoreState,
        getSessionState: () => ({
          data: mockSessionData,
          status: 'success' as const,
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        }),
      };

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(storeWithSession as any);
        }
        return storeWithSession;
      });

      mockShouldLoadSessionAccounts.mockReturnValue(true);

      renderHook(() => useSession({ autoLoadSessionAccounts: false }));

      expect(mockAuthService.getSessionAccountsData).not.toHaveBeenCalled();
    });

    test('should handle session accounts loading errors', async () => {
      const error = new Error('Session accounts load failed');
      mockAuthService.getSessionAccountsData.mockRejectedValue(error);

      const storeWithSession = {
        ...defaultStoreState,
        getSessionState: () => ({
          data: mockSessionData,
          status: 'success' as const,
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        }),
        setSessionAccountsStatus: vi.fn(),
        setSessionAccountsError: vi.fn(),
      };

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(storeWithSession as any);
        }
        return storeWithSession;
      });

      mockShouldLoadSessionAccounts.mockReturnValue(true);

      renderHook(() => useSession({ autoLoadSessionAccounts: true }));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(storeWithSession.setSessionAccountsError).toHaveBeenCalledWith(
        'Failed to load session accounts: Session accounts load failed',
      );
    });
  });

  describe('Session Operations', () => {
    test('should logout all accounts', async () => {
      const storeWithSession = {
        ...defaultStoreState,
        getSessionState: () => ({
          data: mockSessionData,
          status: 'success' as const,
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        }),
        setSessionStatus: vi.fn(),
        clearSession: vi.fn(),
      };

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(storeWithSession as any);
        }
        return storeWithSession;
      });

      mockAuthService.logoutAll.mockResolvedValue({ message: 'Logged out successfully' });

      const { result } = renderHook(() => useSession());

      await act(async () => {
        await result.current.logoutAll();
      });

      expect(storeWithSession.setSessionStatus).toHaveBeenCalledWith('updating', 'logoutAll');
      expect(mockAuthService.logoutAll).toHaveBeenCalledWith(mockSessionData.accountIds);
      expect(storeWithSession.clearSession).toHaveBeenCalled();
    });

    test('should set current account', async () => {
      const storeWithMocks = {
        ...defaultStoreState,
        setSessionStatus: vi.fn(),
        setSessionData: vi.fn(),
      };

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(storeWithMocks as any);
        }
        return storeWithMocks;
      });

      mockAuthService.setCurrentAccountInSession.mockResolvedValue({
        message: 'Current account updated',
        currentAccountId: '507f1f77bcf86cd799439012',
      });

      mockAuthService.getAccountSession.mockResolvedValue({
        session: { ...mockSessionData, currentAccountId: '507f1f77bcf86cd799439012' },
      });

      const { result } = renderHook(() => useSession());

      await act(async () => {
        await result.current.setCurrentAccount('507f1f77bcf86cd799439012');
      });

      expect(storeWithMocks.setSessionStatus).toHaveBeenCalledWith('updating', 'setCurrentAccount');
      expect(mockAuthService.setCurrentAccountInSession).toHaveBeenCalledWith('507f1f77bcf86cd799439012');
      expect(mockAuthService.getAccountSession).toHaveBeenCalled();
    });

    test('should handle operation errors', async () => {
      const error = new Error('Operation failed');
      mockAuthService.logoutAll.mockRejectedValue(error);

      const storeWithSession = {
        ...defaultStoreState,
        getSessionState: () => ({
          data: mockSessionData,
          status: 'success' as const,
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        }),
        setSessionStatus: vi.fn(),
        setSessionError: vi.fn(),
      };

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(storeWithSession as any);
        }
        return storeWithSession;
      });

      const { result } = renderHook(() => useSession());

      await act(async () => {
        await result.current.logoutAll();
      });

      expect(storeWithSession.setSessionError).toHaveBeenCalledWith('Failed to logout all: Operation failed');
    });
  });

  describe('Derived State', () => {
    test('should calculate isAuthenticated correctly', () => {
      // Test without session accounts auto-loading
      const storeWithSession = {
        ...defaultStoreState,
        getSessionState: () => ({
          data: mockSessionData,
          status: 'success' as const,
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        }),
      };

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(storeWithSession as any);
        }
        return storeWithSession;
      });

      const { result } = renderHook(() => useSession({ autoLoadSessionAccounts: false }));

      expect(result.current.isAuthenticated).toBe(true);

      // Test with session accounts auto-loading
      const storeWithSessionAccounts = {
        ...storeWithSession,
        getSessionAccountsState: () => ({
          data: mockSessionAccounts,
          status: 'success' as const,
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        }),
      };

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(storeWithSessionAccounts as any);
        }
        return storeWithSessionAccounts;
      });

      const { result: result2 } = renderHook(() => useSession({ autoLoadSessionAccounts: true }));

      expect(result2.current.isAuthenticated).toBe(true);
    });

    test('should calculate hasAccount correctly', () => {
      const storeWithAccount = {
        ...defaultStoreState,
        getSessionState: () => ({
          data: mockSessionData,
          status: 'success' as const,
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        }),
      };

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(storeWithAccount as any);
        }
        return storeWithAccount;
      });

      const { result } = renderHook(() => useSession());

      expect(result.current.hasAccount).toBe(true);
      expect(result.current.currentAccountId).toBe('507f1f77bcf86cd799439011');

      // Test without current account
      const storeWithoutAccount = {
        ...defaultStoreState,
        getSessionState: () => ({
          data: { ...mockSessionData, currentAccountId: null },
          status: 'success' as const,
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        }),
      };

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(storeWithoutAccount as any);
        }
        return storeWithoutAccount;
      });

      const { result: result2 } = renderHook(() => useSession());

      expect(result2.current.hasAccount).toBe(false);
      expect(result2.current.currentAccountId).toBeNull();
    });

    test('should return current account ID', () => {
      const storeWithSession = {
        ...defaultStoreState,
        getSessionState: () => ({
          data: mockSessionData,
          status: 'success' as const,
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        }),
      };

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(storeWithSession as any);
        }
        return storeWithSession;
      });

      const { result } = renderHook(() => useSession());

      expect(result.current.currentAccountId).toBe('507f1f77bcf86cd799439011');
    });

    test('should return account IDs array', () => {
      const storeWithSession = {
        ...defaultStoreState,
        getSessionState: () => ({
          data: mockSessionData,
          status: 'success' as const,
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        }),
      };

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(storeWithSession as any);
        }
        return storeWithSession;
      });

      const { result } = renderHook(() => useSession());

      expect(result.current.accountIds).toEqual(['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']);
    });

    test('should return sorted accounts array', () => {
      const storeWithSessionAndAccounts = {
        ...defaultStoreState,
        getSessionState: () => ({
          data: mockSessionData,
          status: 'success' as const,
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        }),
        getSessionAccountsState: () => ({
          data: [mockSessionAccounts[1], mockSessionAccounts[0]], // Reversed order
          status: 'success' as const,
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        }),
      };

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(storeWithSessionAndAccounts as any);
        }
        return storeWithSessionAndAccounts;
      });

      const { result } = renderHook(() => useSession());

      // Should be sorted by accountIds order
      expect(result.current.accounts).toHaveLength(2);
      expect(result.current.accounts[0].id).toBe('507f1f77bcf86cd799439011');
      expect(result.current.accounts[1].id).toBe('507f1f77bcf86cd799439012');
    });
  });

  describe('Status Helpers', () => {
    test('should provide loading status helpers', () => {
      const storeWithLoading = {
        ...defaultStoreState,
        getSessionState: () => ({
          data: null,
          status: 'loading' as const,
          currentOperation: 'loadSession',
          error: null,
          lastLoaded: null,
        }),
      };

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(storeWithLoading as any);
        }
        return storeWithLoading;
      });

      const { result } = renderHook(() => useSession());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isUpdating).toBe(false);
      expect(result.current.isSaving).toBe(false);
      expect(result.current.isDeleting).toBe(false);
      expect(result.current.isIdle).toBe(false);
      expect(result.current.hasError).toBe(false);
      expect(result.current.isSuccess).toBe(false);
    });

    test('should provide session accounts status helpers', () => {
      const storeWithSessionAccountsLoading = {
        ...defaultStoreState,
        getSessionAccountsState: () => ({
          data: [],
          status: 'loading' as const,
          currentOperation: 'loadSessionAccounts',
          error: null,
          lastLoaded: null,
        }),
      };

      mockUseAppStore.mockImplementation((selector) => {
        if (typeof selector === 'function') {
          return selector(storeWithSessionAccountsLoading as any);
        }
        return storeWithSessionAccountsLoading;
      });

      const { result } = renderHook(() => useSession());

      expect(result.current.sessionAccountsLoading).toBe(true);
      expect(result.current.sessionAccountsError).toBeNull();
      expect(result.current.sessionAccountsSuccess).toBe(false);
    });
  });
});
