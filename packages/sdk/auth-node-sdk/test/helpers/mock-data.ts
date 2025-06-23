import {
  Account,
  TokenVerificationResponse,
  UserResponse,
  SessionInfoResponse,
  HealthCheckResponse,
  AccountType,
} from '../../src/types';

export const mockAccount: Account = {
  _id: '507f1f77bcf86cd799439011',
  email: 'test@example.com',
  accountType: AccountType.OAuth,
  name: 'Test User',
  profilePicture: 'https://example.com/avatar.jpg',
  isEmailVerified: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

export const mockTokenVerificationResponse: TokenVerificationResponse = {
  valid: true,
  accountId: '507f1f77bcf86cd799439011',
  accountType: AccountType.OAuth,
  isRefreshToken: false,
  expiresAt: Date.now() + 3600000, // 1 hour from now
  tokenInfo: {
    type: 'oauth_jwt',
    format: 'JWT',
    algorithm: 'HS256',
    isValid: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  },
};

export const mockUserResponse: UserResponse = {
  user: mockAccount,
  accountId: '507f1f77bcf86cd799439011',
};

export const mockSessionResponse: SessionInfoResponse = {
  session: {
    accountIds: ['507f1f77bcf86cd799439011'],
    currentAccountId: '507f1f77bcf86cd799439011',
    sessionId: 'session_123',
    createdAt: '2024-01-01T00:00:00.000Z',
    lastActivity: '2024-01-01T01:00:00.000Z',
  },
};

export const mockHealthResponse: HealthCheckResponse = {
  status: 'healthy',
  timestamp: '2024-01-01T00:00:00.000Z',
  server: 'internal-api',
  version: '1.0.0',
  features: {
    httpApi: true,
    socketApi: true,
    authentication: 'header-based',
    typescript: true,
  },
  endpoints: {
    auth: '/internal/auth/*',
    users: '/internal/users/*',
    session: '/internal/session/*',
  },
  services: {
    accounts: 'available',
    sessions: 'available',
    tokens: 'available',
  },
};
