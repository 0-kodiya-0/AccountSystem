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

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset store to initial state using direct access
    useAppStore.setState({
      session: {
        data: null,
        status: 'idle',
        currentOperation: null,
        error: null,
        lastLoaded: null,
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
      // Mock shouldLoadSession to return true
      const store = useAppStore.getState();
      vi.spyOn(store, 'shouldLoadSession').mockReturnValue(true);

      // Test with autoLoad: false
      renderHook(() => useSession({ autoLoad: false }));
      expect(mockAuthService.getAccountSession).not.toHaveBeenCalled();

      // Reset and test with autoLoad: true
      vi.clearAllMocks();
      renderHook(() => useSession({ autoLoad: true }));
      expect(mockAuthService.getAccountSession).toHaveBeenCalled();
    });

    test('should respect autoLoadSessionAccounts option', () => {
      // Set up session state first
      useAppStore.setState({
        session: {
          data: mockSessionData,
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

      const store = useAppStore.getState();
      vi.spyOn(store, 'shouldLoadSessionAccounts').mockReturnValue(true);

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
      const store = useAppStore.getState();
      vi.spyOn(store, 'shouldLoadSession').mockReturnValue(true);

      mockAuthService.getAccountSession.mockResolvedValue({
        session: mockSessionData,
      });

      const { result } = renderHook(() => useSession({ autoLoad: true }));

      // Wait for async operations
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockAuthService.getAccountSession).toHaveBeenCalled();

      // Check that the store was updated
      const currentState = useAppStore.getState();
      expect(currentState.session.data).toEqual(mockSessionData);
      expect(currentState.session.status).toBe('success');
    });

    test('should not load session when autoLoad is false', () => {
      const store = useAppStore.getState();
      vi.spyOn(store, 'shouldLoadSession').mockReturnValue(true);

      renderHook(() => useSession({ autoLoad: false }));

      expect(mockAuthService.getAccountSession).not.toHaveBeenCalled();
    });

    test('should handle session loading errors', async () => {
      const store = useAppStore.getState();
      vi.spyOn(store, 'shouldLoadSession').mockReturnValue(true);

      const error = new Error('Session load failed');
      mockAuthService.getAccountSession.mockRejectedValue(error);

      renderHook(() => useSession({ autoLoad: true }));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Check that error was set in store
      const currentState = useAppStore.getState();
      expect(currentState.session.error).toBe('Failed to load session: Session load failed');
      expect(currentState.session.status).toBe('error');
    });
  });

  describe('Session Accounts Loading', () => {
    test('should load session accounts when enabled', async () => {
      // Set up session state first
      useAppStore.setState({
        session: {
          data: mockSessionData,
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

      const store = useAppStore.getState();
      vi.spyOn(store, 'shouldLoadSessionAccounts').mockReturnValue(true);

      mockAuthService.getSessionAccountsData.mockResolvedValue(mockSessionAccounts);

      renderHook(() => useSession({ autoLoadSessionAccounts: true }));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockAuthService.getSessionAccountsData).toHaveBeenCalledWith(mockSessionData.accountIds);

      // Check that session accounts were updated
      const currentState = useAppStore.getState();
      expect(currentState.sessionAccounts.data).toEqual(mockSessionAccounts);
      expect(currentState.sessionAccounts.status).toBe('success');
    });

    test('should not load session accounts when disabled', () => {
      // Set up session state first
      useAppStore.setState({
        session: {
          data: mockSessionData,
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

      const store = useAppStore.getState();
      vi.spyOn(store, 'shouldLoadSessionAccounts').mockReturnValue(true);

      renderHook(() => useSession({ autoLoadSessionAccounts: false }));

      expect(mockAuthService.getSessionAccountsData).not.toHaveBeenCalled();
    });

    test('should handle session accounts loading errors', async () => {
      // Set up session state first
      useAppStore.setState({
        session: {
          data: mockSessionData,
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

      const store = useAppStore.getState();
      vi.spyOn(store, 'shouldLoadSessionAccounts').mockReturnValue(true);

      const error = new Error('Session accounts load failed');
      mockAuthService.getSessionAccountsData.mockRejectedValue(error);

      renderHook(() => useSession({ autoLoadSessionAccounts: true }));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Check that error was set in store
      const currentState = useAppStore.getState();
      expect(currentState.sessionAccounts.error).toBe('Failed to load session accounts: Session accounts load failed');
      expect(currentState.sessionAccounts.status).toBe('error');
    });
  });

  describe('Session Operations', () => {
    test('should logout all accounts', async () => {
      // Set up session state first
      useAppStore.setState({
        session: {
          data: mockSessionData,
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

      mockAuthService.logoutAll.mockResolvedValue({ message: 'Logged out successfully' });

      const { result } = renderHook(() => useSession());

      await act(async () => {
        await result.current.logoutAll();
      });

      expect(mockAuthService.logoutAll).toHaveBeenCalledWith(mockSessionData.accountIds);

      // Check that session was cleared
      const currentState = useAppStore.getState();
      expect(currentState.session.data).toBeNull();
      expect(currentState.session.status).toBe('idle');
    });

    test('should set current account', async () => {
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

      expect(mockAuthService.setCurrentAccountInSession).toHaveBeenCalledWith('507f1f77bcf86cd799439012');
      expect(mockAuthService.getAccountSession).toHaveBeenCalled();

      // Check that session was updated
      const currentState = useAppStore.getState();
      expect(currentState.session.data?.currentAccountId).toBe('507f1f77bcf86cd799439012');
    });

    test('should handle operation errors', async () => {
      // Set up session state first
      useAppStore.setState({
        session: {
          data: mockSessionData,
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

      const error = new Error('Operation failed');
      mockAuthService.logoutAll.mockRejectedValue(error);

      const { result } = renderHook(() => useSession());

      await act(async () => {
        await result.current.logoutAll();
      });

      // Check that error was set
      const currentState = useAppStore.getState();
      expect(currentState.session.error).toBe('Failed to logout all: Operation failed');
      expect(currentState.session.status).toBe('error');
    });
  });

  describe('Derived State', () => {
    test('should calculate isAuthenticated correctly', () => {
      // Test without session accounts auto-loading
      useAppStore.setState({
        session: {
          data: mockSessionData,
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

      const { result } = renderHook(() => useSession({ autoLoadSessionAccounts: false }));

      expect(result.current.isAuthenticated).toBe(true);

      // Test with session accounts auto-loading
      useAppStore.setState({
        session: {
          data: mockSessionData,
          status: 'success',
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        },
        accounts: {},
        sessionAccounts: {
          data: mockSessionAccounts,
          status: 'success',
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        },
      });

      const { result: result2 } = renderHook(() => useSession({ autoLoadSessionAccounts: true }));

      expect(result2.current.isAuthenticated).toBe(true);
    });

    test('should calculate hasAccount correctly', () => {
      useAppStore.setState({
        session: {
          data: mockSessionData,
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

      const { result } = renderHook(() => useSession());

      expect(result.current.hasAccount).toBe(true);
      expect(result.current.currentAccountId).toBe('507f1f77bcf86cd799439011');

      // Test without current account
      useAppStore.setState({
        session: {
          data: { ...mockSessionData, currentAccountId: null },
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

      const { result: result2 } = renderHook(() => useSession());

      expect(result2.current.hasAccount).toBe(false);
      expect(result2.current.currentAccountId).toBeNull();
    });

    test('should return current account ID', () => {
      useAppStore.setState({
        session: {
          data: mockSessionData,
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

      const { result } = renderHook(() => useSession());

      expect(result.current.currentAccountId).toBe('507f1f77bcf86cd799439011');
    });

    test('should return account IDs array', () => {
      useAppStore.setState({
        session: {
          data: mockSessionData,
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

      const { result } = renderHook(() => useSession());

      expect(result.current.accountIds).toEqual(['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']);
    });

    test('should return sorted accounts array', () => {
      useAppStore.setState({
        session: {
          data: mockSessionData,
          status: 'success',
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        },
        accounts: {},
        sessionAccounts: {
          data: [mockSessionAccounts[1], mockSessionAccounts[0]], // Reversed order
          status: 'success',
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        },
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
      useAppStore.setState({
        session: {
          data: null,
          status: 'loading',
          currentOperation: 'loadSession',
          error: null,
          lastLoaded: null,
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
      useAppStore.setState({
        session: {
          data: null,
          status: 'idle',
          currentOperation: null,
          error: null,
          lastLoaded: null,
        },
        accounts: {},
        sessionAccounts: {
          data: [],
          status: 'loading',
          currentOperation: 'loadSessionAccounts',
          error: null,
          lastLoaded: null,
        },
      });

      const { result } = renderHook(() => useSession());

      expect(result.current.sessionAccountsLoading).toBe(true);
      expect(result.current.sessionAccountsError).toBeNull();
      expect(result.current.sessionAccountsSuccess).toBe(false);
    });
  });
});
