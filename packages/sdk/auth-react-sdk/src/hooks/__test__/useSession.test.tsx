import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSession } from '../useSession';
import { useAppStore } from '../../store/useAppStore';
import { useAuthService } from '../../context/ServicesProvider';
import { createMockSessionInfo, createMockSessionAccount } from '../../test/utils';

// Mock the dependencies
vi.mock('../../context/ServicesProvider');
vi.mock('../../store/useAppStore');

describe('useSession', () => {
  let mockAuthService: any;
  let mockStore: any;

  beforeEach(() => {
    // Setup mock auth service
    mockAuthService = {
      getAccountSession: vi.fn(),
      getSessionAccountsData: vi.fn(),
      logoutAll: vi.fn(),
      setCurrentAccountInSession: vi.fn(),
    };

    // Setup mock store
    mockStore = {
      getSessionState: vi.fn(),
      getSessionAccountsState: vi.fn(),
      setSessionStatus: vi.fn(),
      setSessionData: vi.fn(),
      setSessionError: vi.fn(),
      clearSession: vi.fn(),
      setSessionAccountsStatus: vi.fn(),
      setSessionAccountsData: vi.fn(),
      setSessionAccountsError: vi.fn(),
      shouldLoadSession: vi.fn(),
      shouldLoadSessionAccounts: vi.fn(),
    };

    (useAuthService as any).mockReturnValue(mockAuthService);
    (useAppStore as any).mockImplementation((selector: any) => {
      if (typeof selector === 'function') {
        return selector(mockStore);
      }
      return mockStore;
    });
  });

  describe('initialization', () => {
    it('should initialize with default options', () => {
      const mockSessionState = {
        data: null,
        status: 'idle',
        currentOperation: null,
        error: null,
        lastLoaded: null,
      };

      const mockSessionAccountsState = {
        data: [],
        status: 'idle',
        currentOperation: null,
        error: null,
        lastLoaded: null,
      };

      mockStore.getSessionState.mockReturnValue(mockSessionState);
      mockStore.getSessionAccountsState.mockReturnValue(mockSessionAccountsState);
      mockStore.shouldLoadSession.mockReturnValue(true);

      const { result } = renderHook(() => useSession());

      expect(result.current.data).toBeNull();
      expect(result.current.status).toBe('idle');
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.hasAccount).toBe(false);
      expect(result.current.currentAccountId).toBeNull();
      expect(result.current.accountIds).toEqual([]);
      expect(result.current.accounts).toEqual([]);
    });

    it('should auto-load session when autoLoad is true', () => {
      mockStore.getSessionState.mockReturnValue({
        data: null,
        status: 'idle',
        currentOperation: null,
        error: null,
        lastLoaded: null,
      });
      mockStore.getSessionAccountsState.mockReturnValue({
        data: [],
        status: 'idle',
        currentOperation: null,
        error: null,
        lastLoaded: null,
      });
      mockStore.shouldLoadSession.mockReturnValue(true);

      renderHook(() => useSession({ autoLoad: true }));

      expect(mockStore.shouldLoadSession).toHaveBeenCalled();
    });

    it('should not auto-load session when autoLoad is false', () => {
      mockStore.getSessionState.mockReturnValue({
        data: null,
        status: 'idle',
        currentOperation: null,
        error: null,
        lastLoaded: null,
      });
      mockStore.getSessionAccountsState.mockReturnValue({
        data: [],
        status: 'idle',
        currentOperation: null,
        error: null,
        lastLoaded: null,
      });
      mockStore.shouldLoadSession.mockReturnValue(false);

      renderHook(() => useSession({ autoLoad: false }));

      expect(mockStore.shouldLoadSession).not.toHaveBeenCalled();
    });
  });

  describe('session state', () => {
    it('should return authenticated state when session is valid', () => {
      const mockSessionData = createMockSessionInfo();
      const mockSessionState = {
        data: mockSessionData,
        status: 'success',
        currentOperation: null,
        error: null,
        lastLoaded: Date.now(),
      };

      mockStore.getSessionState.mockReturnValue(mockSessionState);
      mockStore.getSessionAccountsState.mockReturnValue({
        data: [],
        status: 'idle',
        currentOperation: null,
        error: null,
        lastLoaded: null,
      });

      const { result } = renderHook(() => useSession());

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.hasAccount).toBe(true);
      expect(result.current.currentAccountId).toBe('507f1f77bcf86cd799439011');
      expect(result.current.accountIds).toEqual(['507f1f77bcf86cd799439011']);
    });

    it('should return authenticated state with session accounts when autoLoadSessionAccounts is true', () => {
      const mockSessionData = createMockSessionInfo();
      const mockSessionAccount = createMockSessionAccount();

      const mockSessionState = {
        data: mockSessionData,
        status: 'success',
        currentOperation: null,
        error: null,
        lastLoaded: Date.now(),
      };

      const mockSessionAccountsState = {
        data: [mockSessionAccount],
        status: 'success',
        currentOperation: null,
        error: null,
        lastLoaded: Date.now(),
      };

      mockStore.getSessionState.mockReturnValue(mockSessionState);
      mockStore.getSessionAccountsState.mockReturnValue(mockSessionAccountsState);

      const { result } = renderHook(() => useSession({ autoLoadSessionAccounts: true }));

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.accounts).toEqual([mockSessionAccount]);
      expect(result.current.sessionAccountsSuccess).toBe(true);
    });

    it('should return not authenticated when session is invalid', () => {
      const mockSessionData = createMockSessionInfo({
        hasSession: false,
        isValid: false,
        accountIds: [],
        currentAccountId: null,
      });

      const mockSessionState = {
        data: mockSessionData,
        status: 'success',
        currentOperation: null,
        error: null,
        lastLoaded: Date.now(),
      };

      mockStore.getSessionState.mockReturnValue(mockSessionState);
      mockStore.getSessionAccountsState.mockReturnValue({
        data: [],
        status: 'idle',
        currentOperation: null,
        error: null,
        lastLoaded: null,
      });

      const { result } = renderHook(() => useSession());

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.hasAccount).toBe(false);
    });

    it('should return loading state', () => {
      const mockSessionState = {
        data: null,
        status: 'loading',
        currentOperation: 'loadSession',
        error: null,
        lastLoaded: null,
      };

      mockStore.getSessionState.mockReturnValue(mockSessionState);
      mockStore.getSessionAccountsState.mockReturnValue({
        data: [],
        status: 'idle',
        currentOperation: null,
        error: null,
        lastLoaded: null,
      });

      const { result } = renderHook(() => useSession());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.status).toBe('loading');
      expect(result.current.currentOperation).toBe('loadSession');
    });

    it('should return error state', () => {
      const mockSessionState = {
        data: null,
        status: 'error',
        currentOperation: null,
        error: 'Session load failed',
        lastLoaded: null,
      };

      mockStore.getSessionState.mockReturnValue(mockSessionState);
      mockStore.getSessionAccountsState.mockReturnValue({
        data: [],
        status: 'idle',
        currentOperation: null,
        error: null,
        lastLoaded: null,
      });

      const { result } = renderHook(() => useSession());

      expect(result.current.hasError).toBe(true);
      expect(result.current.error).toBe('Session load failed');
    });
  });

  describe('session operations', () => {
    it('should load session successfully', async () => {
      const mockSessionData = createMockSessionInfo();
      const mockResponse = { session: mockSessionData };

      mockAuthService.getAccountSession.mockResolvedValue(mockResponse);
      mockStore.getSessionState.mockReturnValue({
        data: null,
        status: 'idle',
        currentOperation: null,
        error: null,
        lastLoaded: null,
      });
      mockStore.getSessionAccountsState.mockReturnValue({
        data: [],
        status: 'idle',
        currentOperation: null,
        error: null,
        lastLoaded: null,
      });

      const { result } = renderHook(() => useSession());

      await act(async () => {
        await result.current.load();
      });

      expect(mockStore.setSessionStatus).toHaveBeenCalledWith('loading', 'loadSession');
      expect(mockAuthService.getAccountSession).toHaveBeenCalled();
      expect(mockStore.setSessionData).toHaveBeenCalledWith(mockSessionData);
    });

    it('should handle session load error', async () => {
      const error = new Error('Network error');
      mockAuthService.getAccountSession.mockRejectedValue(error);

      mockStore.getSessionState.mockReturnValue({
        data: null,
        status: 'idle',
        currentOperation: null,
        error: null,
        lastLoaded: null,
      });
      mockStore.getSessionAccountsState.mockReturnValue({
        data: [],
        status: 'idle',
        currentOperation: null,
        error: null,
        lastLoaded: null,
      });

      const { result } = renderHook(() => useSession());

      await act(async () => {
        await result.current.load();
      });

      expect(mockStore.setSessionError).toHaveBeenCalledWith('Failed to load session: Network error');
    });

    it('should load session accounts successfully', async () => {
      const mockSessionData = createMockSessionInfo();
      const mockSessionAccounts = [createMockSessionAccount()];

      mockAuthService.getSessionAccountsData.mockResolvedValue(mockSessionAccounts);

      mockStore.getSessionState.mockReturnValue({
        data: mockSessionData,
        status: 'success',
        currentOperation: null,
        error: null,
        lastLoaded: Date.now(),
      });
      mockStore.getSessionAccountsState.mockReturnValue({
        data: [],
        status: 'idle',
        currentOperation: null,
        error: null,
        lastLoaded: null,
      });

      const { result } = renderHook(() => useSession());

      await act(async () => {
        await result.current.loadSessionAccounts();
      });

      expect(mockStore.setSessionAccountsStatus).toHaveBeenCalledWith('loading', 'loadSessionAccounts');
      expect(mockAuthService.getSessionAccountsData).toHaveBeenCalledWith(mockSessionData.accountIds);
      expect(mockStore.setSessionAccountsData).toHaveBeenCalledWith(mockSessionAccounts);
    });

    it('should handle session accounts load error', async () => {
      const mockSessionData = createMockSessionInfo();
      const error = new Error('Network error');

      mockAuthService.getSessionAccountsData.mockRejectedValue(error);

      mockStore.getSessionState.mockReturnValue({
        data: mockSessionData,
        status: 'success',
        currentOperation: null,
        error: null,
        lastLoaded: Date.now(),
      });
      mockStore.getSessionAccountsState.mockReturnValue({
        data: [],
        status: 'idle',
        currentOperation: null,
        error: null,
        lastLoaded: null,
      });

      const { result } = renderHook(() => useSession());

      await act(async () => {
        await result.current.loadSessionAccounts();
      });

      expect(mockStore.setSessionAccountsError).toHaveBeenCalledWith('Failed to load session accounts: Network error');
    });

    it('should logout all accounts successfully', async () => {
      const mockSessionData = createMockSessionInfo();

      mockAuthService.logoutAll.mockResolvedValue({ message: 'Logged out successfully' });

      mockStore.getSessionState.mockReturnValue({
        data: mockSessionData,
        status: 'success',
        currentOperation: null,
        error: null,
        lastLoaded: Date.now(),
      });
      mockStore.getSessionAccountsState.mockReturnValue({
        data: [],
        status: 'idle',
        currentOperation: null,
        error: null,
        lastLoaded: null,
      });

      const { result } = renderHook(() => useSession());

      await act(async () => {
        await result.current.logoutAll();
      });

      expect(mockStore.setSessionStatus).toHaveBeenCalledWith('updating', 'logoutAll');
      expect(mockAuthService.logoutAll).toHaveBeenCalledWith(mockSessionData.accountIds);
      expect(mockStore.clearSession).toHaveBeenCalled();
    });

    it('should set current account successfully', async () => {
      const accountId = '507f1f77bcf86cd799439012';
      const mockUpdatedSessionData = createMockSessionInfo({ currentAccountId: accountId });
      const mockResponse = { session: mockUpdatedSessionData };

      mockAuthService.setCurrentAccountInSession.mockResolvedValue({ message: 'Current account set' });
      mockAuthService.getAccountSession.mockResolvedValue(mockResponse);

      mockStore.getSessionState.mockReturnValue({
        data: createMockSessionInfo(),
        status: 'success',
        currentOperation: null,
        error: null,
        lastLoaded: Date.now(),
      });
      mockStore.getSessionAccountsState.mockReturnValue({
        data: [],
        status: 'idle',
        currentOperation: null,
        error: null,
        lastLoaded: null,
      });

      const { result } = renderHook(() => useSession());

      await act(async () => {
        await result.current.setCurrentAccount(accountId);
      });

      expect(mockStore.setSessionStatus).toHaveBeenCalledWith('updating', 'setCurrentAccount');
      expect(mockAuthService.setCurrentAccountInSession).toHaveBeenCalledWith(accountId);
      expect(mockAuthService.getAccountSession).toHaveBeenCalled();
      expect(mockStore.setSessionData).toHaveBeenCalledWith(mockUpdatedSessionData);
    });

    it('should handle set current account error', async () => {
      const accountId = '507f1f77bcf86cd799439012';
      const error = new Error('Failed to set current account');

      mockAuthService.setCurrentAccountInSession.mockRejectedValue(error);

      mockStore.getSessionState.mockReturnValue({
        data: createMockSessionInfo(),
        status: 'success',
        currentOperation: null,
        error: null,
        lastLoaded: Date.now(),
      });
      mockStore.getSessionAccountsState.mockReturnValue({
        data: [],
        status: 'idle',
        currentOperation: null,
        error: null,
        lastLoaded: null,
      });

      const { result } = renderHook(() => useSession());

      await act(async () => {
        await result.current.setCurrentAccount(accountId);
      });

      expect(mockStore.setSessionError).toHaveBeenCalledWith(
        'Failed to set current account: Failed to set current account',
      );
    });
  });

  describe('convenience getters', () => {
    it('should return correct status helpers for loading state', () => {
      mockStore.getSessionState.mockReturnValue({
        data: null,
        status: 'loading',
        currentOperation: 'loadSession',
        error: null,
        lastLoaded: null,
      });
      mockStore.getSessionAccountsState.mockReturnValue({
        data: [],
        status: 'idle',
        currentOperation: null,
        error: null,
        lastLoaded: null,
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

    it('should return correct status helpers for success state', () => {
      mockStore.getSessionState.mockReturnValue({
        data: createMockSessionInfo(),
        status: 'success',
        currentOperation: null,
        error: null,
        lastLoaded: Date.now(),
      });
      mockStore.getSessionAccountsState.mockReturnValue({
        data: [],
        status: 'success',
        currentOperation: null,
        error: null,
        lastLoaded: Date.now(),
      });

      const { result } = renderHook(() => useSession());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.sessionAccountsSuccess).toBe(true);
    });

    it('should return correct session accounts helpers', () => {
      mockStore.getSessionState.mockReturnValue({
        data: createMockSessionInfo(),
        status: 'success',
        currentOperation: null,
        error: null,
        lastLoaded: Date.now(),
      });
      mockStore.getSessionAccountsState.mockReturnValue({
        data: [],
        status: 'loading',
        currentOperation: 'loadSessionAccounts',
        error: null,
        lastLoaded: null,
      });

      const { result } = renderHook(() => useSession());

      expect(result.current.sessionAccountsLoading).toBe(true);
      expect(result.current.sessionAccountsError).toBeNull();
      expect(result.current.sessionAccountsSuccess).toBe(false);
    });
  });

  describe('accounts ordering', () => {
    it('should return accounts in the same order as accountIds', () => {
      const mockSessionData = createMockSessionInfo({
        accountIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
      });

      const mockSessionAccounts = [
        createMockSessionAccount({ id: '507f1f77bcf86cd799439012' }), // Different order
        createMockSessionAccount({ id: '507f1f77bcf86cd799439011' }),
      ];

      mockStore.getSessionState.mockReturnValue({
        data: mockSessionData,
        status: 'success',
        currentOperation: null,
        error: null,
        lastLoaded: Date.now(),
      });
      mockStore.getSessionAccountsState.mockReturnValue({
        data: mockSessionAccounts,
        status: 'success',
        currentOperation: null,
        error: null,
        lastLoaded: Date.now(),
      });

      const { result } = renderHook(() => useSession());

      // Should return accounts in the order specified by accountIds
      expect(result.current.accounts).toHaveLength(2);
      expect(result.current.accounts[0].id).toBe('507f1f77bcf86cd799439011');
      expect(result.current.accounts[1].id).toBe('507f1f77bcf86cd799439012');
    });

    it('should filter out accounts not in accountIds', () => {
      const mockSessionData = createMockSessionInfo({
        accountIds: ['507f1f77bcf86cd799439011'],
      });

      const mockSessionAccounts = [
        createMockSessionAccount({ id: '507f1f77bcf86cd799439011' }),
        createMockSessionAccount({ id: '507f1f77bcf86cd799439012' }), // Not in accountIds
      ];

      mockStore.getSessionState.mockReturnValue({
        data: mockSessionData,
        status: 'success',
        currentOperation: null,
        error: null,
        lastLoaded: Date.now(),
      });
      mockStore.getSessionAccountsState.mockReturnValue({
        data: mockSessionAccounts,
        status: 'success',
        currentOperation: null,
        error: null,
        lastLoaded: Date.now(),
      });

      const { result } = renderHook(() => useSession());

      expect(result.current.accounts).toHaveLength(1);
      expect(result.current.accounts[0].id).toBe('507f1f77bcf86cd799439011');
    });
  });
});
