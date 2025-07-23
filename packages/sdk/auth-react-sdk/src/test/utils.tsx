import { vi } from 'vitest';
import { useAppStore } from '../store/useAppStore';
import { AccountType, AccountStatus, Account, AccountSessionInfo, SessionAccount, OAuthProviders } from '../types';

// === MOCK SERVICES ===
export const createMockAuthService = () => ({
  // Authentication methods
  localLogin: vi.fn(),
  verifyTwoFactorLogin: vi.fn(),
  logout: vi.fn(),
  changePassword: vi.fn(),
  revokeTokens: vi.fn(),
  getAccessTokenInfo: vi.fn(),

  // OAuth methods
  generateOAuthSigninUrl: vi.fn(),
  generateOAuthSignupUrl: vi.fn(),
  generatePermissionUrl: vi.fn(),
  generateReauthorizeUrl: vi.fn(),

  // Email verification methods
  requestEmailVerification: vi.fn(),
  verifyEmailForSignup: vi.fn(),
  completeProfile: vi.fn(),
  cancelSignup: vi.fn(),

  // Password reset methods
  requestPasswordReset: vi.fn(),
  verifyPasswordReset: vi.fn(),
  resetPassword: vi.fn(),

  // Session methods
  getAccountSession: vi.fn(),
  getSessionAccountsData: vi.fn(),
  logoutAll: vi.fn(),
  setCurrentAccountInSession: vi.fn(),

  // 2FA methods
  getTwoFactorStatus: vi.fn(),
  setupTwoFactor: vi.fn(),
  verifyTwoFactorSetup: vi.fn(),
  generateBackupCodes: vi.fn(),
});

export const createMockAccountService = () => ({
  getAccount: vi.fn(),
  updateAccount: vi.fn(),
});

// === MOCK DATA FACTORIES ===
export const createMockAccount = (overrides: Partial<Account> = {}): Account => ({
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
  ...overrides,
});

export const createMockSessionData = (overrides: Partial<AccountSessionInfo> = {}): AccountSessionInfo => ({
  hasSession: true,
  accountIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
  currentAccountId: '507f1f77bcf86cd799439011',
  isValid: true,
  ...overrides,
});

export const createMockSessionAccounts = (): SessionAccount[] => [
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

// === STORE UTILITIES ===
export const resetAppStore = () => {
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
};

export const setMockSessionState = (sessionData: AccountSessionInfo, accounts: SessionAccount[] = []) => {
  useAppStore.setState({
    session: {
      data: sessionData,
      status: 'success',
      currentOperation: null,
      error: null,
      lastLoaded: Date.now(),
    },
    accounts: {},
    sessionAccounts: {
      data: accounts,
      status: 'success',
      currentOperation: null,
      error: null,
      lastLoaded: Date.now(),
    },
  });
};

// === BROWSER MOCKS ===
export const createMockLocation = () => ({
  href: 'http://localhost:3000',
  search: '',
  origin: 'http://localhost:3000',
});

export const createMockHistory = () => ({
  replaceState: vi.fn(),
});

export const setupBrowserMocks = () => {
  const mockLocation = createMockLocation();
  const mockHistory = createMockHistory();

  Object.defineProperty(window, 'location', {
    value: mockLocation,
    writable: true,
  });

  Object.defineProperty(window, 'history', {
    value: mockHistory,
    writable: true,
  });

  return { mockLocation, mockHistory };
};

// === STORE MOCKS ===
export const createMockStoreSelectors = () => {
  const mockGetAccountState = vi.fn();
  const mockUpdateAccountData = vi.fn();

  const mockUseAppStore = vi.fn();
  mockUseAppStore.mockImplementation((selector) => {
    if (typeof selector === 'function') {
      return selector({
        getAccountState: mockGetAccountState,
        updateAccountData: mockUpdateAccountData,
      } as any);
    }
    return {
      getAccountState: mockGetAccountState,
      updateAccountData: mockUpdateAccountData,
    };
  });

  return {
    mockUseAppStore,
    mockGetAccountState,
    mockUpdateAccountData,
  };
};

// === ERROR HANDLING UTILITIES ===
export const testErrorHandling = async (
  operation: () => Promise<any>,
  expectedError: string,
  mockService: any,
  methodName: string,
) => {
  const error = new Error(expectedError);
  mockService[methodName].mockRejectedValue(error);

  const result = await operation();

  expect(result.success).toBe(false);
  expect(result.message).toContain(expectedError);
};

// === RETRY LOGIC UTILITIES ===
export const testRetryLogic = async (
  hook: any,
  operation: string,
  mockService: any,
  methodName: string,
  maxRetries: number = 3,
) => {
  const error = new Error('Network error');
  mockService[methodName].mockRejectedValue(error);

  // Perform initial attempt + retries
  for (let i = 0; i <= maxRetries; i++) {
    if (i > 0) {
      vi.advanceTimersByTime(6000); // Advance past cooldown
    }

    await hook.current[operation]();

    if (i < maxRetries) {
      expect(hook.current.retryCount).toBe(i);
    }
  }

  // Try one more retry - should be blocked
  vi.advanceTimersByTime(6000);
  const response = await hook.current.retry();
  expect(response.success).toBe(false);
  expect(response.message).toBe(`Maximum retry attempts (${maxRetries}) exceeded`);
};

// === COMMON TEST CONSTANTS ===
export const TEST_CONSTANTS = {
  ACCOUNT_IDS: {
    CURRENT: '507f1f77bcf86cd799439011',
    DIFFERENT: '507f1f77bcf86cd799439012',
  },
  OAUTH: {
    PROVIDER: OAuthProviders.Google,
    CALLBACK_URL: 'http://localhost:3000/oauth/callback',
    SCOPES: ['read:profile', 'write:calendar'],
  },
  URLs: {
    BASE: 'http://localhost:3000',
    CALLBACK: 'http://localhost:3000/verify',
  },
  TOKENS: {
    TEMP: 'temp-token-123',
    SETUP: 'setup-token-123',
    VERIFICATION: 'verification-token-123',
    PROFILE: 'profile-token-123',
  },
};
