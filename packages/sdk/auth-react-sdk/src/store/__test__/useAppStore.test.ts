import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAppStore, DEFAULT_SESSION_STATE, DEFAULT_SESSION_ACCOUNTS_STATE } from '../useAppStore';
import { Account, AccountSessionInfo, SessionAccount, AccountType, AccountStatus } from '../../types';

// Mock Date.now for consistent testing
const mockDateNow = vi.fn();

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useAppStore.setState({
      session: { ...DEFAULT_SESSION_STATE },
      accounts: {},
      sessionAccounts: { ...DEFAULT_SESSION_ACCOUNTS_STATE, data: [] },
    });

    // Mock current time
    mockDateNow.mockReturnValue(1640995200000); // 2022-01-01T00:00:00.000Z
    vi.spyOn(Date, 'now').mockImplementation(mockDateNow);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    test('should have correct initial state', () => {
      const state = useAppStore.getState();

      expect(state.session).toEqual(DEFAULT_SESSION_STATE);
      expect(state.accounts).toEqual({});
      expect(state.sessionAccounts).toEqual(DEFAULT_SESSION_ACCOUNTS_STATE);
    });

    test('should have empty accounts initially', () => {
      const state = useAppStore.getState();

      expect(state.accounts).toEqual({});
      expect(Object.keys(state.accounts)).toHaveLength(0);
    });

    test('should have default session state', () => {
      const state = useAppStore.getState();

      expect(state.session.data).toBeNull();
      expect(state.session.status).toBe('idle');
      expect(state.session.currentOperation).toBeNull();
      expect(state.session.error).toBeNull();
      expect(state.session.lastLoaded).toBeNull();
    });
  });

  describe('Session Actions', () => {
    test('should set session status', () => {
      const { setSessionStatus } = useAppStore.getState();

      setSessionStatus('loading', 'loadSession');

      const state = useAppStore.getState();
      expect(state.session.status).toBe('loading');
      expect(state.session.currentOperation).toBe('loadSession');
      expect(state.session.error).toBeNull();
    });

    test('should set session status without operation', () => {
      const { setSessionStatus } = useAppStore.getState();

      setSessionStatus('success');

      const state = useAppStore.getState();
      expect(state.session.status).toBe('success');
      expect(state.session.currentOperation).toBeNull();
    });

    test('should set session data', () => {
      const { setSessionData } = useAppStore.getState();
      const sessionData: AccountSessionInfo = {
        hasSession: true,
        accountIds: ['507f1f77bcf86cd799439011'],
        currentAccountId: '507f1f77bcf86cd799439011',
        isValid: true,
      };

      setSessionData(sessionData);

      const state = useAppStore.getState();
      expect(state.session.data).toEqual(sessionData);
      expect(state.session.status).toBe('success');
      expect(state.session.currentOperation).toBeNull();
      expect(state.session.error).toBeNull();
      expect(state.session.lastLoaded).toBe(1640995200000);
    });

    test('should set session error', () => {
      const { setSessionError } = useAppStore.getState();

      setSessionError('Session failed');

      const state = useAppStore.getState();
      expect(state.session.error).toBe('Session failed');
      expect(state.session.status).toBe('error');
      expect(state.session.currentOperation).toBeNull();
    });

    test('should clear session error when set to null', () => {
      const { setSessionError } = useAppStore.getState();

      // First set an error
      setSessionError('Some error');
      expect(useAppStore.getState().session.error).toBe('Some error');

      // Then clear it
      setSessionError(null);

      const state = useAppStore.getState();
      expect(state.session.error).toBeNull();
      expect(state.session.status).toBe('idle');
    });

    test('should clear session', () => {
      const { setSessionData, setAccountData, setSessionAccountsData, clearSession } = useAppStore.getState();

      // First populate some data
      setSessionData({
        hasSession: true,
        accountIds: ['507f1f77bcf86cd799439011'],
        currentAccountId: '507f1f77bcf86cd799439011',
        isValid: true,
      });

      setAccountData('507f1f77bcf86cd799439011', {
        id: '507f1f77bcf86cd799439011',
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
      } as Account);

      setSessionAccountsData([
        {
          id: '507f1f77bcf86cd799439011',
          accountType: AccountType.Local,
          status: AccountStatus.Active,
          userDetails: { name: 'John Doe', email: 'john@example.com' },
        },
      ]);

      // Clear session
      clearSession();

      const state = useAppStore.getState();
      expect(state.session).toEqual(DEFAULT_SESSION_STATE);
      expect(state.accounts).toEqual({});
      expect(state.sessionAccounts).toEqual({ ...DEFAULT_SESSION_ACCOUNTS_STATE, data: [] });
    });

    test('should update session operation', () => {
      const { setSessionOperation } = useAppStore.getState();

      setSessionOperation('setCurrentAccount');

      const state = useAppStore.getState();
      expect(state.session.currentOperation).toBe('setCurrentAccount');
    });
  });

  describe('Account Actions', () => {
    const accountId = '507f1f77bcf86cd799439011';
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

    test('should set account status', () => {
      const { setAccountStatus } = useAppStore.getState();

      setAccountStatus(accountId, 'loading', 'loadAccount');

      const state = useAppStore.getState();
      expect(state.accounts[accountId]).toBeDefined();
      expect(state.accounts[accountId].status).toBe('loading');
      expect(state.accounts[accountId].currentOperation).toBe('loadAccount');
      expect(state.accounts[accountId].error).toBeNull();
    });

    test('should set account data', () => {
      const { setAccountData } = useAppStore.getState();

      setAccountData(accountId, mockAccount);

      const state = useAppStore.getState();
      expect(state.accounts[accountId].data).toEqual(mockAccount);
      expect(state.accounts[accountId].status).toBe('success');
      expect(state.accounts[accountId].currentOperation).toBeNull();
      expect(state.accounts[accountId].error).toBeNull();
      expect(state.accounts[accountId].lastLoaded).toBe(1640995200000);
    });

    test('should set account data and update session account', () => {
      const { setAccountData, setSessionAccountsData } = useAppStore.getState();

      // First set up a session account
      setSessionAccountsData([
        {
          id: accountId,
          accountType: AccountType.Local,
          status: AccountStatus.Active,
          userDetails: { name: 'Old Name', email: 'old@example.com' },
        },
      ]);

      // Update account data
      setAccountData(accountId, mockAccount);

      const state = useAppStore.getState();
      const sessionAccount = state.sessionAccounts.data.find((acc) => acc.id === accountId);
      expect(sessionAccount).toBeDefined();
      expect(sessionAccount!.userDetails.name).toBe('John Doe');
      expect(sessionAccount!.userDetails.email).toBe('john@example.com');
    });

    test('should set account error', () => {
      const { setAccountError } = useAppStore.getState();

      setAccountError(accountId, 'Account load failed');

      const state = useAppStore.getState();
      expect(state.accounts[accountId].error).toBe('Account load failed');
      expect(state.accounts[accountId].status).toBe('error');
      expect(state.accounts[accountId].currentOperation).toBeNull();
    });

    test('should update account data', () => {
      const { setAccountData, updateAccountData } = useAppStore.getState();

      // First set initial data
      setAccountData(accountId, mockAccount);

      // Update specific fields
      updateAccountData(accountId, {
        userDetails: {
          ...mockAccount.userDetails,
          name: 'Jane Doe',
          firstName: 'Jane',
        },
      });

      const state = useAppStore.getState();
      expect(state.accounts[accountId].data!.userDetails.name).toBe('Jane Doe');
      expect(state.accounts[accountId].data!.userDetails.firstName).toBe('Jane');
      expect(state.accounts[accountId].data!.userDetails.lastName).toBe('Doe'); // unchanged
    });

    test('should remove account', () => {
      const { setAccountData, setSessionData, setSessionAccountsData, removeAccount } = useAppStore.getState();

      // Set up data
      setAccountData(accountId, mockAccount);
      setSessionData({
        hasSession: true,
        accountIds: [accountId, 'other-account'],
        currentAccountId: accountId,
        isValid: true,
      });
      setSessionAccountsData([
        {
          id: accountId,
          accountType: AccountType.Local,
          status: AccountStatus.Active,
          userDetails: { name: 'John Doe', email: 'john@example.com' },
        },
        {
          id: 'other-account',
          accountType: AccountType.Local,
          status: AccountStatus.Active,
          userDetails: { name: 'Other User', email: 'other@example.com' },
        },
      ]);

      // Remove account
      removeAccount(accountId);

      const state = useAppStore.getState();
      expect(state.accounts[accountId]).toBeUndefined();
      expect(state.sessionAccounts.data).toHaveLength(1);
      expect(state.sessionAccounts.data.find((acc) => acc.id === accountId)).toBeUndefined();
      expect(state.session.data!.accountIds).toEqual(['other-account']);
      expect(state.session.data!.currentAccountId).toBe('other-account');
    });

    test('should set multiple accounts data', () => {
      const { setAccountsData } = useAppStore.getState();
      const account2: Account = { ...mockAccount, id: 'account2' };

      setAccountsData([mockAccount, account2]);

      const state = useAppStore.getState();
      expect(state.accounts[accountId].data).toEqual(mockAccount);
      expect(state.accounts['account2'].data).toEqual(account2);
      expect(state.accounts[accountId].status).toBe('success');
      expect(state.accounts['account2'].status).toBe('success');
    });
  });

  describe('Session Accounts Actions', () => {
    const sessionAccount: SessionAccount = {
      id: '507f1f77bcf86cd799439011',
      accountType: AccountType.Local,
      status: AccountStatus.Active,
      userDetails: {
        name: 'John Doe',
        email: 'john@example.com',
      },
    };

    test('should set session accounts status', () => {
      const { setSessionAccountsStatus } = useAppStore.getState();

      setSessionAccountsStatus('loading', 'loadSessionAccounts');

      const state = useAppStore.getState();
      expect(state.sessionAccounts.status).toBe('loading');
      expect(state.sessionAccounts.currentOperation).toBe('loadSessionAccounts');
      expect(state.sessionAccounts.error).toBeNull();
    });

    test('should set session accounts data', () => {
      const { setSessionAccountsData } = useAppStore.getState();

      setSessionAccountsData([sessionAccount]);

      const state = useAppStore.getState();
      expect(state.sessionAccounts.data).toEqual([sessionAccount]);
      expect(state.sessionAccounts.status).toBe('success');
      expect(state.sessionAccounts.currentOperation).toBeNull();
      expect(state.sessionAccounts.error).toBeNull();
      expect(state.sessionAccounts.lastLoaded).toBe(1640995200000);
    });

    test('should set session accounts error', () => {
      const { setSessionAccountsError } = useAppStore.getState();

      setSessionAccountsError('Failed to load session accounts');

      const state = useAppStore.getState();
      expect(state.sessionAccounts.error).toBe('Failed to load session accounts');
      expect(state.sessionAccounts.status).toBe('error');
      expect(state.sessionAccounts.currentOperation).toBeNull();
    });

    test('should update session account data', () => {
      const { setSessionAccountsData, updateSessionAccountData } = useAppStore.getState();

      // Set initial data
      setSessionAccountsData([sessionAccount]);

      // Update specific account
      updateSessionAccountData(sessionAccount.id, {
        userDetails: {
          ...sessionAccount.userDetails,
          name: 'Jane Doe',
        },
      });

      const state = useAppStore.getState();
      expect(state.sessionAccounts.data[0].userDetails.name).toBe('Jane Doe');
      expect(state.sessionAccounts.data[0].userDetails.email).toBe('john@example.com'); // unchanged
    });

    test('should remove session account', () => {
      const { setSessionAccountsData, removeSessionAccount } = useAppStore.getState();
      const account2 = { ...sessionAccount, id: 'account2' };

      // Set initial data
      setSessionAccountsData([sessionAccount, account2]);

      // Remove one account
      removeSessionAccount(sessionAccount.id);

      const state = useAppStore.getState();
      expect(state.sessionAccounts.data).toHaveLength(1);
      expect(state.sessionAccounts.data[0].id).toBe('account2');
    });

    test('should clear session accounts', () => {
      const { setSessionAccountsData, clearSessionAccounts } = useAppStore.getState();

      // Set initial data
      setSessionAccountsData([sessionAccount]);

      // Clear accounts
      clearSessionAccounts();

      const state = useAppStore.getState();
      expect(state.sessionAccounts).toEqual({ ...DEFAULT_SESSION_ACCOUNTS_STATE, data: [] });
    });
  });

  describe('Getters', () => {
    test('should get session state', () => {
      const { getSessionState, setSessionData } = useAppStore.getState();

      const sessionData: AccountSessionInfo = {
        hasSession: true,
        accountIds: ['507f1f77bcf86cd799439011'],
        currentAccountId: '507f1f77bcf86cd799439011',
        isValid: true,
      };

      setSessionData(sessionData);

      const sessionState = getSessionState();
      expect(sessionState.data).toEqual(sessionData);
      expect(sessionState.status).toBe('success');
    });

    test('should get account state', () => {
      const { getAccountState, setAccountData } = useAppStore.getState();
      const accountId = '507f1f77bcf86cd799439011';
      const mockAccount = {
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
      } as Account;

      setAccountData(accountId, mockAccount);

      const accountState = getAccountState(accountId);
      expect(accountState.data).toEqual(mockAccount);
      expect(accountState.status).toBe('success');
    });

    test('should get session account', () => {
      const { getSessionAccount, setSessionAccountsData } = useAppStore.getState();
      const sessionAccount: SessionAccount = {
        id: '507f1f77bcf86cd799439011',
        accountType: AccountType.Local,
        status: AccountStatus.Active,
        userDetails: { name: 'John Doe', email: 'john@example.com' },
      };

      setSessionAccountsData([sessionAccount]);

      const result = getSessionAccount(sessionAccount.id);
      expect(result).toEqual(sessionAccount);
    });

    test('should get all session accounts', () => {
      const { getAllSessionAccounts, setSessionAccountsData } = useAppStore.getState();
      const sessionAccounts: SessionAccount[] = [
        {
          id: '507f1f77bcf86cd799439011',
          accountType: AccountType.Local,
          status: AccountStatus.Active,
          userDetails: { name: 'John Doe', email: 'john@example.com' },
        },
        {
          id: '507f1f77bcf86cd799439012',
          accountType: AccountType.OAuth,
          status: AccountStatus.Active,
          userDetails: { name: 'Jane Doe', email: 'jane@example.com' },
        },
      ];

      setSessionAccountsData(sessionAccounts);

      const result = getAllSessionAccounts();
      expect(result).toEqual(sessionAccounts);
    });
  });

  describe('Computed Values', () => {
    beforeEach(() => {
      // Set a baseline time
      mockDateNow.mockReturnValue(1640995200000); // 2022-01-01T00:00:00.000Z
    });

    test('should determine if account should load - no data', () => {
      const { shouldLoadAccount } = useAppStore.getState();

      const result = shouldLoadAccount('507f1f77bcf86cd799439011');
      expect(result).toBe(true);
    });

    test('should determine if account should load - currently loading', () => {
      const { shouldLoadAccount, setAccountStatus } = useAppStore.getState();
      const accountId = '507f1f77bcf86cd799439011';

      setAccountStatus(accountId, 'loading');

      const result = shouldLoadAccount(accountId);
      expect(result).toBe(false);
    });

    test('should determine if account should load - stale data', () => {
      const { shouldLoadAccount, setAccountData } = useAppStore.getState();
      const accountId = '507f1f77bcf86cd799439011';

      // Set data with old timestamp
      const oldTime = 1640995200000 - 6 * 60 * 1000; // 6 minutes ago
      mockDateNow.mockReturnValue(oldTime);

      setAccountData(accountId, { id: accountId } as Account);

      // Reset to current time
      mockDateNow.mockReturnValue(1640995200000);

      const result = shouldLoadAccount(accountId, 5 * 60 * 1000); // 5 minute max age
      expect(result).toBe(true);
    });

    test('should determine if account should load - fresh data', () => {
      const { shouldLoadAccount, setAccountData } = useAppStore.getState();
      const accountId = '507f1f77bcf86cd799439011';

      setAccountData(accountId, { id: accountId } as Account);

      const result = shouldLoadAccount(accountId, 5 * 60 * 1000);
      expect(result).toBe(false);
    });

    test('should determine if session should load', () => {
      const { shouldLoadSession, setSessionStatus, setSessionData } = useAppStore.getState();

      // No data - should load
      expect(shouldLoadSession()).toBe(true);

      // Currently loading - should not load
      setSessionStatus('loading');
      expect(shouldLoadSession()).toBe(false);

      // Fresh data - should not load
      setSessionData({
        hasSession: true,
        accountIds: ['507f1f77bcf86cd799439011'],
        currentAccountId: '507f1f77bcf86cd799439011',
        isValid: true,
      });
      expect(shouldLoadSession()).toBe(false);
    });

    test('should determine if session accounts should load', () => {
      const { shouldLoadSessionAccounts, setSessionData, setSessionAccountsData } = useAppStore.getState();

      // No session data - should not load
      expect(shouldLoadSessionAccounts()).toBe(false);

      // Session with no accounts - should not load
      setSessionData({
        hasSession: true,
        accountIds: [],
        currentAccountId: null,
        isValid: true,
      });
      expect(shouldLoadSessionAccounts()).toBe(false);

      // Session with accounts but no session accounts data - should load
      setSessionData({
        hasSession: true,
        accountIds: ['507f1f77bcf86cd799439011'],
        currentAccountId: '507f1f77bcf86cd799439011',
        isValid: true,
      });
      expect(shouldLoadSessionAccounts()).toBe(true);

      // Fresh session accounts data - should not load
      setSessionAccountsData([
        {
          id: '507f1f77bcf86cd799439011',
          accountType: AccountType.Local,
          status: AccountStatus.Active,
          userDetails: { name: 'John Doe', email: 'john@example.com' },
        },
      ]);
      expect(shouldLoadSessionAccounts()).toBe(false);
    });

    test('should handle data staleness correctly', () => {
      const { shouldLoadAccount, setAccountData } = useAppStore.getState();
      const accountId = '507f1f77bcf86cd799439011';

      // Set data at specific time
      const dataTime = 1640995200000;
      mockDateNow.mockReturnValue(dataTime);
      setAccountData(accountId, { id: accountId } as Account);

      // Test different staleness scenarios

      // Data is 2 minutes old, max age 5 minutes - should not load
      mockDateNow.mockReturnValue(dataTime + 2 * 60 * 1000);
      expect(shouldLoadAccount(accountId, 5 * 60 * 1000)).toBe(false);

      // Data is 6 minutes old, max age 5 minutes - should load
      mockDateNow.mockReturnValue(dataTime + 6 * 60 * 1000);
      expect(shouldLoadAccount(accountId, 5 * 60 * 1000)).toBe(true);

      // Custom max age - 10 minutes
      expect(shouldLoadAccount(accountId, 10 * 60 * 1000)).toBe(false);
    });
  });
});
