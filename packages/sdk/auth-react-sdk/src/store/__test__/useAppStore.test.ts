import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../useAppStore';
import { createMockAccount, createMockSessionAccount, createMockSessionInfo } from '../../test/utils';

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store state before each test
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

  describe('session management', () => {
    it('should set session status', () => {
      const { setSessionStatus, getSessionState } = useAppStore.getState();

      setSessionStatus('loading', 'loadSession');

      const sessionState = getSessionState();
      expect(sessionState.status).toBe('loading');
      expect(sessionState.currentOperation).toBe('loadSession');
      expect(sessionState.error).toBeNull();
    });

    it('should set session data', () => {
      const { setSessionData, getSessionState } = useAppStore.getState();
      const mockSessionData = createMockSessionInfo();

      setSessionData(mockSessionData);

      const sessionState = getSessionState();
      expect(sessionState.data).toEqual(mockSessionData);
      expect(sessionState.status).toBe('success');
      expect(sessionState.currentOperation).toBeNull();
      expect(sessionState.error).toBeNull();
      expect(sessionState.lastLoaded).toBeTruthy();
    });

    it('should set session error', () => {
      const { setSessionError, getSessionState } = useAppStore.getState();

      setSessionError('Session load failed');

      const sessionState = getSessionState();
      expect(sessionState.error).toBe('Session load failed');
      expect(sessionState.status).toBe('error');
      expect(sessionState.currentOperation).toBeNull();
    });

    it('should clear session error when setting status to non-error', () => {
      const { setSessionError, setSessionStatus, getSessionState } = useAppStore.getState();

      setSessionError('Session load failed');
      setSessionStatus('loading');

      const sessionState = getSessionState();
      expect(sessionState.error).toBeNull();
      expect(sessionState.status).toBe('loading');
    });

    it('should clear session', () => {
      const { setSessionData, clearSession, getSessionState, accounts, sessionAccounts } = useAppStore.getState();
      const mockSessionData = createMockSessionInfo();

      setSessionData(mockSessionData);
      clearSession();

      const sessionState = getSessionState();
      expect(sessionState.data).toBeNull();
      expect(sessionState.status).toBe('idle');
      expect(accounts).toEqual({});
      expect(sessionAccounts.data).toEqual([]);
    });

    it('should set session operation', () => {
      const { setSessionOperation, getSessionState } = useAppStore.getState();

      setSessionOperation('customOperation');

      const sessionState = getSessionState();
      expect(sessionState.currentOperation).toBe('customOperation');
    });
  });

  describe('account management', () => {
    const accountId = '507f1f77bcf86cd799439011';

    it('should set account status', () => {
      const { setAccountStatus, getAccountState } = useAppStore.getState();

      setAccountStatus(accountId, 'loading', 'loadAccount');

      const accountState = getAccountState(accountId);
      expect(accountState.status).toBe('loading');
      expect(accountState.currentOperation).toBe('loadAccount');
      expect(accountState.error).toBeNull();
    });

    it('should set account data', () => {
      const { setAccountData, getAccountState } = useAppStore.getState();
      const mockAccount = createMockAccount({ id: accountId });

      setAccountData(accountId, mockAccount);

      const accountState = getAccountState(accountId);
      expect(accountState.data).toEqual(mockAccount);
      expect(accountState.status).toBe('success');
      expect(accountState.currentOperation).toBeNull();
      expect(accountState.error).toBeNull();
      expect(accountState.lastLoaded).toBeTruthy();
    });

    it('should set account error', () => {
      const { setAccountError, getAccountState } = useAppStore.getState();

      setAccountError(accountId, 'Account load failed');

      const accountState = getAccountState(accountId);
      expect(accountState.error).toBe('Account load failed');
      expect(accountState.status).toBe('error');
      expect(accountState.currentOperation).toBeNull();
    });

    it('should update account data', () => {
      const { setAccountData, updateAccountData, getAccountState } = useAppStore.getState();
      const mockAccount = createMockAccount({ id: accountId });

      setAccountData(accountId, mockAccount);

      const updates = {
        userDetails: {
          ...mockAccount.userDetails,
          name: 'Updated Name',
        },
      };

      updateAccountData(accountId, updates);

      const accountState = getAccountState(accountId);
      expect(accountState.data?.userDetails.name).toBe('Updated Name');
    });

    it('should set multiple accounts data', () => {
      const { setAccountsData, getAccountState } = useAppStore.getState();
      const account1 = createMockAccount({ id: accountId });
      const account2 = createMockAccount({ id: '507f1f77bcf86cd799439012' });

      setAccountsData([account1, account2]);

      const accountState1 = getAccountState(accountId);
      const accountState2 = getAccountState('507f1f77bcf86cd799439012');

      expect(accountState1.data).toEqual(account1);
      expect(accountState2.data).toEqual(account2);
      expect(accountState1.status).toBe('success');
      expect(accountState2.status).toBe('success');
    });

    it('should remove account', () => {
      const { setAccountData, removeAccount, getAccountState } = useAppStore.getState();
      const mockAccount = createMockAccount({ id: accountId });

      setAccountData(accountId, mockAccount);
      removeAccount(accountId);

      const accountState = getAccountState(accountId);
      expect(accountState).toBeUndefined();
    });

    it('should clear account operation', () => {
      const { setAccountStatus, clearAccountOperation, getAccountState } = useAppStore.getState();

      setAccountStatus(accountId, 'updating', 'updateAccount');
      clearAccountOperation(accountId);

      const accountState = getAccountState(accountId);
      expect(accountState.currentOperation).toBeNull();
      expect(accountState.status).toBe('idle');
    });
  });

  describe('session accounts management', () => {
    it('should set session accounts status', () => {
      const { setSessionAccountsStatus, getSessionAccountsState } = useAppStore.getState();

      setSessionAccountsStatus('loading', 'loadSessionAccounts');

      const sessionAccountsState = getSessionAccountsState();
      expect(sessionAccountsState.status).toBe('loading');
      expect(sessionAccountsState.currentOperation).toBe('loadSessionAccounts');
      expect(sessionAccountsState.error).toBeNull();
    });

    it('should set session accounts data', () => {
      const { setSessionAccountsData, getSessionAccountsState } = useAppStore.getState();
      const mockSessionAccounts = [
        createMockSessionAccount({ id: '507f1f77bcf86cd799439011' }),
        createMockSessionAccount({ id: '507f1f77bcf86cd799439012' }),
      ];

      setSessionAccountsData(mockSessionAccounts);

      const sessionAccountsState = getSessionAccountsState();
      expect(sessionAccountsState.data).toEqual(mockSessionAccounts);
      expect(sessionAccountsState.status).toBe('success');
      expect(sessionAccountsState.currentOperation).toBeNull();
      expect(sessionAccountsState.error).toBeNull();
      expect(sessionAccountsState.lastLoaded).toBeTruthy();
    });

    it('should set session accounts error', () => {
      const { setSessionAccountsError, getSessionAccountsState } = useAppStore.getState();

      setSessionAccountsError('Session accounts load failed');

      const sessionAccountsState = getSessionAccountsState();
      expect(sessionAccountsState.error).toBe('Session accounts load failed');
      expect(sessionAccountsState.status).toBe('error');
      expect(sessionAccountsState.currentOperation).toBeNull();
    });

    it('should set individual session account data', () => {
      const { setSessionAccountData, getSessionAccount } = useAppStore.getState();
      const accountId = '507f1f77bcf86cd799439011';
      const mockSessionAccount = createMockSessionAccount({ id: accountId });

      setSessionAccountData(accountId, mockSessionAccount);

      const sessionAccount = getSessionAccount(accountId);
      expect(sessionAccount).toEqual(mockSessionAccount);
    });

    it('should update session account data', () => {
      const { setSessionAccountData, updateSessionAccountData, getSessionAccount } = useAppStore.getState();
      const accountId = '507f1f77bcf86cd799439011';
      const mockSessionAccount = createMockSessionAccount({ id: accountId });

      setSessionAccountData(accountId, mockSessionAccount);

      const updates = {
        userDetails: {
          ...mockSessionAccount.userDetails,
          name: 'Updated Session Name',
        },
      };

      updateSessionAccountData(accountId, updates);

      const sessionAccount = getSessionAccount(accountId);
      expect(sessionAccount?.userDetails.name).toBe('Updated Session Name');
    });

    it('should remove session account', () => {
      const { setSessionAccountData, removeSessionAccount, getSessionAccount } = useAppStore.getState();
      const accountId = '507f1f77bcf86cd799439011';
      const mockSessionAccount = createMockSessionAccount({ id: accountId });

      setSessionAccountData(accountId, mockSessionAccount);
      removeSessionAccount(accountId);

      const sessionAccount = getSessionAccount(accountId);
      expect(sessionAccount).toBeUndefined();
    });

    it('should clear session accounts', () => {
      const { setSessionAccountsData, clearSessionAccounts, getSessionAccountsState } = useAppStore.getState();
      const mockSessionAccounts = [createMockSessionAccount()];

      setSessionAccountsData(mockSessionAccounts);
      clearSessionAccounts();

      const sessionAccountsState = getSessionAccountsState();
      expect(sessionAccountsState.data).toEqual([]);
      expect(sessionAccountsState.status).toBe('idle');
    });

    it('should get all session accounts', () => {
      const { setSessionAccountsData, getAllSessionAccounts } = useAppStore.getState();
      const mockSessionAccounts = [
        createMockSessionAccount({ id: '507f1f77bcf86cd799439011' }),
        createMockSessionAccount({ id: '507f1f77bcf86cd799439012' }),
      ];

      setSessionAccountsData(mockSessionAccounts);

      const allAccounts = getAllSessionAccounts();
      expect(allAccounts).toEqual(mockSessionAccounts);
    });
  });

  describe('data synchronization', () => {
    it('should update session account when setting account data', () => {
      const { setSessionAccountData, setAccountData, getSessionAccount } = useAppStore.getState();
      const accountId = '507f1f77bcf86cd799439011';
      const mockSessionAccount = createMockSessionAccount({ id: accountId });
      const mockAccount = createMockAccount({
        id: accountId,
        userDetails: {
          ...createMockAccount().userDetails,
          name: 'Updated Full Account Name',
        },
      });

      // First set session account
      setSessionAccountData(accountId, mockSessionAccount);

      // Then set full account data
      setAccountData(accountId, mockAccount);

      // Session account should be updated
      const updatedSessionAccount = getSessionAccount(accountId);
      expect(updatedSessionAccount?.userDetails.name).toBe('Updated Full Account Name');
    });

    it('should update session accounts when setting multiple accounts data', () => {
      const { setSessionAccountsData, setAccountsData, getSessionAccount } = useAppStore.getState();
      const accountId1 = '507f1f77bcf86cd799439011';
      const accountId2 = '507f1f77bcf86cd799439012';

      const mockSessionAccounts = [
        createMockSessionAccount({ id: accountId1 }),
        createMockSessionAccount({ id: accountId2 }),
      ];

      const mockAccounts = [
        createMockAccount({
          id: accountId1,
          userDetails: { ...createMockAccount().userDetails, name: 'Updated Name 1' },
        }),
        createMockAccount({
          id: accountId2,
          userDetails: { ...createMockAccount().userDetails, name: 'Updated Name 2' },
        }),
      ];

      setSessionAccountsData(mockSessionAccounts);
      setAccountsData(mockAccounts);

      const sessionAccount1 = getSessionAccount(accountId1);
      const sessionAccount2 = getSessionAccount(accountId2);

      expect(sessionAccount1?.userDetails.name).toBe('Updated Name 1');
      expect(sessionAccount2?.userDetails.name).toBe('Updated Name 2');
    });

    it('should update session account when updating account data', () => {
      const { setSessionAccountData, setAccountData, updateAccountData, getSessionAccount } = useAppStore.getState();
      const accountId = '507f1f77bcf86cd799439011';
      const mockSessionAccount = createMockSessionAccount({ id: accountId });
      const mockAccount = createMockAccount({ id: accountId });

      setSessionAccountData(accountId, mockSessionAccount);
      setAccountData(accountId, mockAccount);

      const updates = {
        userDetails: {
          ...mockAccount.userDetails,
          name: 'Updated Through Account Update',
        },
      };

      updateAccountData(accountId, updates);

      const updatedSessionAccount = getSessionAccount(accountId);
      expect(updatedSessionAccount?.userDetails.name).toBe('Updated Through Account Update');
    });

    it('should remove session account when removing account', () => {
      const { setSessionAccountData, setAccountData, removeAccount, getSessionAccount, getSessionState } =
        useAppStore.getState();
      const accountId = '507f1f77bcf86cd799439011';
      const mockSessionAccount = createMockSessionAccount({ id: accountId });
      const mockAccount = createMockAccount({ id: accountId });
      const mockSessionData = createMockSessionInfo({
        accountIds: [accountId],
        currentAccountId: accountId,
      });

      // Set up initial state
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

      setSessionAccountData(accountId, mockSessionAccount);
      setAccountData(accountId, mockAccount);

      removeAccount(accountId);

      const sessionAccount = getSessionAccount(accountId);
      const sessionState = getSessionState();

      expect(sessionAccount).toBeUndefined();
      expect(sessionState.data?.accountIds).toEqual([]);
      expect(sessionState.data?.currentAccountId).toBeNull();
    });
  });

  describe('should load helpers', () => {
    it('should indicate when session should be loaded', () => {
      const { shouldLoadSession } = useAppStore.getState();

      // Should load when no data
      expect(shouldLoadSession()).toBe(true);

      // Should not load when loading
      useAppStore.setState({
        session: {
          data: null,
          status: 'loading',
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

      expect(shouldLoadSession()).toBe(false);

      // Should load when data is stale
      useAppStore.setState({
        session: {
          data: createMockSessionInfo(),
          status: 'success',
          currentOperation: null,
          error: null,
          lastLoaded: Date.now() - 10 * 60 * 1000, // 10 minutes ago (stale)
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

      expect(shouldLoadSession(5 * 60 * 1000)).toBe(true); // 5 minute max age

      // Should not load when data is fresh
      useAppStore.setState({
        session: {
          data: createMockSessionInfo(),
          status: 'success',
          currentOperation: null,
          error: null,
          lastLoaded: Date.now() - 2 * 60 * 1000, // 2 minutes ago (fresh)
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

      expect(shouldLoadSession(5 * 60 * 1000)).toBe(false); // 5 minute max age
    });

    it('should indicate when account should be loaded', () => {
      const { shouldLoadAccount } = useAppStore.getState();
      const accountId = '507f1f77bcf86cd799439011';

      // Should load when no account state
      expect(shouldLoadAccount(accountId)).toBe(true);

      // Should not load when loading
      useAppStore.setState({
        session: {
          data: null,
          status: 'idle',
          currentOperation: null,
          error: null,
          lastLoaded: null,
        },
        accounts: {
          [accountId]: {
            data: null,
            status: 'loading',
            currentOperation: null,
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

      expect(shouldLoadAccount(accountId)).toBe(false);

      // Should not load when updating
      useAppStore.setState({
        session: {
          data: null,
          status: 'idle',
          currentOperation: null,
          error: null,
          lastLoaded: null,
        },
        accounts: {
          [accountId]: {
            data: createMockAccount({ id: accountId }),
            status: 'updating',
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

      expect(shouldLoadAccount(accountId)).toBe(false);

      // Should load when no data
      useAppStore.setState({
        session: {
          data: null,
          status: 'idle',
          currentOperation: null,
          error: null,
          lastLoaded: null,
        },
        accounts: {
          [accountId]: {
            data: null,
            status: 'idle',
            currentOperation: null,
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

      expect(shouldLoadAccount(accountId)).toBe(true);

      // Should load when data is stale
      useAppStore.setState({
        session: {
          data: null,
          status: 'idle',
          currentOperation: null,
          error: null,
          lastLoaded: null,
        },
        accounts: {
          [accountId]: {
            data: createMockAccount({ id: accountId }),
            status: 'success',
            currentOperation: null,
            error: null,
            lastLoaded: Date.now() - 10 * 60 * 1000, // 10 minutes ago
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

      expect(shouldLoadAccount(accountId, 5 * 60 * 1000)).toBe(true); // 5 minute max age

      // Should not load when data is fresh
      useAppStore.setState({
        session: {
          data: null,
          status: 'idle',
          currentOperation: null,
          error: null,
          lastLoaded: null,
        },
        accounts: {
          [accountId]: {
            data: createMockAccount({ id: accountId }),
            status: 'success',
            currentOperation: null,
            error: null,
            lastLoaded: Date.now() - 2 * 60 * 1000, // 2 minutes ago
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

      expect(shouldLoadAccount(accountId, 5 * 60 * 1000)).toBe(false); // 5 minute max age
    });

    it('should indicate when session accounts should be loaded', () => {
      const { shouldLoadSessionAccounts } = useAppStore.getState();

      // Should not load when session is loading
      useAppStore.setState({
        session: {
          data: null,
          status: 'loading',
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

      expect(shouldLoadSessionAccounts()).toBe(false);

      // Should not load when session has no account IDs
      useAppStore.setState({
        session: {
          data: createMockSessionInfo({ accountIds: [] }),
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

      expect(shouldLoadSessionAccounts()).toBe(false);

      // Should not load when session accounts are loading
      useAppStore.setState({
        session: {
          data: createMockSessionInfo(),
          status: 'success',
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        },
        accounts: {},
        sessionAccounts: {
          data: [],
          status: 'loading',
          currentOperation: null,
          error: null,
          lastLoaded: null,
        },
      });

      expect(shouldLoadSessionAccounts()).toBe(false);

      // Should load when no session accounts data
      useAppStore.setState({
        session: {
          data: createMockSessionInfo(),
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

      expect(shouldLoadSessionAccounts()).toBe(true);

      // Should load when session accounts data is stale
      useAppStore.setState({
        session: {
          data: createMockSessionInfo(),
          status: 'success',
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        },
        accounts: {},
        sessionAccounts: {
          data: [createMockSessionAccount()],
          status: 'success',
          currentOperation: null,
          error: null,
          lastLoaded: Date.now() - 10 * 60 * 1000, // 10 minutes ago
        },
      });

      expect(shouldLoadSessionAccounts(5 * 60 * 1000)).toBe(true); // 5 minute max age

      // Should not load when session accounts data is fresh
      useAppStore.setState({
        session: {
          data: createMockSessionInfo(),
          status: 'success',
          currentOperation: null,
          error: null,
          lastLoaded: Date.now(),
        },
        accounts: {},
        sessionAccounts: {
          data: [createMockSessionAccount()],
          status: 'success',
          currentOperation: null,
          error: null,
          lastLoaded: Date.now() - 2 * 60 * 1000, // 2 minutes ago
        },
      });

      expect(shouldLoadSessionAccounts(5 * 60 * 1000)).toBe(false); // 5 minute max age
    });
  });

  describe('state immutability', () => {
    it('should maintain immutable state updates', () => {
      const { setSessionData, getSessionState } = useAppStore.getState();
      const mockSessionData = createMockSessionInfo();

      const initialState = getSessionState();
      setSessionData(mockSessionData);
      const updatedState = getSessionState();

      // States should be different objects
      expect(initialState).not.toBe(updatedState);
      expect(initialState.data).not.toBe(updatedState.data);
    });

    it('should maintain immutable account state updates', () => {
      const { setAccountData, getAccountState } = useAppStore.getState();
      const accountId = '507f1f77bcf86cd799439011';
      const mockAccount = createMockAccount({ id: accountId });

      const initialState = getAccountState(accountId);
      setAccountData(accountId, mockAccount);
      const updatedState = getAccountState(accountId);

      // States should be different objects
      expect(initialState).not.toBe(updatedState);
    });
  });

  describe('error handling', () => {
    it('should not throw when getting non-existent account state', () => {
      const { getAccountState } = useAppStore.getState();

      expect(() => getAccountState('non-existent-id')).not.toThrow();
      expect(getAccountState('non-existent-id')).toBeUndefined();
    });

    it('should not throw when getting non-existent session account', () => {
      const { getSessionAccount } = useAppStore.getState();

      expect(() => getSessionAccount('non-existent-id')).not.toThrow();
      expect(getSessionAccount('non-existent-id')).toBeUndefined();
    });

    it('should handle clearing operations on non-existent accounts', () => {
      const { clearAccountOperation } = useAppStore.getState();

      expect(() => clearAccountOperation('non-existent-id')).not.toThrow();
    });

    it('should handle updating non-existent account data', () => {
      const { updateAccountData } = useAppStore.getState();

      expect(() => updateAccountData('non-existent-id', { userDetails: { name: 'Test' } })).not.toThrow();
    });
  });
});
