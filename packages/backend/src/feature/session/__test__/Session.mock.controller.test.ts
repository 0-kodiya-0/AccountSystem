import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import * as SessionMockController from '../__mocks__/Session.mock.controller';
import * as sessionUtils from '../session.utils';

// Mock the session utils
vi.mock('../session.utils', () => ({
  createAccountSessionToken: vi.fn(),
  verifyAccountSessionToken: vi.fn(),
  setAccountSessionCookie: vi.fn(),
  clearAccountSession: vi.fn(),
  getAccountSessionFromCookies: vi.fn(),
}));

// Mock logger
vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Session Mock Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      body: {},
      params: {},
      cookies: {},
      ip: '127.0.0.1',
      get: vi.fn().mockImplementation((header: string) => {
        if (header === 'User-Agent') return 'MockUserAgent/1.0';
        return undefined;
      }),
    };
    mockResponse = {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    };
    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getSessionMockStatus', () => {
    it('should return session status with current session info', async () => {
      const mockSession = {
        hasSession: true,
        accountIds: ['507f1f77bcf86cd799439011'],
        currentAccountId: '507f1f77bcf86cd799439011',
        isValid: true,
      };

      mockRequest.cookies = { account_session: 'mock_token' };
      vi.mocked(sessionUtils.getAccountSessionFromCookies).mockReturnValue(mockSession);

      await SessionMockController.getSessionMockStatus(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            enabled: true,
            currentSession: mockSession,
            cookies: {
              hasAccountSession: true,
              sessionToken: 'present',
            },
          }),
        }),
      );
    });

    it('should handle missing session cookie', async () => {
      const mockSession = {
        hasSession: false,
        accountIds: [],
        currentAccountId: null,
        isValid: false,
      };

      mockRequest.cookies = {};
      vi.mocked(sessionUtils.getAccountSessionFromCookies).mockReturnValue(mockSession);

      await SessionMockController.getSessionMockStatus(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cookies: {
              hasAccountSession: false,
              sessionToken: 'missing',
            },
          }),
        }),
      );
    });
  });

  describe('createMockSessionToken', () => {
    it('should create session token with valid account IDs', async () => {
      const accountIds = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'];
      const currentAccountId = '507f1f77bcf86cd799439011';
      const mockToken = 'mock_session_token';

      mockRequest.body = { accountIds, currentAccountId };
      vi.mocked(sessionUtils.createAccountSessionToken).mockReturnValue(mockToken);

      await SessionMockController.createMockSessionToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(sessionUtils.createAccountSessionToken).toHaveBeenCalledWith({
        accountIds,
        currentAccountId,
      });

      expect(sessionUtils.setAccountSessionCookie).toHaveBeenCalledWith(mockRequest, mockResponse, {
        accountIds,
        currentAccountId,
      });

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            message: 'Session token created successfully',
            token: mockToken,
          }),
        }),
      );
    });

    it('should throw error when accountIds is missing', async () => {
      mockRequest.body = {};

      await expect(
        SessionMockController.createMockSessionToken(mockRequest as Request, mockResponse as Response, mockNext),
      ).rejects.toThrow('accountIds array is required');
    });

    it('should throw error when accountIds is not an array', async () => {
      mockRequest.body = { accountIds: 'not_an_array' };

      await expect(
        SessionMockController.createMockSessionToken(mockRequest as Request, mockResponse as Response, mockNext),
      ).rejects.toThrow('accountIds array is required');
    });

    it('should throw error when currentAccountId is not in accountIds', async () => {
      mockRequest.body = {
        accountIds: ['507f1f77bcf86cd799439011'],
        currentAccountId: '507f1f77bcf86cd799439012',
      };

      await expect(
        SessionMockController.createMockSessionToken(mockRequest as Request, mockResponse as Response, mockNext),
      ).rejects.toThrow('currentAccountId must be in accountIds array');
    });

    it('should use first account as current when currentAccountId not provided', async () => {
      const accountIds = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'];
      mockRequest.body = { accountIds };

      await SessionMockController.createMockSessionToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(sessionUtils.createAccountSessionToken).toHaveBeenCalledWith({
        accountIds,
        currentAccountId: accountIds[0],
      });
    });
  });

  describe('updateMockSessionToken', () => {
    beforeEach(() => {
      vi.mocked(sessionUtils.getAccountSessionFromCookies).mockReturnValue({
        hasSession: true,
        accountIds: ['507f1f77bcf86cd799439011'],
        currentAccountId: '507f1f77bcf86cd799439011',
        isValid: true,
      });
    });

    it('should add account to session', async () => {
      const newAccountId = '507f1f77bcf86cd799439012';
      mockRequest.body = { action: 'add', accountId: newAccountId };

      await SessionMockController.updateMockSessionToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(sessionUtils.createAccountSessionToken).toHaveBeenCalledWith({
        accountIds: ['507f1f77bcf86cd799439011', newAccountId],
        currentAccountId: '507f1f77bcf86cd799439011',
      });
    });

    it('should not add duplicate account', async () => {
      const existingAccountId = '507f1f77bcf86cd799439011';
      mockRequest.body = { action: 'add', accountId: existingAccountId };

      await SessionMockController.updateMockSessionToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(sessionUtils.createAccountSessionToken).toHaveBeenCalledWith({
        accountIds: ['507f1f77bcf86cd799439011'], // No duplicate
        currentAccountId: '507f1f77bcf86cd799439011',
      });
    });

    it('should remove account from session', async () => {
      vi.mocked(sessionUtils.getAccountSessionFromCookies).mockReturnValue({
        hasSession: true,
        accountIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
        currentAccountId: '507f1f77bcf86cd799439011',
        isValid: true,
      });

      mockRequest.body = { action: 'remove', accountId: '507f1f77bcf86cd799439012' };

      await SessionMockController.updateMockSessionToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(sessionUtils.createAccountSessionToken).toHaveBeenCalledWith({
        accountIds: ['507f1f77bcf86cd799439011'],
        currentAccountId: '507f1f77bcf86cd799439011',
      });
    });

    it('should update current account when removing current account', async () => {
      vi.mocked(sessionUtils.getAccountSessionFromCookies).mockReturnValue({
        hasSession: true,
        accountIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
        currentAccountId: '507f1f77bcf86cd799439011',
        isValid: true,
      });

      mockRequest.body = { action: 'remove', accountId: '507f1f77bcf86cd799439011' };

      await SessionMockController.updateMockSessionToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(sessionUtils.createAccountSessionToken).toHaveBeenCalledWith({
        accountIds: ['507f1f77bcf86cd799439012'],
        currentAccountId: '507f1f77bcf86cd799439012', // Updated to remaining account
      });
    });

    it('should set current account to null when removing last account', async () => {
      mockRequest.body = { action: 'remove', accountId: '507f1f77bcf86cd799439011' };

      await SessionMockController.updateMockSessionToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(sessionUtils.createAccountSessionToken).toHaveBeenCalledWith({
        accountIds: [],
        currentAccountId: null,
      });
    });

    it('should set current account', async () => {
      vi.mocked(sessionUtils.getAccountSessionFromCookies).mockReturnValue({
        hasSession: true,
        accountIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
        currentAccountId: '507f1f77bcf86cd799439011',
        isValid: true,
      });

      mockRequest.body = { action: 'setCurrent', currentAccountId: '507f1f77bcf86cd799439012' };

      await SessionMockController.updateMockSessionToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(sessionUtils.createAccountSessionToken).toHaveBeenCalledWith({
        accountIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
        currentAccountId: '507f1f77bcf86cd799439012',
      });
    });

    it('should throw error when action is missing', async () => {
      mockRequest.body = {};

      await expect(
        SessionMockController.updateMockSessionToken(mockRequest as Request, mockResponse as Response, mockNext),
      ).rejects.toThrow('action is required');
    });

    it('should throw error when no active session', async () => {
      vi.mocked(sessionUtils.getAccountSessionFromCookies).mockReturnValue({
        hasSession: false,
        accountIds: [],
        currentAccountId: null,
        isValid: false,
      });

      mockRequest.body = { action: 'add', accountId: '507f1f77bcf86cd799439011' };

      await expect(
        SessionMockController.updateMockSessionToken(mockRequest as Request, mockResponse as Response, mockNext),
      ).rejects.toThrow('No active session found');
    });

    it('should throw error for invalid action', async () => {
      mockRequest.body = { action: 'invalid_action' };

      await expect(
        SessionMockController.updateMockSessionToken(mockRequest as Request, mockResponse as Response, mockNext),
      ).rejects.toThrow('Invalid action. Must be: add, remove, setCurrent');
    });
  });

  describe('validateMockSessionToken', () => {
    it('should validate valid token', async () => {
      const mockToken = 'valid_token';
      const mockSessionData = {
        accountIds: ['507f1f77bcf86cd799439011'],
        currentAccountId: '507f1f77bcf86cd799439011',
      };

      mockRequest.body = { token: mockToken };
      vi.mocked(sessionUtils.verifyAccountSessionToken).mockReturnValue(mockSessionData);

      await SessionMockController.validateMockSessionToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            valid: true,
            sessionData: mockSessionData,
            message: 'Token is valid',
          }),
        }),
      );
    });

    it('should handle invalid token', async () => {
      const mockToken = 'invalid_token';
      mockRequest.body = { token: mockToken };
      vi.mocked(sessionUtils.verifyAccountSessionToken).mockReturnValue(null);

      await SessionMockController.validateMockSessionToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            valid: false,
            sessionData: null,
            message: 'Token is invalid or expired',
          }),
        }),
      );
    });

    it('should throw error when token is missing', async () => {
      mockRequest.body = {};

      await expect(
        SessionMockController.validateMockSessionToken(mockRequest as Request, mockResponse as Response, mockNext),
      ).rejects.toThrow('Token is required');
    });
  });

  describe('clearMockSession', () => {
    it('should clear session successfully', async () => {
      await SessionMockController.clearMockSession(mockRequest as Request, mockResponse as Response, mockNext);

      expect(sessionUtils.clearAccountSession).toHaveBeenCalledWith(mockRequest, mockResponse);
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            message: 'Session cleared successfully',
            cleared: true,
          }),
        }),
      );
    });
  });

  describe('generateMockSessions', () => {
    it('should generate mock sessions with default values', async () => {
      mockRequest.body = {};

      await SessionMockController.generateMockSessions(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            message: 'Generated 5 mock sessions',
            count: 5,
            sessions: expect.arrayContaining([
              expect.objectContaining({
                token: expect.any(String),
                sessionData: expect.objectContaining({
                  accountIds: expect.any(Array),
                  currentAccountId: expect.any(String),
                }),
              }),
            ]),
          }),
        }),
      );
    });

    it('should generate custom number of sessions', async () => {
      mockRequest.body = { count: 3, accountsPerSession: 2 };

      await SessionMockController.generateMockSessions(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            message: 'Generated 3 mock sessions',
            count: 3,
          }),
        }),
      );
    });

    it('should throw error when requesting too many sessions', async () => {
      mockRequest.body = { count: 15 };

      await expect(
        SessionMockController.generateMockSessions(mockRequest as Request, mockResponse as Response, mockNext),
      ).rejects.toThrow('Cannot generate more than 10 mock sessions');
    });
  });

  describe('corruptMockSession', () => {
    it('should create malformed session token', async () => {
      mockRequest.body = { type: 'malformed' };

      await SessionMockController.corruptMockSession(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.cookie).toHaveBeenCalledWith('account_session', 'malformed.jwt.token', expect.any(Object));

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            message: 'Session corrupted with type: malformed',
            type: 'malformed',
          }),
        }),
      );
    });

    it('should create empty session token', async () => {
      mockRequest.body = { type: 'empty' };

      await SessionMockController.corruptMockSession(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.cookie).toHaveBeenCalledWith('account_session', '', expect.any(Object));
    });

    it('should throw error for invalid corruption type', async () => {
      mockRequest.body = { type: 'invalid_type' };

      await expect(
        SessionMockController.corruptMockSession(mockRequest as Request, mockResponse as Response, mockNext),
      ).rejects.toThrow('Invalid corruption type');
    });
  });

  describe('getSessionMockInfo', () => {
    it('should return detailed session information', async () => {
      const mockSession = {
        hasSession: true,
        accountIds: ['507f1f77bcf86cd799439011'],
        currentAccountId: '507f1f77bcf86cd799439011',
        isValid: true,
      };

      mockRequest.cookies = {
        account_session: 'session_token',
        access_token_507f1f77bcf86cd799439011: 'access_token',
        refresh_token_507f1f77bcf86cd799439011: 'refresh_token',
        unrelated_cookie: 'value',
      };

      mockRequest.get = vi.fn().mockImplementation((header: string) => {
        if (header === 'User-Agent') return 'MockUserAgent/1.0';
        return undefined;
      });
      vi.mocked(sessionUtils.getAccountSessionFromCookies).mockReturnValue(mockSession);

      await SessionMockController.getSessionMockInfo(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            session: mockSession,
            authCookies: {
              account_session: 'present',
              access_token_507f1f77bcf86cd799439011: 'present',
              refresh_token_507f1f77bcf86cd799439011: 'present',
            },
            cookieCount: 3,
            userAgent: 'MockUserAgent/1.0',
            ip: '127.0.0.1',
            timestamp: expect.any(String),
          }),
        }),
      );
    });
  });
});
